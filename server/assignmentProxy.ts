import { chromium, type Browser, type BrowserContext, type Page, type Response } from 'playwright'
import { AUTH_STATE_PATH, hasAuthState } from './authState.ts'

// 프론트엔드가 사용하는 방송 종류 (과제 문서 기준)
export type AssignmentType = 'live' | 'hs'

const ORIGIN = 'https://live.ecomm-data.com'
const API_URL = `${ORIGIN}/api/assignment/list`
const SIGN_IN_URL = `${ORIGIN}/user/sign_in`
const ASSIGNMENT_URL = `${ORIGIN}/assignment`

// 원본 페이지의 탭 버튼 텍스트 (LIVE=라방, 홈쇼핑)
const TAB_LABEL: Record<AssignmentType, string> = { live: '라방', hs: '홈쇼핑' }

// 원본 세션은 슬라이딩 TTL이 짧아 방치하면 만료된다.
// 살아있는 컨텍스트로 주기적으로 조회를 보내 세션을 갱신한다 (20초 간격은 실측으로 검증)
const KEEP_ALIVE_INTERVAL_MS = 20_000
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000

// 인증 세션이 없거나 만료된 경우
export class AuthRequiredError extends Error {}

// 원본 페이지에서 데이터를 얻지 못한 경우
export class UpstreamError extends Error {}

// 세션 인증 확인용 원본 API 응답 형태
interface AssignmentResponse {
  user?: { nickname?: string }
}

// UI에 표시하는 방송 정보 (원본 테이블이 렌더링한 텍스트 그대로)
export interface Broadcast {
  rank: string
  title: string
  platform: string
  category: string
  date: string
  time: string
  visitCount: string
  salesCount: string
  salesAmount: string
  productCount: string
}

// 원본 /assignment 페이지의 테이블을 파싱하는 스크립트 (브라우저에서 실행)
// 값을 가공하지 않고 화면에 렌더된 텍스트를 그대로 읽어 과제 테이블과 동일하게 만든다
const PARSE_TABLE_SCRIPT = `(() => {
  const rows = Array.from(document.querySelectorAll('table tbody tr'))
  return rows.map((tr) => {
    const tds = Array.from(tr.querySelectorAll('td'))
    const cell = (i) => (tds[i] ? (tds[i].innerText || tds[i].textContent || '').trim() : '')
    const lines = (i) => cell(i).split('\\n').map((s) => s.trim()).filter(Boolean)
    const info = lines(1)
    const dt = lines(3)
    return {
      rank: cell(0),
      title: info[0] || '',
      platform: info.slice(1).join(' '),
      category: cell(2),
      date: dt[0] || '',
      time: dt[1] || '',
      visitCount: cell(4),
      salesCount: cell(5),
      salesAmount: cell(6),
      productCount: cell(7),
    }
  })
})()`

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
  await page.goto(ASSIGNMENT_URL, { waitUntil: 'networkidle', timeout: 45_000 }).catch(() => {})

  ready = true
  startKeepAlive()
  console.log('데이터 조회 준비 완료.')
}

// 원본 /assignment 페이지에서 해당 탭의 테이블을 스크래핑해 방송 목록을 가져온다
export const fetchAssignmentList = async (type: AssignmentType): Promise<Broadcast[]> => {
  if (!ready || !context || !page) {
    throw new AuthRequiredError('세션이 아직 준비되지 않았습니다')
  }

  // 세션이 살아있는지 먼저 확인한다 (만료 시 명확한 에러 반환)
  if (!(await isAuthenticated(context))) {
    throw new AuthRequiredError('세션이 만료되었습니다')
  }

  // 해당 탭을 클릭해 테이블을 전환하고, 테이블 갱신(assignment/list 응답)을 기다린다
  await Promise.all([
    page
      .waitForResponse((r) => r.url().includes('/api/assignment/list'), { timeout: 8_000 })
      .catch(() => {}),
    page.getByRole('button', { name: TAB_LABEL[type], exact: true }).click().catch(() => {}),
  ])
  await page.waitForTimeout(600)

  const items = (await page.evaluate(PARSE_TABLE_SCRIPT)) as Broadcast[]
  if (items.length === 0) {
    throw new UpstreamError('테이블에서 데이터를 찾지 못했습니다')
  }

  // 각 목록은 최대 10개까지만 표시한다
  return items.slice(0, 10)
}

// 살아있는 컨텍스트로 주기적으로 실제 조회를 보내 세션을 갱신한다.
// (페이지 새로고침은 오히려 세션을 끊고, ping은 세션 유지에 부족함을 실측으로 확인)
const startKeepAlive = () => {
  stopKeepAlive()
  keepAliveTimer = setInterval(() => {
    context?.request.post(API_URL, { data: { type: 'hs' } }).catch(() => {})
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
