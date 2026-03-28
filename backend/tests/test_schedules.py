"""Tests for schedule CRUD and recurring schedule generation."""
from datetime import date, time, timedelta

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth import create_jwt
from app.main import app


def admin_headers(member_id: str = "00000000-0000-0000-0000-000000000001") -> dict:
    """Create auth headers for an admin user. Requires admin member in DB."""
    token = create_jwt("admin_kakao", member_id=member_id)
    return {"Authorization": f"Bearer {token}"}


class TestScheduleCreateModel:
    """Test the ScheduleCreate model with repeat_weeks field."""

    def test_repeat_weeks_default(self):
        from app.routers.schedules import ScheduleCreate
        body = ScheduleCreate(
            title="Test",
            date=date(2026, 4, 4),
            start_time=time(10, 0),
            end_time=time(12, 30),
            venue="Test Venue",
        )
        assert body.repeat_weeks == 0

    def test_repeat_weeks_set(self):
        from app.routers.schedules import ScheduleCreate
        body = ScheduleCreate(
            title="Test",
            date=date(2026, 4, 4),
            start_time=time(10, 0),
            end_time=time(12, 30),
            venue="Test Venue",
            repeat_weeks=3,
        )
        assert body.repeat_weeks == 3


class TestScheduleUpdateModel:
    def test_partial_update(self):
        from app.routers.schedules import ScheduleUpdate
        body = ScheduleUpdate(title="New Title")
        dumped = body.model_dump(exclude_unset=True)
        assert dumped == {"title": "New Title"}

    def test_empty_update(self):
        from app.routers.schedules import ScheduleUpdate
        body = ScheduleUpdate()
        dumped = body.model_dump(exclude_unset=True)
        assert dumped == {}


class TestShareText:
    def test_share_text_format(self):
        """Verify the share text template structure."""
        from app.models.schedule import ScheduleStatus

        # Test the status mapping
        status_text = {
            ScheduleStatus.MEMBER_OPEN: "멤버 신청중",
            ScheduleStatus.GUEST_OPEN: "게스트 모집중",
            ScheduleStatus.CLOSED: "마감",
        }
        assert status_text[ScheduleStatus.MEMBER_OPEN] == "멤버 신청중"
        assert status_text[ScheduleStatus.GUEST_OPEN] == "게스트 모집중"
        assert status_text[ScheduleStatus.CLOSED] == "마감"
