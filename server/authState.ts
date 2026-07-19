import { existsSync, readFileSync } from 'node:fs'

// pnpm run login이 저장하는 인증 세션 파일 경로
const AUTH_STATE_PATH = '.playwright/auth.json'

// 원본 API 도메인 — 이 도메인의 쿠키만 전달한다
const ORIGIN_DOMAIN = 'ecomm-data.com'

interface StorageStateCookie {
  name: string
  value: string
  domain: string
  path: string
  expires: number
}

interface StorageState {
  cookies?: StorageStateCookie[]
}

// 저장된 storageState에서 원본 도메인용 Cookie 헤더 문자열을 만든다
// 세션 파일이 없거나 유효한 쿠키가 없으면 null을 반환한다
export const loadAuthCookieHeader = (): string | null => {
  if (!existsSync(AUTH_STATE_PATH)) return null

  try {
    const state = JSON.parse(readFileSync(AUTH_STATE_PATH, 'utf-8')) as StorageState
    const nowSec = Date.now() / 1000

    const cookies = (state.cookies ?? []).filter(
      // expires가 -1이면 세션 쿠키(만료 없음)이다
      (cookie) =>
        cookie.domain.includes(ORIGIN_DOMAIN) && (cookie.expires === -1 || cookie.expires > nowSec),
    )

    if (cookies.length === 0) return null
    return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
  } catch {
    // 파일이 손상된 경우 세션 없음으로 처리한다
    return null
  }
}
