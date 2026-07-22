import type { Broadcast } from '../types/assignment.ts'

interface AssignmentTableProps {
  data: Broadcast[]
}

// 방송 목록을 원본 과제 테이블과 동일한 레이아웃으로 표시한다
export const AssignmentTable = ({ data }: AssignmentTableProps) => {
  if (data.length === 0) return <p>표시할 방송이 없습니다.</p>

  return (
    <table className="assignment-table">
      <thead>
        <tr>
          <th className="rank" />
          <th>방송정보</th>
          <th>분류</th>
          <th>방송시간</th>
          <th className="num">조회수</th>
          <th className="num">판매량</th>
          <th className="num">매출액</th>
          <th className="num">상품수</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item) => (
          <tr key={`${item.rank}-${item.title}`}>
            <td className="rank">{item.rank}</td>
            <td className="info">
              <div className="title">{item.title}</div>
              <div className="platform">{item.platform}</div>
            </td>
            <td>{item.category}</td>
            <td className="datetime">
              <div>{item.date}</div>
              <div className="time">{item.time}</div>
            </td>
            <td className="num">{item.visitCount}</td>
            <td className="num">{item.salesCount}</td>
            <td className="num">{item.salesAmount}</td>
            <td className="num">{item.productCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
