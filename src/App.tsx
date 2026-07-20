import { AssignmentTable } from './components/AssignmentTable.tsx'
import { useAssignment } from './hooks/useAssignment.ts'
import './App.css'

// Task 10 확인용 화면 — 탭/에러 상태 컴포넌트는 이후 Task에서 구현한다
function App() {
  const { status, data, errorCode, errorMessage } = useAssignment('live')

  return (
    <div className="app">
      <h1>라이브커머스 방송 목록</h1>
      {status === 'loading' && <p>불러오는 중…</p>}
      {status === 'error' && (
        <p className="error">
          에러({errorCode}): {errorMessage}
        </p>
      )}
      {status === 'success' && <AssignmentTable data={data} />}
    </div>
  )
}

export default App
