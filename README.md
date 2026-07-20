# 라이브커머스 방송 목록 테이블

원본 사이트(live.ecomm-data.com)의 **LIVE / 홈쇼핑** 방송 목록을 실시간으로 조회해 테이블로 표시하는 과제입니다. 정적 스냅샷이 아니라, 원본 페이지가 렌더한 테이블을 조회 시점에 그대로 가져옵니다.

**로그인은 선택 사항입니다.** 비로그인 상태에서도 목록이 표시되며(조회수·판매량·매출액 등 지표는 자물쇠로 마스킹), 열린 창에서 직접 로그인하면 다음 조회부터 전체 값이 표시됩니다.

## 스택

- React 19 + TypeScript(strict) + Vite
- BFF: Express + Playwright (tsx 실행)
- pnpm / Node 24

## 동작 구조

```
브라우저(React)  ──/api──▶  로컬 BFF(Express, :5174)  ──▶  원본 사이트(Playwright 브라우저)
```

- React 앱은 **로컬 BFF만** 호출합니다. 원본 도메인을 직접 부르지 않습니다(CORS·쿠키·봇 차단 회피).
- BFF는 Playwright로 실제 Chromium을 띄워 원본 `/assignment` 페이지를 열어 둡니다. 조회 시 그 페이지에서 탭 버튼을 클릭하고, 렌더된 테이블을 스크래핑해 값을 그대로 반환합니다. 따라서 화면 값이 원본 과제 테이블과 항상 동일합니다.
- 로그인은 강제하지 않습니다. 사용자가 그 창에서 **직접 로그인**하면 전체 지표가 보이며, 계정 정보는 저장·하드코딩하지 않습니다.
- 5173에서 탭을 전환하면 BFF가 실제 Chromium의 탭 버튼을 클릭하므로, 열린 창에서도 탭이 함께 전환됩니다(스크래핑 방식의 정상 동작).

> 원본 서버는 TLS 지문 기반으로 일반 fetch(undici)를 차단하므로, 실제 브라우저 컨텍스트를 소유하는 BFF 방식을 사용합니다.

## 사전 준비

```bash
pnpm install
pnpm exec playwright install chromium
```

## 실행

```bash
pnpm dev
```

- BFF와 Vite가 함께 실행됩니다.
- BFF가 Chromium 창을 띄우고, 콘솔에 `데이터 조회 준비 완료.`가 뜨면 준비된 것입니다. **로그인 없이 바로 목록을 볼 수 있습니다.**
- 전체 지표를 보려면 그 Chromium 창에서 직접 로그인하세요. 로그인 후에는 다음 조회부터 전체 값이 표시됩니다.
- 브라우저에서 `http://localhost:5173` 접속 → 상단 LIVE / 홈쇼핑 탭으로 목록을 확인합니다. (각 목록 최대 10개)

## 세션 유지 / 만료

- 원본 세션은 슬라이딩 TTL이 짧아, BFF가 20초 간격으로 실제 조회를 보내 세션을 갱신합니다.
- 로그인 세션이 만료되면 다시 비로그인(마스킹) 상태가 됩니다. 열린 창에서 다시 로그인하면 전체 값이 복구됩니다.
- 원본은 단일 세션 정책이라, 다른 브라우저에서 같은 계정으로 로그인하면 BFF 세션이 끊길 수 있습니다.

## 인증 파일

- 로그인 상태는 `.playwright/auth.json`에 저장되며 `.gitignore`로 제외됩니다. 저장소에 커밋되지 않습니다.

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `pnpm dev` | BFF + Vite 동시 실행 |
| `pnpm build` | 타입 체크 + 프로덕션 빌드 |
| `pnpm lint` | ESLint 검사 |
| `pnpm format` | Prettier 포맷팅 |

## 프로젝트 구조

```
src/
  components/  AssignmentTabs, AssignmentTable, LoadingState, ErrorState
  hooks/       useAssignment      # 조회 상태 관리, 탭 전환 시 재조회
  api/         assignmentApi      # 로컬 BFF 호출
  types/       assignment
server/
  index.ts           # Express 라우트 (/api/assignment, /api/health)
  assignmentProxy.ts # Playwright 세션 관리 + 테이블 스크래핑
  authState.ts       # 인증 파일 경로 관리
```
