import { existsSync } from 'node:fs'
import { chromium, type Response } from 'playwright'

// 원본 사이트(라방바 데이터랩) 주소
const ORIGIN = 'https://live.ecomm-data.com'
const SIGN_IN_URL = `${ORIGIN}/user/sign_in`

// 인증 세션(storageState) 저장 경로 — .gitignore에 포함되어 커밋되지 않는다
const AUTH_STATE_PATH = '.playwright/auth.json'

// 사용자가 직접 로그인할 때까지 기다리는 최대 시간 (10분)
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000

// 로그인 API(/api/user/sign_in) 응답이 result=1이면 로그인 성공으로 판단한다
const isSignInSuccess = async (response: Response) => {
  if (!response.url().includes('/api/user/sign_in')) return false
  try {
    const body: unknown = await response.json()
    return typeof body === 'object' && body !== null && (body as { result?: unknown }).result === 1
  } catch {
    // JSON이 아닌 응답은 무시한다
    return false
  }
}

const main = async () => {
  if (existsSync(AUTH_STATE_PATH)) {
    console.log('기존 인증 세션 파일이 있습니다. 로그인 성공 시 덮어씁니다.')
  }

  console.log('브라우저를 실행합니다. 열리는 창에서 직접 로그인해 주세요.')
  console.log('아이디와 비밀번호는 이 프로그램에 저장되지 않습니다.\n')

  // 사용자가 직접 입력해야 하므로 headful 모드로 실행한다
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.goto(SIGN_IN_URL, { waitUntil: 'domcontentloaded' })

    // 로그인 API 응답(result=1)을 감지할 때까지 대기한다
    await page.waitForResponse(isSignInSuccess, { timeout: LOGIN_TIMEOUT_MS })
    console.log('로그인 감지 완료 (sign_in API result=1)')

    // 로그인 쿠키가 포함된 브라우저 세션을 파일로 저장한다 (디렉토리는 자동 생성됨)
    await context.storageState({ path: AUTH_STATE_PATH })
    console.log(`인증 세션 저장 완료: ${AUTH_STATE_PATH}`)
    console.log('이제 pnpm dev로 데이터를 조회할 수 있습니다.')
    console.log('세션이 만료되면 pnpm run login을 다시 실행해 주세요.')
  } catch (error) {
    if (page.isClosed()) {
      console.error('로그인 완료 전에 브라우저가 닫혔습니다. pnpm run login을 다시 실행해 주세요.')
    } else {
      console.error('로그인 감지에 실패했습니다. pnpm run login을 다시 실행해 주세요.')
      console.error(error)
    }
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

void main()
