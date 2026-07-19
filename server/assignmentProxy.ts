import { chromium, type Browser, type BrowserContext, type Page, type Response } from 'playwright'
import { AUTH_STATE_PATH, hasAuthState } from './authState.ts'

// 프론트엔드가 사용하는 방송 종류 (과제 문서 기준)
export type AssignmentType = 'live' | 'hs'

const ORIGIN = 'https://live.ecomm-data.com'
const API_URL = `${ORIGIN}/api/assignment/list`
const SIGN_IN_URL = `${ORIGIN}/user/sign_in`
const KEEP_ALIVE_URL = `${ORIGIN}/api/ping`

// 원본 API의 실제 type 값 매핑
// 과제 문서에는 LIVE가 "live"로 표기되어 있으나, 실제 원본 API는 "lb"를 사용한다
const ORIGIN_TYPE: Record<AssignmentType, string> = { live: 'lb', hs: 'hs' }

// 원본 세션은 슬라이딩 TTL이 짧아 방치하면 만료된다.
// 살아있는 컨텍스트로 주기적으로 요청을 보내 세션을 갱신한다
const KEEP_ALIVE_INTERVAL_MS = 20_000
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000

// 인증 세션이 없거나 만료된 경우
export class AuthRequiredError extends Error {}

// 원본 API가 예기치 않은 응답을 반환한 경우
export class UpstreamError extends Error {}

// 원본 API 응답 형태 (지표 등 상세 필드는 mapper 계층에서 다룬다)
interface AssignmentResponse {
  list?: unknown[]
  // 로그인 인증이 되면 응답에 user 정보가 포함된다. 없으면 비로그인으로 마스킹된 응답이다
  user?: { nickname?: string }
  mask?: boolean
}

// 원본 세션은 로그인한 Chromium 인스턴스(TLS 연결)에 바인딩되므로,
// storageState 파일을 별도 프로세스로 넘겨도 인증되지 않는다.
// 따라서 BFF가 로그인한 브라우저를 직접 소유하고 살아있는 컨텍스트로 조회한다.
let browser: Browser | null = null
let context: BrowserContext | null = null
// 로그인한 사이트 페이지를 열어둔 채 유지한다.
// 사이트 자체 스크립트가 주기적으로 세션을 갱신하므로, 이 페이지가 살아있어야 세션이 유지된다
let page: Page | null = null
let keepAliveTimer: NodeJS.Timeout | null = null
let ready = false

// 로그인 API(/api/user/sign_in) 응답이 result=1이면 로그인 성공으로 판단한다
const isSignInSuccess = async (response: Response) => {
  if (!response.url().includes('/api/user/sign_in')) return false
  try {
    return ((await response.json()) as { result?: unknown })?.result === 1
  } catch {
    return false
  }
}

// 현재 컨텍스트가 로그인 인증 상태인지 확인한다 (응답에 user 정보가 있으면 인증됨)
const isAuthenticated = async (ctx: BrowserContext): Promise<boolean> => {
  const res = await ctx.request.post(API_URL, { data: { type: 'hs' } })
  if (!res.ok()) return false
  const data = (await res.json()) as AssignmentResponse
  return Boolean(data.user)
}

// BFF 시작 시 브라우저를 띄우고 로그인된 컨텍스트를 확보한다
export const initSession = async (): Promise<void> => {
  // 사용자가 직접 로그인해야 하므로 headful 모드로 실행한다
  browser = await chromium.launch({ headless: false })
  context = await browser.newContext(hasAuthState() ? { storageState: AUTH_STATE_PATH } : {})
  page = await context.newPage()

  await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' }).catch(() => {})

  if (await isAuthenticated(context)) {
    console.log('기존 세션으로 로그인이 확인되었습니다.')
  } else {
    console.log('\n로그인이 필요합니다. 열린 브라우저 창에서 직접 로그인해 주세요.')
    console.log('아이디와 비밀번호는 저장되지 않습니다.\n')
    await page.goto(SIGN_IN_URL, { waitUntil: 'domcontentloaded' })
    await page.waitForResponse(isSignInSuccess, { timeout: LOGIN_TIMEOUT_MS })
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})

    if (!(await isAuthenticated(context))) {
      throw new Error('로그인 후에도 인증에 실패했습니다. BFF를 다시 시작해 주세요.')
    }
    console.log('로그인이 완료되었습니다.')
  }

  // 사이트 페이지를 열어둔 채 유지해 사이트 스크립트가 세션을 계속 갱신하도록 한다
  await page.goto(`${ORIGIN}/assignment`, { waitUntil: 'networkidle', timeout: 45_000 }).catch(() => {})

  ready = true
  startKeepAlive()
  console.log('데이터 조회 준비 완료.')
}

// 저장된 인증 세션으로 원본 API를 호출해 방송 목록을 가져온다
export const fetchAssignmentList = async (type: AssignmentType): Promise<AssignmentResponse> => {
  if (!ready || !context) {
    throw new AuthRequiredError('세션이 아직 준비되지 않았습니다')
  }

  const response = await context.request.post(API_URL, {
    data: { type: ORIGIN_TYPE[type] },
  })

  if (!response.ok()) {
    throw new UpstreamError(`원본 API 오류 (status ${response.status()})`)
  }

  const data = (await response.json()) as AssignmentResponse

  // user 정보가 없으면 세션이 일시적으로 만료된 것이다.
  // ready는 유지해 열어둔 페이지가 세션을 복구하면 다음 조회가 성공하도록 한다
  if (!data.user) {
    throw new AuthRequiredError('세션이 만료되었습니다')
  }

  return data
}

// 열어둔 페이지를 주기적으로 새로고침해 사이트가 세션을 갱신하도록 유도한다
const startKeepAlive = () => {
  stopKeepAlive()
  keepAliveTimer = setInterval(() => {
    void page
      ?.reload({ waitUntil: 'networkidle', timeout: 30_000 })
      .catch(() => context?.request.post(KEEP_ALIVE_URL, { data: {} }).catch(() => {}))
  }, KEEP_ALIVE_INTERVAL_MS)
  keepAliveTimer.unref()
}

const stopKeepAlive = () => {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer)
    keepAliveTimer = null
  }
}

// 세션 준비 여부
export const isSessionReady = () => ready

// 서버 종료 시 브라우저를 정리한다
export const closeBrowser = async () => {
  stopKeepAlive()
  await browser?.close().catch(() => {})
  browser = null
  context = null
  page = null
  ready = false
}
