import express from 'express'

// BFF 서버 포트 — Vite dev 서버(5173)가 /api 요청을 이 포트로 프록시한다
const PORT = 5174

const app = express()

// 서버 동작 확인용 엔드포인트
app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`BFF 서버 실행 중: http://localhost:${PORT}`)
})
