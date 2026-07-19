import { useAssignment } from './hooks/useAssignment.ts'

// Task 9 임시 확인용 화면 — 테이블/탭은 이후 Task에서 구현한다
function App() {
  const { status, data, errorCode, errorMessage } = useAssignment('live')

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>라이브커머스 과제</h1>
      <p>상태: {status}</p>
      {status === 'error' && (
        <p>
          에러({errorCode}): {errorMessage}
        </p>
      )}
      {status === 'success' && (
        <ul>
          {data.map((b) => (
            <li key={b.id}>
              [{b.platform}] {b.title} — 매출 {b.salesAmount ?? '-'}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App
