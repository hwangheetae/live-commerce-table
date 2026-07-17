import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 브라우저의 /api 요청을 로컬 BFF 서버로 전달한다 (원본 API 직접 호출 금지)
    proxy: {
      '/api': 'http://localhost:5174',
    },
  },
})
