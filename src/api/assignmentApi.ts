import type { AssignmentResponseRaw, AssignmentType, Broadcast } from '../types/assignment.ts'
import { mapAssignment } from './assignmentMapper.ts'

// BFF가 반환하는 에러 응답 형태
interface ApiErrorBody {
  code?: string
  message?: string
}

// BFF 에러(AUTH_REQUIRED 등)를 표현하는 에러 클래스
export class ApiError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

// 로컬 BFF(/api/assignment)를 통해 방송 목록을 조회한다
// 브라우저에서 원본 API를 직접 호출하지 않고 반드시 BFF를 경유한다
export const fetchAssignment = async (
  type: AssignmentType,
  signal: AbortSignal,
): Promise<Broadcast[]> => {
  const res = await fetch(`/api/assignment?type=${type}`, { signal })
  const data: unknown = await res.json()

  if (!res.ok) {
    const body = (data ?? {}) as ApiErrorBody
    throw new ApiError(body.code ?? 'UNKNOWN', body.message ?? '데이터 조회에 실패했습니다.')
  }

  return mapAssignment(type, data as AssignmentResponseRaw)
}
