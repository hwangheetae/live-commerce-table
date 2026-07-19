import express from 'express'
import {
  AuthRequiredError,
  closeBrowser,
  fetchAssignmentList,
  initSession,
  isSessionReady,
} from './assignmentProxy.ts'

// BFF 서버 포트 — Vite dev 서버(5173)가 /api 요청을 이 포트로 프록시한다
const PORT = 5174

const app = express()

// 서버 동작 확인용 엔드포인트 — 세션 준비 여부도 함께 알린다
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, sessionReady: isSessionReady() })
})

// 방송 목록 조회 — 원본 API를 인증 쿠키와 함께 프록시한다
app.get('/api/assignment', async (req, res) => {
  const { type } = req.query
  if (type !== 'live' && type !== 'hs') {
    res.status(400).json({ code: 'INVALID_TYPE', message: 'type은 live 또는 hs여야 합니다.' })
    return
  }

  try {
    const data = await fetchAssignmentList(type)
    res.json(data)
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      res.status(401).json({
        code: 'AUTH_REQUIRED',
        message: '인증 세션이 만료되었습니다. BFF를 재시작(pnpm dev)하여 다시 로그인해 주세요.',
      })
      return
    }
    console.error('원본 API 호출 실패:', error)
    res.status(502).json({ code: 'UPSTREAM_ERROR', message: '원본 API 호출에 실패했습니다.' })
  }
})

app.listen(PORT, () => {
  console.log(`BFF 서버 실행 중: http://localhost:${PORT}`)
  // 브라우저를 띄우고 로그인 세션을 확보한다 (필요 시 사용자가 직접 로그인)
  initSession().catch((error) => {
    console.error('세션 초기화 실패:', error)
  })
})

// 서버 종료 시 Chromium 브라우저를 정리한다
const shutdown = () => {
  void closeBrowser().finally(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
