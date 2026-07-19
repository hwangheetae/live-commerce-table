import type {
  AssignmentResponseRaw,
  AssignmentType,
  Broadcast,
  HsItemRaw,
  LiveItemRaw,
} from '../types/assignment.ts'

// 각 목록은 최대 10개까지만 표시한다 (과제 요구사항)
const MAX_ITEMS = 10

// 값이 객체인지 확인하는 타입 가드
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

// LIVE(lb) 원본 항목을 UI 모델로 변환한다
const mapLiveItem = (raw: LiveItemRaw): Broadcast => ({
  id: raw.objectID,
  platform: raw.platform_id,
  title: raw.title,
  startAt: raw.datetime_start,
  productCount: raw.product_cnt,
  visitCount: raw.visit_cnt,
  salesCount: raw.sales_cnt,
  salesAmount: raw.sales_amt,
})

// 홈쇼핑(hs) 원본 항목을 UI 모델로 변환한다
const mapHsItem = (raw: HsItemRaw): Broadcast => ({
  id: raw.hsshow_id,
  platform: raw.platform_name,
  title: raw.hsshow_title,
  startAt: raw.hsshow_datetime_start,
  productCount: raw.item_cnt,
  visitCount: raw.visit_cnt,
  salesCount: raw.sales_cnt,
  salesAmount: raw.sales_amt,
})

// LIVE 항목의 필수 필드가 존재하는지 검증한다
const isLiveItem = (value: unknown): value is LiveItemRaw =>
  isRecord(value) && typeof value.objectID === 'string' && typeof value.title === 'string'

// 홈쇼핑 항목의 필수 필드가 존재하는지 검증한다
const isHsItem = (value: unknown): value is HsItemRaw =>
  isRecord(value) && typeof value.hsshow_id === 'string' && typeof value.hsshow_title === 'string'

// 원본 응답을 UI 모델 목록으로 변환한다 (최대 10개)
export const mapAssignment = (type: AssignmentType, raw: AssignmentResponseRaw): Broadcast[] => {
  const list = Array.isArray(raw.list) ? raw.list : []

  if (type === 'live') {
    return list.filter(isLiveItem).slice(0, MAX_ITEMS).map(mapLiveItem)
  }
  return list.filter(isHsItem).slice(0, MAX_ITEMS).map(mapHsItem)
}
