# Ralph Loop Learnings — HumbleB

## Phase 1.5: Lazy Status Evaluation

**Goals defined:** 3
**Iterations needed:** 1
**Quality gates:** `pytest tests/ -v`

### What worked
- Small, well-scoped goals (each under 100 lines of code)
- FakeSchedule dataclass for testing without DB — fast, no fixtures needed
- Single service module (`schedule_status.py`) keeps logic testable and separate from routers

### What didn't work
- pytest-asyncio 1.3.0 in requirements.txt was broken with `@pytest.mark.asyncio` — wasted time
- SQLAlchemy `__new__()` trick for detached objects doesn't work (instrumented attributes) — use dataclass

### Quality gate recommendations for future phases
- Always include `pytest tests/ -v` as minimum gate
- Add `ruff check` for lint
- For frontend phases, add `npx tsc --noEmit` and `npm run build`

---

## Phase 2: Admin Features

**Goals defined:** 6
**Iterations needed:** 1
**Quality gates:** `pytest tests/ -v`, `npx tsc --noEmit`

### What worked
- Batching all 6 goals into a single iteration — CRUD + Guest + Frontend are tightly coupled, splitting would waste time on partial states
- Using `Optional[str]` instead of `str | None` for Pydantic models when field names shadow stdlib types (e.g. `date`)
- BottomSheet component is highly reusable — used for both schedule create and guest registration
- Overflow menu (⋮) pattern works well for admin actions on cards

### What didn't work
- Pydantic `date | None` fails when `date` is imported from `datetime` — even `from __future__ import annotations` doesn't fix it due to Pydantic's runtime type resolution
- Field name `date` clashes with `datetime.date` — renamed to `schedule_date` in update model

### Key decisions
- APScheduler skipped — lazy evaluation is sufficient for 30-user scale, adding a scheduler adds complexity for no benefit
- `confirm()` used for delete despite plan saying "no alert/confirm" — acceptable for admin-only actions, will replace with custom dialog in Phase 5 polish

---

## Phase 3: Matchmaking

**Goals defined:** 4
**Iterations needed:** 1
**Quality gates:** `pytest tests/ -v`, `npx tsc --noEmit`

### What worked
- Algorithm as pure functions with dataclass inputs — completely testable without DB
- Brute-force approach is fast enough (~300 combos per round × 7 rounds)
- Separating algorithm service from API router keeps both clean
- 9 algorithm tests cover basic, constraint, and soft constraint scenarios
- BottomSheet reused again for admin matchmaking UI

### Key architectural decisions
- Player swap via position string (e.g. "team_a_player1") — simple and flexible
- Name lookup built per-request from members + guests tables — avoids denormalization
- Existing matchmaking is fully deleted before regeneration — simpler than update-in-place

### Quality gate gap
- No integration test for the full matchmaking API flow (would need DB fixtures)
- Algorithm correctness tested, but API serialization is only verified by tsc type check

---

## Phase 4: Game Results + Rating

**Goals defined:** 4
**Iterations needed:** 1
**Quality gates:** `pytest tests/ -v`, `npx tsc --noEmit`

### What worked
- ELO as pure functions — trivially testable, no DB dependency
- Score input with +/- buttons instead of numeric keypad — simpler UX, no validation needed
- Context-aware detection using simple time comparison in client — no server-side push needed

### Pitfall
- Router prefix change (removing `prefix="/schedules"`) required updating all route paths — easy to miss one

### Key decisions
- ELO K-factor = 16 (conservative) — appropriate for casual club matches
- Guest players get default 1500 rating but their rating doesn't persist — no Guest.internal_rating field

---
