# Task
Implement Phase 1.5: schedule status lazy evaluation and stabilization.
Backend on vesper (localhost:8200, systemd humbleb service). Frontend on Vercel (humbleb.vercel.app).
After backend changes: `systemctl --user restart humbleb`
After frontend changes: deploy with `vercel --prod --yes` (need nvm use v22.22.1, mv ~/.npmrc ~/.npmrc.bak first)

# Goals
- [ ] Implement lazy status evaluation in schedule API (auto-transition based on current time)
  - Past schedule date → CLOSED
  - Past Wednesday 15:00 + under capacity → GUEST_OPEN
  - At capacity → CLOSED
  - Update DB on read if status changed
- [ ] Filter out past schedules from /schedules/upcoming (only today and future)
- [ ] Unit tests for status transition logic
- [ ] Deploy backend (systemctl restart) and verify via API
- [ ] Verify frontend displays correct status badges

# Quality Gates
- `cd backend && python -m pytest tests/ -v`: All backend tests pass
- `cd backend && ruff check app/`: Python linter passes
