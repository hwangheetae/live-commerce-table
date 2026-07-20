// 프론트엔드가 사용하는 방송 종류 (과제 문서 기준)
export type AssignmentType = 'live' | 'hs'

// 방송 정보 — 원본 과제 페이지 테이블이 렌더링한 텍스트를 그대로 담는다
// (값 가공 없이 스크래핑하므로 과제 테이블과 항상 동일하다)
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
