import { useEffect, useState } from 'react'
import type { AssignmentType, Broadcast } from '../types/assignment.ts'
import { ApiError, fetchAssignment } from '../api/assignmentApi.ts'

/**
 * @summary 조회 상태 (로딩 / 성공 / 에러)
 */
interface AssignmentState {
  status: 'loading' | 'success' | 'error'
  data: Broadcast[]
  /** 인증 만료 등 구분을 위한 에러 코드 */
  errorCode: string | null
  errorMessage: string | null
}

/**
 * @summary 내부 전용 상태.
 * @description 어떤 type의 결과인지 함께 보관해 탭 전환 중 이전 결과를 로딩으로 처리한다.
 */
interface InternalState extends AssignmentState {
  type: AssignmentType
}

const LOADING_STATE: AssignmentState = {
  status: 'loading',
  data: [],
  errorCode: null,
  errorMessage: null,
}

/**
 * @summary 선택된 type의 방송 목록을 조회하는 훅.
 * @description 탭(type) 변경 시 재조회하며, 이전 요청은 취소(abort)하고 렌더 가드로 오래된 응답이 노출되는 것을 막는다.
 */
export const useAssignment = (type: AssignmentType): AssignmentState => {
  const [result, setResult] = useState<InternalState>({ ...LOADING_STATE, type })

  useEffect(() => {
    const controller = new AbortController()

    fetchAssignment(type, controller.signal)
      .then((data) => {
        setResult({ type, status: 'success', data, errorCode: null, errorMessage: null })
      })
      .catch((error: unknown) => {
        // 탭 전환으로 요청이 취소된 경우는 상태를 갱신하지 않는다
        if (controller.signal.aborted) return

        const code = error instanceof ApiError ? error.code : 'NETWORK_ERROR'
        const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
        setResult({ type, status: 'error', data: [], errorCode: code, errorMessage: message })
      })

    return () => controller.abort()
  }, [type])

  // 아직 이전 type의 결과라면 로딩으로 간주한다
  if (result.type !== type) return LOADING_STATE

  return {
    status: result.status,
    data: result.data,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
  }
}
