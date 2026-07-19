// 프론트엔드가 사용하는 방송 종류 (과제 문서 기준)
export type AssignmentType = 'live' | 'hs'

// 원본 API 응답 - LIVE(lb) 목록 항목
export interface LiveItemRaw {
  objectID: string
  platform_id: string
  datetime_start: string // YYMMDDHHMM 형식
  product_cnt: number
  visit_cnt: number | null
  sales_cnt: number | null
  sales_amt: number | null
  title: string
  cid: number
}

// 원본 API 응답 - 홈쇼핑(hs) 목록 항목
export interface HsItemRaw {
  hsshow_id: string
  platform_id: string
  platform_name: string
  hsshow_title: string
  hsshow_datetime_start: string // YYYYMMDDHHMM 형식
  hsshow_datetime_end: string
  hsshow_url_live: string | null
  item_cnt: number
  cid: number
  visit_cnt: number | null
  sales_cnt: number | null
  sales_amt: number | null
  cat: { cid: number; cat_name: string }
}

// 원본 API 응답 전체 형태
export interface AssignmentResponseRaw {
  list?: unknown[]
  user?: { nickname?: string }
  mask?: boolean
}

// UI에서 사용하는 방송 모델 (LIVE/홈쇼핑 공통)
export interface Broadcast {
  id: string
  platform: string // 플랫폼 이름 또는 식별자
  title: string
  startAt: string // 원본 시작 일시 문자열 (포맷은 표시 계층에서 처리)
  productCount: number
  visitCount: number | null
  salesCount: number | null
  salesAmount: number | null
}
