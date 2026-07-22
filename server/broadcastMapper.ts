import type { Broadcast } from '../src/types/assignment.ts'

const GNB_URL = 'https://live.ecomm-data.com/api/home/gnb'
interface PlatformInfo {
  name: string
  short_name?: string
  no_crawl?: boolean
}

/**
 * @summary platform_id → 표시명 매핑 (원본 번들 모듈 47002에 정적으로 박혀 있음)
 * @description no_crawl: true인 플랫폼은 항상 지표가 "🚧"로 마스킹된다.
 */
export const PLATFORM_NAMES: Record<string, PlatformInfo> = {
  baemin: { name: '배민라이브', no_crawl: true },
  cjonstyle: { name: 'CJ온스타일', short_name: '온스타일' },
  coupang: { name: '쿠팡라이브', no_crawl: true },
  eland: { name: '이랜드몰' },
  gmarket: { name: 'G라이브', short_name: 'G마켓' },
  grip: { name: '그립' },
  gsshop: { name: '지에스샵 샤피라이브', short_name: '샤피라이브' },
  himart: { name: '롯데하이마트' },
  hmall: { name: '현대Hmall 쇼라', short_name: '현대Hmall' },
  homeplus: { name: '홈플러스' },
  hs_cjonstyle: { name: 'CJ온스타일' },
  hs_cjonstyleplus: { name: 'CJ온스타일 플러스' },
  hs_gongyoung: { name: '공영쇼핑' },
  hs_gsshop: { name: 'GS홈쇼핑' },
  hs_gsshopmyshop: { name: 'GS홈쇼핑 마이샵' },
  hs_hmall: { name: '현대홈쇼핑' },
  hs_hmallplus: { name: '현대홈쇼핑 플러스샵' },
  hs_hnsmall: { name: '홈앤쇼핑' },
  hs_kshop: { name: 'KT알파쇼핑' },
  hs_kshopplus: { name: 'K쇼핑 TV플러스', no_crawl: true },
  hs_lotteimall: { name: '롯데홈쇼핑' },
  hs_lotteimallonetv: { name: '롯데원티비' },
  hs_nsmall: { name: 'NS홈쇼핑' },
  hs_nsmallshopplus: { name: 'NS홈쇼핑 샵플러스' },
  hs_shinsegae: { name: '신세계쇼핑' },
  hs_shopntmall: { name: '쇼핑엔티' },
  hs_skstoa: { name: 'SK스토아' },
  interpark: { name: '인터파크TV', short_name: '인터파크' },
  kakao: { name: '카카오쇼핑LIVE', short_name: '카카오' },
  live11: { name: '11번가 라이브11', short_name: '11번가' },
  live24_ect: { name: '라이브24' },
  live24_nhl: { name: '농협 라이블리' },
  live24_sshm: { name: '삼삼해물' },
  lotteD: { name: '롯데백라이브' },
  lotteON: { name: '롯데온라이브' },
  naver: { name: '네이버쇼핑LIVE', short_name: '네이버' },
  sauce: { name: '소스라이브' },
  ssg: { name: '쓱라이브' },
  tmon: { name: '티몬플레이' },
  vogo: { name: '보고플레이', short_name: '보고' },
  wmp: { name: '위메프' },
  lotteimall: { name: '롯데홈쇼핑', no_crawl: true },
  nsmall: { name: 'NS홈쇼핑' },
  pang_live: { name: '팡라이브', no_crawl: true },
  ssg_live: { name: '신세계쇼핑라이브' },
  lotte_100: { name: '롯데백라이브' },
  lotte_on: { name: '롯데온라이브' },
  skstoa: { name: 'SK스토아' },
  olive: { name: '올리브영' },
  gongyoung: { name: '공영라방' },
}

/**
 * @summary 요일 매핑 (0=일 ~ 6=토, 원본 번들 convert_ko_day와 동일)
 */
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

interface CategoryInfo {
  pid: number | null
  name: string
}

interface GnbResponse {
  cats: Record<string, CategoryInfo>
}

let categoryMap: Record<string, CategoryInfo> | null = null

/**
 * @summary GNB API에서 카테고리 맵(cid → 표시명)을 로딩해 캐싱한다.
 */
export const loadCategoryMap = async (): Promise<void> => {
  const res = await fetch(GNB_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  const data = (await res.json()) as GnbResponse
  categoryMap = data.cats
}

/**
 * @summary 라이브 전용: cid → 부모 카테고리명으로 변환한다.
 * @description 원본 렌더 로직(cats[cid]?.pid || cid → 그 name)을 그대로 따른다.
 */
const resolveLiveCategory = (cid: number): string => {
  const cats = categoryMap ?? {}
  const parentId = cats[cid]?.pid ?? cid
  return cats[parentId]?.name ?? ''
}

/**
 * @summary 숫자 축약 단위 (내림차순).
 * @description 큰 단위부터 탐색하므로 미리 내림차순으로 둔다 (호출마다 복사 방지).
 */
const UNITS_DESC = [
  { value: 1e16, symbol: '경' },
  { value: 1e12, symbol: '조' },
  { value: 1e8, symbol: '억' },
  { value: 1e4, symbol: '만' },
  { value: 1, symbol: '' },
]

/**
 * @summary 원본 번들 n_format 포팅: 만/억/조 단위 축약 + 유효자릿수 규칙 + 천단위 콤마.
 */
const formatNumber = (value: number | null): string => {
  if (value == null) return '0'
  let digits = 2
  const unit = UNITS_DESC.find((u) => {
    if (u.value <= value) {
      const ratio = value / u.value
      if (ratio >= 10) digits = 1
      if (ratio >= 100) digits = 0
      return true
    }
    return false
  })

  if (!unit) return '0'
  const num = (value / unit.value).toFixed(digits).replace(/\.0+$|(\.[0-9]*[1-9])0+$/, '$1')
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + unit.symbol
}

/**
 * @summary 로그인 여부에 따라 지표 값을 마스킹한다.
 * @description 비로그인이면 "🔒 로그인", 로그인 상태에서 값이 없으면(no_crawl 포함) "-"
 */
const maskedNumber = (value: number | null, authenticated: boolean): string => {
  if (!authenticated) return '🔒 로그인'
  if (value == null) return '-'
  return formatNumber(value)
}

const platformName = (platformId: string): string => PLATFORM_NAMES[platformId]?.name ?? platformId

interface DateTimeParts {
  date: string
  time: string
}

/**
 * @summary 연·월·일·시·분을 화면 표시용 날짜/시간 문자열로 조합한다.
 */
const toDateTimeParts = (
  year: number,
  month: number,
  day: number,
  hour: string,
  minute: string,
): DateTimeParts => {
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()]
  const yy = String(year).slice(-2)
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return { date: `${yy}.${mm}.${dd} (${weekday})`, time: `${hour}:${minute}` }
}

/**
 * @summary 라이브 시작시각 파싱 (10자리 YYMMDDHHmm)
 */
const formatLiveDateTime = (raw: string): DateTimeParts => {
  const s = raw.toString()
  const year = 2000 + Number(s.slice(0, 2))
  const month = Number(s.slice(2, 4))
  const day = Number(s.slice(4, 6))
  return toDateTimeParts(year, month, day, s.slice(6, 8), s.slice(8, 10))
}

/**
 * @summary 홈쇼핑 시작시각 파싱 (12자리 YYYYMMDDHHmm)
 */
const formatHsDateTime = (raw: string): DateTimeParts => {
  const s = raw.toString()
  const year = Number(s.slice(0, 4))
  const month = Number(s.slice(4, 6))
  const day = Number(s.slice(6, 8))
  return toDateTimeParts(year, month, day, s.slice(8, 10), s.slice(10, 12))
}

export interface RawLiveItem {
  objectID: string
  platform_id: string
  datetime_start: string
  product_cnt: number
  visit_cnt: number | null
  sales_cnt: number | null
  sales_amt: number | null
  title: string
  cid: number
}

export interface RawHsItem {
  hsshow_id: string
  hsshow_title: string
  platform_id: string
  hsshow_datetime_start: string
  sales_cnt: number | null
  sales_amt: number | null
  item_cnt: number
  cat: { cid: number; cat_name: string } | null
}

/**
 * @summary 라이브 원시 데이터를 화면 표시용 Broadcast로 변환한다.
 */
export const mapLiveItem = (raw: RawLiveItem, rank: number, authenticated: boolean): Broadcast => {
  const { date, time } = formatLiveDateTime(raw.datetime_start)
  return {
    rank: String(rank),
    title: raw.title,
    platform: platformName(raw.platform_id),
    category: resolveLiveCategory(raw.cid),
    date,
    time,
    visitCount: maskedNumber(raw.visit_cnt, authenticated),
    salesCount: maskedNumber(raw.sales_cnt, authenticated),
    salesAmount: maskedNumber(raw.sales_amt, authenticated),
    productCount: formatNumber(raw.product_cnt),
  }
}

/**
 * @summary 홈쇼핑 원시 데이터를 화면 표시용 Broadcast로 변환한다.
 */
export const mapHsItem = (raw: RawHsItem, rank: number, authenticated: boolean): Broadcast => {
  const { date, time } = formatHsDateTime(raw.hsshow_datetime_start)
  return {
    rank: String(rank),
    title: raw.hsshow_title,
    platform: platformName(raw.platform_id),
    category: raw.cat?.cat_name ?? '',
    date,
    time,
    // 홈쇼핑 "시청률" 컬럼은 원본에서 준비중 상태다. 값이 없음을 🚧로 표시한다
    visitCount: '🚧',
    salesCount: maskedNumber(raw.sales_cnt, authenticated),
    salesAmount: maskedNumber(raw.sales_amt, authenticated),
    productCount: formatNumber(raw.item_cnt),
  }
}
