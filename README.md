# 라이브커머스 방송 목록 테이블

원본 사이트(live.ecomm-data.com)의 **LIVE / 홈쇼핑** 방송 목록을 실시간으로 조회해 테이블로 표시하는 과제입니다. 정적 스냅샷이 아니라, 원본 `/api/assignment/list`를 조회 시점에 직접 호출해 값을 그대로 가져옵니다.

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
- BFF는 Playwright로 실제 Chromium을 띄워 원본 `/assignment` 페이지를 열어 둡니다(로그인 UX·세션 유지 목적). 조회 시에는 그 브라우저 컨텍스트로 원본 `/api/assignment/list`를 **JSON으로 직접 호출**하고, 응답 원시값(`platform_id`, `cid`, `datetime_start` 등)을 원본 페이지의 렌더 로직과 동일하게 서버에서 가공해 반환합니다(플랫폼명, 카테고리명, 날짜/요일/시간, 숫자 단위 축약, 로그인 마스킹). 이 가공 로직은 `server/broadcastMapper.ts`에 있습니다.
- 로그인은 강제하지 않습니다. 사용자가 그 창에서 **직접 로그인**하면 전체 지표가 보이며, 계정 정보는 저장·하드코딩하지 않습니다.

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
  index.ts            # Express 라우트 (/api/assignment, /api/health)
  assignmentProxy.ts  # Playwright 세션 관리 + /api/assignment/list 직접 호출
  broadcastMapper.ts  # 원본 렌더 로직 재현 (플랫폼명/카테고리/날짜·시간/숫자 포맷/마스킹)
```
