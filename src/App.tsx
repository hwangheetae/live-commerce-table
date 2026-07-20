import { useState } from 'react'
import { AssignmentTabs } from './components/AssignmentTabs.tsx'
import { AssignmentTable } from './components/AssignmentTable.tsx'
import { useAssignment } from './hooks/useAssignment.ts'
import type { AssignmentType } from './types/assignment.ts'
import './App.css'

// LIVE / 홈쇼핑 탭을 전환하며 방송 목록을 표시한다
function App() {
  const [type, setType] = useState<AssignmentType>('live')
  const { status, data, errorCode, errorMessage } = useAssignment(type)

  return (
    <div className="app">
      <h1>라이브커머스 방송 목록</h1>
      <AssignmentTabs active={type} onChange={setType} />
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
