interface ErrorStateProps {
  // 에러 구분 코드 (SESSION_NOT_READY 등)
  code: string | null
  // 표시할 에러 메시지
  message: string | null
}

// 조회 실패 시 표시하는 에러 상태
// 세션 준비 중(SESSION_NOT_READY)에는 잠시 후 재시도 안내를 함께 보여준다
export const ErrorState = ({ code, message }: ErrorStateProps) => {
  const isNotReady = code === 'SESSION_NOT_READY'

  return (
    <div className="state error">
      <p>{message ?? '데이터 조회에 실패했습니다.'}</p>
      {isNotReady && <p className="hint">브라우저 세션을 준비하는 중입니다. 잠시 후 새로고침해 주세요.</p>}
    </div>
  )
}
