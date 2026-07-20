import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { AUTH_STATE_PATH, hasAuthState } from './authState.ts'
import { loadCategoryMap, mapHsItem, mapLiveItem, type RawHsItem, type RawLiveItem } from './broadcastMapper.ts'

// 프론트엔드가 사용하는 방송 종류 (과제 문서 기준)
export type AssignmentType = 'live' | 'hs'

const ORIGIN = 'https://live.ecomm-data.com'
const API_URL = `${ORIGIN}/api/assignment/list`
const ASSIGNMENT_URL = `${ORIGIN}/assignment`

// 원본 세션은 슬라이딩 TTL이 짧아 방치하면 만료된다.
// 살아있는 컨텍스트로 주기적으로 조회를 보내 세션을 갱신한다 (20초 간격은 실측으로 검증)
const KEEP_ALIVE_INTERVAL_MS = 20_000

// 세션(브라우저)이 아직 준비되지 않은 경우
export class AuthRequiredError extends Error {}

// 원본 페이지에서 데이터를 얻지 못한 경우
export class UpstreamError extends Error {}

// 원본 API 응답 형태 (인증 확인용 user + 목록)
interface AssignmentResponse {
  user?: { nickname?: string }
  list?: (RawLiveItem | RawHsItem)[]
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

// 현재 컨텍스트가 로그인 인증 상태인지 확인한다 (응답에 user 정보가 있으면 인증됨)
const isAuthenticated = async (ctx: BrowserContext): Promise<boolean> => {
  const res = await ctx.request.post(API_URL, { data: { type: 'hs' } })
  if (!res.ok()) return false
  const data = (await res.json()) as AssignmentResponse
  return Boolean(data.user)
}

// BFF 시작 시 브라우저를 띄우고 조회용 컨텍스트를 확보한다.
// 로그인은 강제하지 않는다. 비로그인 상태에서도 원본 페이지는 목록을 렌더링하며(지표만 마스킹),
// 사용자가 열린 창에서 직접 로그인하면 다음 조회부터 전체 값이 표시된다.
export const initSession = async (): Promise<void> => {
  // 사용자가 선택적으로 직접 로그인할 수 있도록 headful 모드로 실행한다
  browser = await chromium.launch({ headless: false })
  context = await browser.newContext(hasAuthState() ? { storageState: AUTH_STATE_PATH } : {})
  page = await context.newPage()

  // 사이트 페이지를 열어둔 채 유지해 사이트 스크립트가 세션을 계속 갱신하도록 한다
  await page.goto(ASSIGNMENT_URL, { waitUntil: 'networkidle', timeout: 45_000 }).catch(() => {})

  // 분류(cid) 표시명을 위한 카테고리 맵 로딩 (인증 불필요, 서버 수명 동안 1회면 충분)
  await loadCategoryMap().catch((error) => {
    console.error('카테고리 맵 로딩 실패:', error)
  })

  if (await isAuthenticated(context)) {
    console.log('기존 세션으로 로그인이 확인되었습니다.')
  } else {
    console.log('\n로그인 없이 마스킹된 목록을 표시합니다.')
    console.log('전체 지표를 보려면 열린 브라우저 창에서 직접 로그인하세요. (계정 정보는 저장되지 않습니다)\n')
  }

  ready = true
  startKeepAlive()
  console.log('데이터 조회 준비 완료.')
}

// 원본 API가 기대하는 type 값 (프론트엔드 내부 타입 'live'와 다르게 'lb'를 사용한다)
const UPSTREAM_TYPE: Record<AssignmentType, string> = { live: 'lb', hs: 'hs' }

// 원본 /api/assignment/list를 직접 호출해 원시 데이터를 가져온 뒤,
// 원본 페이지가 화면에 렌더링할 때 쓰는 것과 동일한 가공 로직으로 변환한다.
// 로그인 여부와 무관하게 조회한다. 비로그인이면 지표가 마스킹된 값(null)이 내려온다.
export const fetchAssignmentList = async (type: AssignmentType): Promise<Broadcast[]> => {
  if (!ready || !context) {
    throw new AuthRequiredError('세션이 아직 준비되지 않았습니다')
  }

  const res = await context.request.post(API_URL, { data: { type: UPSTREAM_TYPE[type] } })
  if (!res.ok()) {
    throw new UpstreamError('원본 API 호출에 실패했습니다')
  }
  const data = (await res.json()) as AssignmentResponse
  const list = data.list ?? []
  if (list.length === 0) {
    throw new UpstreamError('목록에서 데이터를 찾지 못했습니다')
  }
  // 이 응답 시점의 로그인 여부. 비로그인이면 지표가 "🔒 로그인"으로 마스킹된다.
  const authenticated = Boolean(data.user)

  // 각 목록은 최대 10개까지만 표시한다
  return list
    .slice(0, 10)
    .map((item, i) =>
      type === 'live'
        ? mapLiveItem(item as RawLiveItem, i + 1, authenticated)
        : mapHsItem(item as RawHsItem, i + 1, authenticated),
    )
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

// 현재 로그인(인증) 상태 여부 — 비로그인이면 지표가 마스킹된다
export const isLoggedIn = async (): Promise<boolean> => {
  if (!ready || !context) return false
  return isAuthenticated(context)
}

// 서버 종료 시 브라우저를 정리한다
export const closeBrowser = async () => {
  stopKeepAlive()
  await browser?.close().catch(() => {})
  browser = null
  context = null
  page = null
  ready = false
}
