# HumbleB Quality Gates

Phase별 완료 기준. 각 gate를 통과해야 다음 phase 진행.

---

## Phase 1: 뼈대 + 참가신청

### Backend Gate
- [ ] FastAPI 서버 기동 (localhost:8200), `/health` 200 응답
- [ ] nginx 프록시 동작: `https://vesper.sogang.ac.kr/humbleb/api/health` 200
- [ ] DB 마이그레이션 실행 (Member, Schedule, Attendance 테이블 생성)
- [ ] 멤버 시드 데이터 30명 삽입 확인
- [ ] 카카오 OAuth 플로우 동작 (로그인 → JWT httpOnly 쿠키 → /api/members/me 본인 반환)
- [ ] 첫 로그인 시 멤버 매핑 (`POST /api/members/link`) 동작
- [ ] `GET /api/schedules/upcoming` — 일정 리스트 반환
- [ ] `POST /api/schedules/:id/attend` — full/late/early 참가 신청
- [ ] late + early 동시 선택 시 400 에러
- [ ] `DELETE /api/schedules/:id/attend` — 취소 (CLOSED 상태면 403)
- [ ] 정원 초과 시 참가 신청 거부 (409)
- [ ] 미인증 요청 시 401
- [ ] CORS: Vercel 도메인만 허용

### Frontend Gate
- [ ] 카카오 로그인 버튼 → OAuth 플로우 → 메인 화면 리다이렉트
- [ ] 첫 로그인: 멤버 선택 화면 → 매핑 완료 → 메인 화면
- [ ] 메인 화면: 정모 카드 리스트 렌더링 (날짜, 시간, 장소, 상태, 인원수)
- [ ] 참가/불참 버튼 동작 (기본 full, 바텀시트에서 late/early 선택)
- [ ] 참가자 리스트 표시 (이름, 시간대, 코멘트)
- [ ] Optimistic UI: 참가 탭 즉시 반영, 실패 시 롤백 + 토스트
- [ ] 스켈레톤 스크린: 300ms 초과 로딩 시 shimmer 표시
- [ ] 모바일 뷰포트(375px)에서 레이아웃 깨짐 없음
- [ ] 터치 타겟 48×48px 이상, input 폰트 16px 이상

### 카카오톡 인앱 브라우저 Gate
- [ ] 카톡 인앱 브라우저에서 OAuth 플로우 정상 동작
- [ ] `position: fixed` 대신 `sticky` 사용 확인
- [ ] `alert()`/`confirm()` 미사용 확인
- [ ] `dvh` 뷰포트 단위 사용 확인

### Integration Gate
- [ ] 카카오 로그인 → 참가 신청 → 참가자 리스트에 본인 노출 — E2E 동작
- [ ] 다른 계정으로 동일 멤버 매핑 시도 시 에러 처리

---

## Phase 2: 운영진 기능

### Backend Gate
- [ ] 운영진 전용 API에 일반 멤버 접근 시 403
- [ ] `POST /api/schedules` — 일정 생성 (제목, 날짜, 시간, 장소, 코트, 정원)
- [ ] `PUT /api/schedules/:id` — 일정 수정
- [ ] `DELETE /api/schedules/:id` — 일정 삭제
- [ ] 반복일정 생성 시 다음 주 일정 자동 생성
- [ ] `POST /api/schedules/:id/guests` — 게스트 등록
- [ ] 상태 자동 전환 스케줄러 동작:
  - [ ] 수요일 15:00: MEMBER_OPEN → GUEST_OPEN 또는 CLOSED
  - [ ] GUEST_OPEN에서 정원 도달 → CLOSED
  - [ ] 정모 당일 → CLOSED 강제
- [ ] 강제 참가/취소 처리 API

### Frontend Gate
- [ ] 운영진 페이지 접근 — 일반 멤버는 접근 불가 (리다이렉트)
- [ ] 운영진 액션은 오버플로우 메뉴(⋮)로 노출 (별도 페이지 아님)
- [ ] 일정 CRUD UI 동작
- [ ] 게스트 등록 폼 (이름, 성별, 실력 — 바텀시트)
- [ ] 카톡 공유 텍스트 복사 버튼 — 클립보드 복사 + 토스트 (2초)
- [ ] 복사된 텍스트에 일시, 장소, 인원, 링크 포함

---

## Phase 3: 대진표

### Backend Gate
- [ ] `POST /api/schedules/:id/matchmaking` — DRAFT 대진표 생성
- [ ] 알고리즘 결과 검증:
  - [ ] 시간 제약 위반 없음 (늦참자가 불참 라운드에 배정되지 않음)
  - [ ] 게임 수 균형: 전원 동일 또는 경고 반환
  - [ ] 운영진 제약조건(pair_exclude 등) 반영
  - [ ] NTRP 밸런스: 팀간 차이 합리적 범위
- [ ] 12명 7라운드 생성 시간 < 3초
- [ ] `POST /api/schedules/:id/matches/confirm` — DRAFT → CONFIRMED
- [ ] `GET /api/schedules/:id/matches` — 일반 멤버에게 CONFIRMED만 노출
- [ ] `PUT /api/schedules/:id/matches` — 수동 수정 (DRAFT, CONFIRMED 모두)
- [ ] 제약조건 변경 후 재생성 시 기존 DRAFT 교체

### Frontend Gate
- [ ] 운영진: 라운드 수 입력 + 제약조건 UI → 대진표 생성
- [ ] 제약조건 추가/삭제 UI (바텀시트에서 타입 선택 → 멤버 선택)
- [ ] DRAFT 미리보기: 라운드별 코트별 매치 카드
- [ ] hard 제약 불충족 경고 표시
- [ ] 드래그앤드롭 선수 스왑 (롱프레스 500ms → 드래그)
- [ ] 컨펌 버튼 → 공개
- [ ] 멤버 대진표 조회 화면 (CONFIRMED만)

---

## Phase 4: 경기결과 + 레이팅

### Backend Gate
- [ ] `PUT /api/games/:id/result` — 스코어 입력
- [ ] 매치 참가자 4명 + 운영진만 입력 가능 (그 외 403)
- [ ] 결과 기반 ELO 레이팅 업데이트 (internal_rating)
- [ ] 중복 입력 시 기존 값 덮어쓰기

### Frontend Gate
- [ ] 정모 ±1시간 + 참가자: 메인 화면이 대진표 뷰로 전환
- [ ] 미참가자: 카드 리스트 유지
- [ ] 스코어 입력: `inputmode="numeric"`, 탭 영역 56×56px
- [ ] Optimistic UI: 입력 즉시 반영

---

## Phase 5: 폴리시

### Gate
- [ ] 모바일 최적화: 320px~428px 레이아웃 정상
- [ ] 터치 타겟 48px 이상 (전체 앱 감사)
- [ ] 대진표 이미지 다운로드 (PNG, 카톡 공유용)
- [ ] 과거 정모 히스토리 조회
- [ ] 멤버별 통계 (승률, 게임 수)
- [ ] 메인 화면 로딩 < 2초 (모바일 4G 시뮬레이션)
- [ ] 카카오톡 인앱 브라우저 전체 플로우 테스트 통과

---

## 공통 Quality Gates (모든 Phase)

### 코드 품질
- [ ] TypeScript strict mode, no `any` 타입
- [ ] Python type hints 사용
- [ ] 린터 에러 0개 (ESLint, Ruff)

### 테스트
- [ ] 백엔드: 주요 API 엔드포인트 테스트 (pytest)
- [ ] 대진표 알고리즘: 제약조건별 유닛 테스트
- [ ] 프론트엔드: 핵심 컴포넌트 테스트

### 보안
- [ ] JWT httpOnly 쿠키
- [ ] 운영진 API 권한 체크
- [ ] SQL injection 방어 (ORM 사용)
- [ ] XSS 방어 (React 기본 이스케이핑)
- [ ] CORS: Vercel 도메인만 허용

### UI/UX 공통
- [ ] 빈 화면 금지 (로딩 시 스켈레톤)
- [ ] 모든 모달 → 바텀시트 (파괴적 작업만 센터 다이얼로그)
- [ ] 토스트: 에러 4초, 성공 2초
- [ ] `vh` 미사용 (`dvh` 사용)
- [ ] `alert()`/`confirm()`/`prompt()` 미사용
