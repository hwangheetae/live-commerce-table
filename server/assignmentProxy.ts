import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import {
  loadCategoryMap,
  mapHsItem,
  mapLiveItem,
  type RawHsItem,
  type RawLiveItem,
} from './broadcastMapper.ts'
import type { AssignmentType, Broadcast } from '../src/types/assignment.ts'

const ORIGIN = 'https://live.ecomm-data.com'
const API_URL = `${ORIGIN}/api/assignment/list`
const ASSIGNMENT_URL = `${ORIGIN}/assignment`

/**
 * @summary 세션 갱신용 조회 주기(ms).
 * @description 원본 세션은 슬라이딩 TTL이 짧아 방치하면 만료. 주기적으로 조회를 보내 세션을 갱신 (20초 간격은 실측으로 검증).
 */
const KEEP_ALIVE_INTERVAL_MS = 20_000

/**
 * @summary 세션(브라우저)이 아직 준비되지 않은 경우
 */
export class AuthRequiredError extends Error {}

/**
 * @summary 원본 페이지에서 데이터를 얻지 못한 경우
 */
export class UpstreamError extends Error {}

/**
 * @summary 원본 API 응답 형태 (인증 확인용 user + 목록)
 */
interface AssignmentResponse {
  user?: { nickname?: string }
  list?: (RawLiveItem | RawHsItem)[]
}

let browser: Browser | null = null
let context: BrowserContext | null = null
let ready = false
let keepAliveTimer: NodeJS.Timeout | null = null

/**
 * @summary 현재 컨텍스트가 로그인 인증 상태인지 확인한다.
 * @description 응답에 user 정보가 있으면 로그인 상태로 판단한다.
 */
const isAuthenticated = async (ctx: BrowserContext): Promise<boolean> => {
  const res = await ctx.request.post(API_URL, { data: { type: 'hs' } })

  if (!res.ok()) return false

  const data = (await res.json()) as AssignmentResponse

  return Boolean(data.user)
}

/**
 * @summary 로그인 성공 후 사이트가 다른 경로로 이동하면 다시 /assignment로 돌려보낸다.
 * @description 사용자가 열린 창에서 직접 로그인하면 사이트가 보통 홈('/')으로 리다이렉트한다. 이때 로그인 상태가 확인되면 조회 대상인 /assignment 페이지로 되돌린다 (이미 assignment면 무시해 무한 이동 방지).
 */
const watchLoginRedirect = (page: Page, ctx: BrowserContext) => {
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return
    if (frame.url().startsWith(ASSIGNMENT_URL)) return

    void isAuthenticated(ctx).then((authenticated) => {
      if (authenticated) {
        page.goto(ASSIGNMENT_URL, { waitUntil: 'networkidle' }).catch(() => {})
      }
    })
  })
}

/**
 * @summary BFF 시작 시 브라우저를 띄우고 조회용 컨텍스트를 확보한다.
 * @description 로그인은 강제하지 않는다. 비로그인 상태에서도 원본 페이지는 목록을 렌더링하며(지표만 마스킹), 사용자가 열린 창에서 직접 로그인하면 다음 조회부터 전체 값이 표시된다.
 */
export const initSession = async (): Promise<void> => {
  // 사용자가 선택적으로 직접 로그인할 수 있도록 headful 모드로 실행한다
  browser = await chromium.launch({ headless: false })
  context = await browser.newContext()

  // 사이트 페이지를 열어둔 채 유지해 사이트 스크립트가 세션을 계속 갱신하도록 한다
  const page: Page = await context.newPage()

  // 로그인 완료 시 /assignment 페이지로 이동시키는 감시자 등록
  watchLoginRedirect(page, context)

  await page.goto(ASSIGNMENT_URL, { waitUntil: 'networkidle', timeout: 45_000 }).catch(() => {})

  // 분류(cid) 표시명을 위한 카테고리 맵 로딩 (인증 불필요, 서버 수명 동안 1회면 충분)
  await loadCategoryMap().catch((error) => {
    console.error('카테고리 맵 로딩 실패:', error)
  })

  console.log('\n로그인 없이 마스킹된 목록을 표시합니다.')
  console.log(
    '전체 지표를 보려면 열린 브라우저 창에서 직접 로그인하세요. (계정 정보는 저장되지 않습니다)\n',
  )

  ready = true
  startKeepAlive()
  console.log('데이터 조회 준비 완료.')
}

/**
 * @summary 원본 API가 기대하는 type 값
 */
const UPSTREAM_TYPE: Record<AssignmentType, string> = { live: 'lb', hs: 'hs' }

/**
 * @summary 원본 /api/assignment/list를 직접 호출해 원시 데이터를 가져와 변환한다.
 * @description 원본 페이지가 화면에 렌더링할 때 쓰는 것과 동일한 가공 로직으로 변환한다. 로그인 여부와 무관하게 조회하며, 비로그인이면 지표가 마스킹된 값(null)이 내려온다.
 * @throws {AuthRequiredError} 세션이 아직 준비되지 않은 경우
 * @throws {UpstreamError} 원본 API 호출 실패 또는 목록이 비어 있는 경우
 */
export const fetchAssignmentList = async (type: AssignmentType): Promise<Broadcast[]> => {
  if (!ready || !context) throw new AuthRequiredError('세션이 아직 준비되지 않았습니다')

  const res = await context.request.post(API_URL, { data: { type: UPSTREAM_TYPE[type] } })

  if (!res.ok()) throw new UpstreamError('원본 API 호출에 실패했습니다')

  const data = (await res.json()) as AssignmentResponse
  const list = data.list ?? []

  if (list.length === 0) throw new UpstreamError('목록에서 데이터를 찾지 못했습니다')

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

/**
 * @summary 살아있는 컨텍스트로 주기적으로 실제 조회를 보내 세션을 갱신한다.
 * @description 페이지 새로고침은 오히려 세션을 끊고, ping은 세션 유지에 부족함을 실측으로 확인.
 */
const startKeepAlive = () => {
  stopKeepAlive()
  keepAliveTimer = setInterval(() => {
    context?.request.post(API_URL, { data: { type: 'hs' } }).catch(() => {})
  }, KEEP_ALIVE_INTERVAL_MS)
  keepAliveTimer.unref()
}

/**
 * @summary keep-alive 타이머를 정지한다
 */
const stopKeepAlive = () => {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer)
    keepAliveTimer = null
  }
}

/**
 * @summary 세션 준비 여부
 */
export const isSessionReady = () => ready

/**
 * @summary 현재 로그인(인증) 상태 여부
 */
export const isLoggedIn = async (): Promise<boolean> => {
  if (!ready || !context) return false

  return isAuthenticated(context)
}

/**
 * @summary 서버 종료 시 브라우저를 정리한다
 */
export const closeBrowser = async () => {
  stopKeepAlive()
  await browser?.close().catch(() => {})
  browser = null
  context = null
  ready = false
}
