interface ErrorStateProps {
  // 에러 구분 코드 (AUTH_REQUIRED 등)
  code: string | null
  // 표시할 에러 메시지
  message: string | null
}

// 조회 실패 시 표시하는 에러 상태
// 인증 만료(AUTH_REQUIRED)는 재로그인 안내를 함께 보여준다
export const ErrorState = ({ code, message }: ErrorStateProps) => {
  const isAuthError = code === 'AUTH_REQUIRED'

  return (
    <div className="state error">
      <p>{message ?? '데이터 조회에 실패했습니다.'}</p>
      {isAuthError && (
        <p className="hint">
          BFF를 재시작(<code>pnpm dev</code>)한 뒤 열린 브라우저 창에서 다시 로그인해 주세요.
        </p>
      )}
    </div>
  )
}
