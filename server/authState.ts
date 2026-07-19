import { existsSync } from 'node:fs'

// pnpm run login이 저장하는 인증 세션(storageState) 파일 경로
export const AUTH_STATE_PATH = '.playwright/auth.json'

// 인증 세션 파일이 존재하는지 확인한다
export const hasAuthState = (): boolean => existsSync(AUTH_STATE_PATH)
