import { useState } from 'react'
import { AssignmentTabs } from './components/AssignmentTabs.tsx'
import { AssignmentTable } from './components/AssignmentTable.tsx'
import { LoadingState } from './components/LoadingState.tsx'
import { ErrorState } from './components/ErrorState.tsx'
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
      {status === 'loading' && <LoadingState />}
      {status === 'error' && <ErrorState code={errorCode} message={errorMessage} />}
      {status === 'success' && <AssignmentTable data={data} />}
    </div>
  )
}

export default App
