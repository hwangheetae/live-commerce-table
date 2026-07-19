import { loadAuthCookieHeader } from './authState.ts'

export type AssignmentType = 'live' | 'hs'

const ORIGIN_API_URL = 'https://live.ecomm-data.com/api/assignment/list'

// 인증 세션이 없거나 만료된 경우
export class AuthRequiredError extends Error {}

// 원본 API가 예기치 않은 응답을 반환한 경우
export class UpstreamError extends Error {}

// 응답 어딘가에 mask=true가 있으면 마스킹된(비로그인) 응답으로 판단한다
const hasContainMask = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(hasContainMask)

  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    if (record.mask === true) return true
    return Object.values(record).some(hasContainMask)
  }
  return false
}

// 저장된 인증 쿠키로 원본 API를 호출해 방송 목록을 가져온다
export const fetchAssignmentList = async (type: AssignmentType): Promise<unknown> => {
  const cookieHeader = loadAuthCookieHeader()
  if (!cookieHeader) throw new AuthRequiredError('인증 세션 파일이 없거나 만료되었습니다')

  const response = await fetch(ORIGIN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify({ type }),
  })

  // 비로그인/세션 만료 시 원본이 401을 반환하는 것을 확인함
  if (response.status === 401 || response.status === 403) {
    throw new AuthRequiredError(`원본 API 인증 실패 (status ${response.status})`)
  }

  if (!response.ok) {
    throw new UpstreamError(`원본 API 오류 (status ${response.status})`)
  }

  const data: unknown = await response.json()

  // 인증은 통과했지만 값이 마스킹된 경우도 세션 만료로 간주한다
  if (hasContainMask(data)) throw new AuthRequiredError('마스킹된 응답 (mask=true)')

  return data
}
