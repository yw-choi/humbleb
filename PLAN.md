# HumbleB Tennis Club — Full Rewrite Plan

## Overview

HumbleB 테니스 클럽 운영 웹앱. 기존 Django SSR → Next.js + FastAPI 풀 리라이트.
핵심 가치: **참가신청 셀프서비스 + 대진표 자동생성 + 경기결과 기록**

- 기존 서비스: https://humbleb-tennis.up.railway.app/
- 기존 코드: https://github.com/jiyeoon/xmas_side
- 멤버 수: ~30명 (남 18, 여 12)
- 인증: 카카오 로그인. 카카오 계정 ↔ 멤버 매핑.

---

## 1. 정모 구조

### 정기 일정

| 요일 | 시간 | 장소 | 코트 | 정원 |
|------|------|------|------|------|
| 토요일 타임1 | 10:00-12:30 | 한강중학교 | 2면 | 12명 |
| 토요일 타임2 | 12:30-15:00 | 한강중학교 | 2면 | 12명 |
| 일요일 | 11:00-14:00 | 반포종합운동장 | 2면 | 12명 |

- 토요일 두 타임은 독립 일정. 중복 참가 허용.
- 정원은 일정별로 운영진이 설정 가능.

### 참가신청 상태 머신 (일정별)

```
CREATED
  → MEMBER_OPEN (생성 즉시)
    - 멤버만 신청/취소 가능
    - 게스트 등록 불가
  → 수요일 15:00 자동 전환
    ├─ 정원 미달 → GUEST_OPEN
    │   - 게스트 모집 (운영진만 등록)
    │   - 멤버 추가 신청 가능
    │   - 멤버 취소 가능
    │   - 정원 도달 시 → CLOSED
    └─ 정원 도달 → CLOSED
  → 정모 당일 → CLOSED (아직 안 닫혔으면 강제)
```

### 상태 전환 구현 방식

- **Lazy evaluation**: API 호출 시 현재 시간 기준으로 상태를 자동 계산/업데이트
  - 정모 당일 이후 → CLOSED
  - 수요일 15:00 이후 + 정원 미달 → GUEST_OPEN
  - 정원 도달 → CLOSED
- APScheduler는 보조 수단 (서버 재시작 후에도 상태 정합성 보장)
- 프론트에서 표시할 때도 서버가 반환한 최신 상태를 사용

---

## 2. 화면 설계

### 2.1 메인 화면 (`/`)

컨텍스트 어웨어 — 시간 + 참가 여부에 따라 기본 화면 전환.

**평소 (기본)**: 다가오는 정모 카드 리스트

```
[이번 주 정모]

┌─ 토 3/29 ──────────────────────┐
│ 10:00-12:30  한강중학교          │
│ 🟢 멤버신청중  8/12명           │
│ [참가] [불참]                   │
│                                │
│ 12:30-15:00  한강중학교          │
│ 🟢 멤버신청중  5/12명           │
│ [참가] [불참]                   │
└────────────────────────────────┘

┌─ 일 3/30 ──────────────────────┐
│ 11:00-14:00  반포종합운동장      │
│ 🟡 게스트모집  11/12명          │
│ [참가] [불참]                   │
└────────────────────────────────┘
```

**정모 ±1시간 (참가자에게만)**: 대진표 조회 + 경기결과 입력

```
┌─ 오늘의 대진표 ────────────────┐
│ Round 1                       │
│ ┌─ Court A ──────────────┐    │
│ │ 영우·지연 vs 홍균·가영   │    │
│ │ [ 6 ] : [ 4 ]  [입력]  │    │
│ └────────────────────────┘    │
│ ┌─ Court B ──────────────┐    │
│ │ 성환·서윤 vs 준형·희주   │    │
│ │ [  ] : [  ]  [입력]    │    │
│ └────────────────────────┘    │
│                               │
│ Round 2 ...                   │
└────────────────────────────────┘
```

- 참가 안 한 사람은 정모 시간에도 기본 화면 유지.

### 2.2 정모 상세 (`/schedule/[id]`)

- 정모 정보 (날짜, 시간, 장소, 코트 수)
- 현재 상태 뱃지 (멤버신청중 / 게스트모집 / 마감)
- 참가자 리스트 (이름, 참가시간대, 코멘트, 신청시간)
- 참가/취소 버튼

### 2.3 대진표 (`/schedule/[id]/matches`)

- 라운드별 코트별 매치 카드
- 경기결과 입력 (참가자 4명 중 아무나 입력 가능)
- 스코어: 숫자 탭 입력
- 중복 입력 시 먼저 입력된 것 우선, 수정 가능

### 2.4 운영진 페이지 (`/admin`)

- 일정 CRUD (반복일정 지원)
- 게스트 등록 (이름, 성별, 대략적 실력)
- 강제 취소 / 참가 처리
- 대진표 생성 버튼 → 미리보기(DRAFT) → 컨펌 → 공개
- 대진표 수동 수정 (드래그앤드롭으로 선수 스왑)
- 제약조건 추가 후 재생성 (UI에서 선택):
  - 같은 팀 금지/선호: 멤버 2명 선택
  - 상대 매칭 금지: 멤버 2명 선택
  - 특정 라운드 쉼/시작: 멤버 + 라운드 선택
- 멤버 관리 (NTRP, 상태 등)
- 카톡 공유용 정모 안내 텍스트 복사 버튼

### 2.5 인증 (카카오 로그인)

- 첫 방문: 카카오 로그인 버튼 → OAuth 인증 → 카카오 ID 획득
- 첫 로그인 시: 멤버 리스트에서 본인 이름 선택 (카카오 계정 ↔ 멤버 매핑, 1회)
- 이후: 카카오 로그인만 하면 자동 인식. 다른 기기에서도 동일.
- 세션: JWT 토큰 → httpOnly 쿠키 저장
- 운영진 여부는 Member 모델의 is_admin 플래그로 판별.

---

## 3. 데이터 모델

### Member

```
id: UUID (PK)
name: str (unique)
gender: enum (M, F)
ntrp: float (1.0~7.0, 0.5 단위)
internal_rating: float (내부 ELO, 초기값 1500)
status: enum (ACTIVE, INACTIVE)
is_admin: bool
kakao_id: str (nullable, 카카오 OAuth 연동 후 세팅)
created_at: datetime
```

### Schedule

```
id: UUID (PK)
title: str
date: date
start_time: time
end_time: time
venue: str
court_count: int (default 2)
capacity: int (default 12)
status: enum (MEMBER_OPEN, GUEST_OPEN, CLOSED)
registration_deadline: datetime (기본: 해당 주 수요일 15:00)
recurrence_rule: str (nullable, RRULE 형식 또는 단순 weekly)
parent_schedule_id: UUID (nullable, 반복일정의 원본)
created_at: datetime
```

### Attendance

```
id: UUID (PK)
schedule_id: UUID (FK → Schedule)
member_id: UUID (FK → Member)
arrival_time: time (기본=일정 시작시간, 늦참 시 +30분)
departure_time: time (기본=일정 종료시간, 일퇴 시 -30분)
# 늦참/일퇴 동시 선택 불가. 둘 중 하나만.
comment: str (nullable, max 100자)
created_at: datetime
updated_at: datetime

UNIQUE(schedule_id, member_id)
```

### Guest

```
id: UUID (PK)
schedule_id: UUID (FK → Schedule)
name: str
gender: enum (M, F)
estimated_skill: enum (BEGINNER, INTERMEDIATE, ADVANCED)
registered_by: UUID (FK → Member, 운영진)
created_at: datetime
```

### Matchmaking

```
id: UUID (PK)
schedule_id: UUID (FK → Schedule)
status: enum (DRAFT, CONFIRMED)
constraints: JSON (nullable, 구조화된 제약조건)
created_at: datetime
confirmed_at: datetime (nullable)
```

### MatchRound

```
id: UUID (PK)
matchmaking_id: UUID (FK → Matchmaking)
round_number: int
created_at: datetime
```

### Game

```
id: UUID (PK)
round_id: UUID (FK → MatchRound)
court: str ("A", "B", ...)
team_a_player1_id: UUID (FK → Member or Guest)
team_a_player2_id: UUID (FK → Member or Guest)
team_b_player1_id: UUID (FK → Member or Guest)
team_b_player2_id: UUID (FK → Member or Guest)
team_a_player1_type: enum (MEMBER, GUEST)
team_a_player2_type: enum (MEMBER, GUEST)
team_b_player1_type: enum (MEMBER, GUEST)
team_b_player2_type: enum (MEMBER, GUEST)
score_a: int (nullable)
score_b: int (nullable)
submitted_by: UUID (nullable, FK → Member)
created_at: datetime
updated_at: datetime
```

> Note: player type 구분은 polymorphic FK 대신 type 컬럼으로 처리. 단순하게.

---

## 4. API 설계

### 인증

- 카카오 OAuth 2.0 → JWT 세션 (httpOnly 쿠키)
- 첫 로그인 시 카카오 ID ↔ 멤버 매핑 (본인 이름 선택)
- 운영진 엔드포인트는 `is_admin=True` 체크.

### 엔드포인트

#### 인증

```
GET    /api/auth/kakao           — 카카오 OAuth 로그인 URL 반환
GET    /api/auth/kakao/callback  — 카카오 콜백 → JWT 발급 → 쿠키 세팅 → 프론트 리다이렉트
POST   /api/auth/logout          — 세션 쿠키 삭제
# Redirect URI: https://vesper.sogang.ac.kr/humbleb/api/auth/kakao/callback
```

#### 멤버

```
GET    /api/members              — 전체 멤버 리스트
GET    /api/members/me           — JWT 기반 본인 정보
POST   /api/members/link         — 첫 로그인 시 카카오 계정 ↔ 멤버 매핑
                                   body: { member_id: UUID }
                                   response: { member: Member }
```

#### 일정

```
GET    /api/schedules/upcoming   — 다가오는 일정 리스트 (참가현황 포함)
GET    /api/schedules/:id        — 일정 상세 (참가자 리스트 포함)
POST   /api/schedules            — 일정 생성 (운영진)
PUT    /api/schedules/:id        — 일정 수정 (운영진)
DELETE /api/schedules/:id        — 일정 삭제 (운영진)
```

#### 참가신청

```
POST   /api/schedules/:id/attend — 참가 신청
                                   body: {
                                     type: "full" | "late" | "early",
                                     # late: 시작+30분, early: 종료-30분, 동시 선택 불가
                                     comment?: str
                                   }
DELETE /api/schedules/:id/attend — 참가 취소 (CLOSED 전까지 가능)
```

#### 게스트

```
POST   /api/schedules/:id/guests — 게스트 등록 (운영진)
                                   body: { name, gender, estimated_skill }
DELETE /api/guests/:id           — 게스트 삭제 (운영진)
```

#### 대진표

```
POST   /api/schedules/:id/matchmaking — 대진표 생성 → DRAFT 상태 (운영진)
                                        body: {
                                          round_count: int,
                                          constraints?: Constraint[]
                                        }
                                        Constraint: {
                                          type: "pair_exclude" | "pair_prefer" |
                                                "opponent_exclude" | "round_skip" | "round_start",
                                          member_ids: UUID[],
                                          round?: int
                                        }
POST   /api/schedules/:id/matches/confirm — DRAFT → CONFIRMED 공개 (운영진)
GET    /api/schedules/:id/matches     — 대진표 조회 (CONFIRMED만 일반 멤버에게 노출)
PUT    /api/schedules/:id/matches     — 대진표 수동 수정 (운영진, DRAFT/CONFIRMED 모두 가능)
```

#### 경기결과

```
PUT    /api/games/:id/result    — 경기결과 입력
                                  body: { score_a: int, score_b: int }
                                  (참가자 4명 중 아무나, 또는 운영진)
```

---

## 5. 대진표 알고리즘

### 입력

- 참가자 리스트: 멤버 + 게스트 (각각 성별, NTRP/실력, 참석 시간대)
- 코트 수 (보통 2)
- 라운드 수 (운영진 설정)
- 각 참가자의 가용 시간 (arrival_time/departure_time → 라운드별 가용 여부)

### 제약 조건 (hard/soft 구분)

**Hard (위반 불가)**
1. **시간 제약**: arrival_time/departure_time 밖의 라운드에 배정 금지
2. **게임 수 균형**: 모든 참가자의 총 게임 수 동일 (늦참/일퇴 포함)
   - 불가능한 경우: DRAFT에 경고 표시 ("A, B가 1게임 적음") → 운영진이 판단
3. **운영진 제약조건**: pair_exclusions, availability_overrides 등

**Soft (점수로 최적화)**
1. **NTRP 밸런스**: 매치별 팀A NTRP합 ≈ 팀B NTRP합 (차이 최소화)
2. **파트너 다양성**: 같은 파트너 조합 반복 최소화
3. **상대 다양성**: 같은 상대 조합 반복 최소화
4. **혼복 우선**: 가능하면 남녀 페어로 구성 (동성 페어보다 혼복 선호)

### 게스트 실력 매핑

```
BEGINNER → NTRP 2.0
INTERMEDIATE → NTRP 3.0
ADVANCED → NTRP 4.0
```

### 알고리즘 접근

12명 이하이므로 brute-force 가능. 라운드 단위 greedy.

```
for each round:
  1. 가용 인원 필터링 (시간 제약 + hard 제약)
  2. 코트 수 × 4명 선택 (게임 수 적은 사람 우선)
  3. 선택된 인원의 가능한 매치 배치 전수 탐색:
     - 8명 → 2코트 배치: C(8,4)/2 × 3 × 3 = 315가지
     - 각 배치에 soft 점수 합산 → 최고 점수 선택
  4. 나머지는 해당 라운드 휴식
```

계산량: 라운드당 ~300 조합 × 5~7라운드 = ~2000. 순식간.

### 대진표 워크플로우

```
운영진: [대진표 생성] → DRAFT (미리보기)
  ├─ ⚠️ hard 제약 불충족 시 경고 표시 (누가 몇 게임 적은지 등)
  ├─ 만족 → [컨펌] → CONFIRMED (멤버에게 공개)
  ├─ 수동 수정 → 드래그앤드롭으로 선수 스왑 → [컨펌]
  └─ 재생성 → 제약조건 추가/수정 → 알고리즘 재실행 → 새 DRAFT
```

### 제약조건 UI

운영진이 드롭다운/멤버 선택으로 추가:

| 타입 | UI | 데이터 |
|------|-----|--------|
| 같은 팀 금지 | 멤버 2명 선택 | `pair_exclude` |
| 같은 팀 선호 | 멤버 2명 선택 | `pair_prefer` |
| 상대 매칭 금지 | 멤버 2명 선택 | `opponent_exclude` |
| 특정 라운드 쉼 | 멤버 + 라운드 선택 | `round_skip` |
| N라운드부터 참가 | 멤버 + 라운드 선택 | `round_start` |

---

## 6. 기술 스택

### 프론트엔드

- **Next.js 14+ (App Router)**
- TypeScript
- Tailwind CSS
- 모바일 퍼스트 디자인

### 백엔드

- **FastAPI**
- **PostgreSQL** (SQLAlchemy ORM 또는 SQLModel)
- Alembic (DB 마이그레이션)
- APScheduler (상태 자동 전환: 수요일 15:00, 정모 당일 마감)

### 인프라

- 프론트: Vercel (무료, Next.js 풀 기능)
- 백엔드: vesper.sogang.ac.kr (FastAPI, localhost:8200 → nginx HTTPS 프록시)
  - URL: https://vesper.sogang.ac.kr/humbleb/api/
- DB: vesper PostgreSQL

### 프로젝트 구조

```
humbleb/
├── frontend/                  # Next.js
│   ├── app/
│   │   ├── page.tsx           # 메인 (컨텍스트 어웨어)
│   │   ├── schedule/
│   │   │   └── [id]/
│   │   │       ├── page.tsx   # 정모 상세
│   │   │       └── matches/
│   │   │           └── page.tsx  # 대진표 + 결과입력
│   │   └── admin/
│   │       └── page.tsx       # 운영진
│   ├── components/
│   │   ├── ScheduleCard.tsx
│   │   ├── AttendButton.tsx
│   │   ├── MatchCard.tsx
│   │   ├── ScoreInput.tsx
│   │   └── MemberPicker.tsx
│   ├── lib/
│   │   └── api.ts             # API 클라이언트
│   └── tailwind.config.ts
│
├── backend/                   # FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── models/
│   │   │   ├── member.py
│   │   │   ├── schedule.py
│   │   │   ├── attendance.py
│   │   │   ├── guest.py
│   │   │   ├── matchmaking.py
│   │   │   └── game.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── members.py
│   │   │   ├── schedules.py
│   │   │   ├── attendance.py
│   │   │   ├── guests.py
│   │   │   └── matches.py
│   │   ├── services/
│   │   │   ├── matchmaking.py  # 대진표 알고리즘
│   │   │   └── scheduler.py    # 상태 자동 전환
│   │   ├── database.py
│   │   └── config.py
│   ├── alembic/
│   └── requirements.txt
│
└── README.md
```

---

## 7. 기존 데이터 마이그레이션

기존 Django DB에서 멤버 데이터 이관:
- 30명 멤버 (이름, 성별, NTRP)
- NTRP가 대부분 2.5로 되어 있음 → 마이그레이션 후 운영진이 수동으로 정비 필요
- 일정 히스토리는 이관하지 않아도 됨 (새로 시작)

---

## 8. 구현 순서

### Phase 1: 뼈대 + 참가신청 (최우선) ✅

1. ✅ FastAPI 프로젝트 셋업 + DB 모델 (Member, Schedule, Attendance)
2. ✅ 카카오 OAuth 인증 (로그인 → JWT Bearer token via localStorage)
3. ✅ 멤버 시드 데이터 (30명) + 첫 로그인 시 카카오↔멤버 매핑
4. ✅ API: 일정 조회, 참가신청/취소 (full/late/early)
5. ✅ Next.js 메인 화면: 정모 카드 리스트 + 참가/불참 버튼
6. ✅ 참가 상태 표시, 다크모드, 터치 피드백, 로고, 로그아웃

### Phase 1.5: 상태 전환 + 안정화 (즉시)

7. 일정 상태 lazy evaluation (API 호출 시 자동 상태 계산)
   - 정모 당일 지남 → CLOSED
   - 수요일 15:00 이후 + 정원 미달 → GUEST_OPEN
   - 정원 도달 → CLOSED
8. upcoming API에서 지난 일정 제외 (오늘 기준)
9. 인프라: vesper 배포 (systemd + nginx) + Vercel 배포 완료

### Phase 2: 운영진 기능

7. 운영진 페이지: 일정 CRUD
8. 반복일정 생성
9. 게스트 등록
10. APScheduler 보조 상태 전환 (lazy evaluation 외 추가 정합성)
11. 카톡 공유용 정모 안내 텍스트 복사 버튼

### Phase 3: 대진표

12. 대진표 알고리즘 구현 (matchmaking.py)
13. 대진표 생성 API + 운영진 UI (DRAFT → 미리보기 → 제약조건/수동 수정 → 컨펌)
15. 대진표 조회 화면 (CONFIRMED만 멤버에게 노출)

### Phase 4: 경기결과 + 레이팅

16. 경기결과 입력 UI (스코어 탭 입력)
17. 시간 기반 화면 전환 (정모 ±1시간)
18. 결과 기반 내부 레이팅 업데이트 (ELO 변형)

### Phase 5: 폴리시

19. 모바일 최적화
20. 대진표 이미지 다운로드 (카톡 공유용)
21. 과거 정모 히스토리 조회
22. 멤버별 통계 (승률, 게임 수 등)

---

## 9. 핵심 UX 원칙

- **터치 최소화**: 카카오 로그인 후 참가 1탭. 첫 방문만 멤버 매핑 1회 추가.
- **카카오 로그인**: 카톡 기반 동호회에 가장 자연스러운 인증. 다른 기기에서도 동일 계정.
- **컨텍스트 어웨어**: 시간대에 따라 필요한 화면이 자동으로 올라옴
- **모바일 퍼스트**: 폰에서 카톡 링크 타고 들어오는 게 주 사용 패턴
- **카톡 공존**: 카톡 단톡방을 대체하지 않음. 링크 공유 채널로만 활용.

---

## 10. UI/UX 상세 스펙

### 모바일 레이아웃
- 단일 컬럼 레이아웃 (사이드바 없음)
- 뷰포트 단위: `dvh` 사용 (`vh` 금지 — 카톡 인앱 브라우저 URL바 문제)
- 카드 기반 UI: full-width, 좌우 16px 마진
- 폰트 최소 16px (input 필드 — iOS 자동줌 방지)

### 터치 타겟
- 최소 탭 영역: 48×48px
- 인터랙티브 요소 간 최소 간격: 8px
- 버튼 높이: 48-56px
- 리스트 아이템 최소 높이: 56px

### 참가 신청 인터랙션
- **Optimistic UI**: 참가 탭 → 즉시 UI 반영 (인원수 증가, 버튼 상태 변경) → 서버 호출
- 서버 실패 시: 롤백 + 토스트 ("참가 신청 실패. 다시 시도해주세요.")
- 탭 디바운스: 300ms
- 토스트: 하단 표시, 에러 4초 / 성공 2초

### 로딩 상태
- 0-300ms: 아무것도 안 보여줌
- 300ms+: 스켈레톤 스크린 (shimmer 애니메이션)
- 빈 화면 금지

### 바텀시트 (모바일 모달 대체)
- 용도: 참가 타입 선택, 제약조건 추가, 필터 등
- 최대 높이: 90vh (배경 10% 항상 노출)
- 상단 핸들바: 32px × 4px, 가운데 정렬
- 배경 스크림: rgba(0,0,0,0.5), 탭하면 닫힘
- 파괴적 작업(삭제 등)만 센터 모달 다이얼로그 사용

### 카카오톡 인앱 브라우저 대응
- `position: fixed` 키보드 열릴 때 깨짐 → `position: sticky` 또는 `visualViewport` API
- `window.open()` 차단됨 → `location.href` 사용
- `localStorage` 불안정 → 쿠키 폴백
- `alert()`/`confirm()` 사용 금지 → 커스텀 모달
- 서비스워커 미지원 → PWA 오프라인 기능 의존 금지
- 감지: `navigator.userAgent.includes('KAKAOTALK')`
- "브라우저에서 열기" 버튼 제공

### 운영진 UI
- 별도 앱 분리하지 않음. 같은 앱에서 `is_admin` 기반 컨텍스트 노출
- 운영진 전용 액션: 오버플로우 메뉴(⋮) 또는 스와이프로 노출
- 대진표 수정: 드래그앤드롭 (터치 롱프레스 500ms 후 드래그)

### 스코어 입력
- `inputmode="numeric"` (숫자 키패드)
- 큰 탭 영역 (56px × 56px)
- 입력 즉시 반영 (optimistic)
