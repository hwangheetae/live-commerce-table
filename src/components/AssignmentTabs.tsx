import type { AssignmentType } from '../types/assignment.ts'

interface AssignmentTabsProps {
  // 현재 선택된 탭
  active: AssignmentType
  // 탭 변경 콜백
  onChange: (type: AssignmentType) => void
}

// 탭 정의 (원본 페이지의 LIVE / 홈쇼핑 구분)
const TABS: { type: AssignmentType; label: string }[] = [
  { type: 'live', label: 'LIVE' },
  { type: 'hs', label: '홈쇼핑' },
]

// LIVE / 홈쇼핑 탭 전환 UI
export const AssignmentTabs = ({ active, onChange }: AssignmentTabsProps) => {
  return (
    <div className="tabs" role="tablist">
      {TABS.map(({ type, label }) => (
        <button
          key={type}
          type="button"
          role="tab"
          aria-selected={active === type}
          className={`tab${active === type ? ' active' : ''}`}
          onClick={() => onChange(type)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
