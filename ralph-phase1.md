# Task
Implement HumbleB tennis club web app Phase 1: skeleton + attendance system.
Reference PLAN.md, PRD.md, and QUALITY_GATES.md for full specs.

Backend: FastAPI on localhost:8200, PostgreSQL on vesper.
Frontend: Next.js with Tailwind CSS, deployed to Vercel.
API base URL: https://vesper.sogang.ac.kr/humbleb/api/

# Goals
- [ ] FastAPI project setup with DB models (Member, Schedule, Attendance) and Alembic migrations
- [ ] Kakao OAuth authentication (login/logout, JWT httpOnly cookie, redirect URI: https://vesper.sogang.ac.kr/humbleb/api/auth/kakao/callback)
- [ ] Member seed data (30 members) and first-login kakao-member linking API
- [ ] Schedule and attendance APIs (upcoming schedules, attend with full/late/early, cancel, capacity enforcement)
- [ ] Next.js project setup with Tailwind CSS, mobile-first layout, API client
- [ ] Kakao login flow in frontend (login button, OAuth redirect, member linking on first login)
- [ ] Main page: schedule card list with status badges, attendance count, attend/cancel buttons
- [ ] Attendance bottom sheet (full/late/early selection), optimistic UI with rollback on failure
- [ ] Schedule detail page with participant list (name, time slot, comment)
- [ ] Skeleton screens for loading states, toast notifications for errors/success

# Quality Gates
- `cd backend && python -m pytest tests/ -v`: All backend tests pass
- `cd frontend && npx tsc --noEmit`: TypeScript strict mode, no errors
- `cd frontend && npx next lint`: ESLint passes
- `cd backend && ruff check app/`: Python linter passes
