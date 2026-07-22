// 방송 종류 (과제 문서 기준)
export type AssignmentType = 'live' | 'hs'

// 방송 정보 — 원본 API 원시값을 표시용 문자열로 가공한 결과
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
