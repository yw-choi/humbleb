"""Tests for lazy schedule status evaluation."""
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.schedule import ScheduleStatus
from app.services.schedule_status import compute_status, get_registration_deadline


@dataclass
class FakeSchedule:
    """Lightweight stand-in for Schedule ORM model in tests."""
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    title: str = "Test"
    date: date = field(default_factory=lambda: date.today() + timedelta(days=3))
    start_time: time = time(10, 0)
    end_time: time = time(12, 30)
    venue: str = "Test Venue"
    court_count: int = 2
    capacity: int = 12
    status: ScheduleStatus = ScheduleStatus.MEMBER_OPEN
    registration_deadline: datetime | None = None
    recurrence_rule: str | None = None
    parent_schedule_id: uuid.UUID | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)


def mock_db_with_count(count: int) -> AsyncMock:
    """Create a mock DB session that returns a given attendance count."""
    db = AsyncMock()
    result_mock = MagicMock()
    result_mock.scalar.return_value = count
    db.execute.return_value = result_mock
    return db


class TestGetRegistrationDeadline:
    def test_explicit_deadline(self):
        deadline = datetime(2026, 3, 25, 15, 0)
        s = FakeSchedule(registration_deadline=deadline)
        assert get_registration_deadline(s) == deadline

    def test_default_deadline_saturday(self):
        """Saturday 3/28 → Wednesday 3/25 15:00."""
        s = FakeSchedule(date=date(2026, 3, 28))
        d = get_registration_deadline(s)
        assert d == datetime(2026, 3, 25, 15, 0)

    def test_default_deadline_sunday(self):
        """Sunday 3/29 → Wednesday 3/25 15:00."""
        s = FakeSchedule(date=date(2026, 3, 29))
        d = get_registration_deadline(s)
        assert d == datetime(2026, 3, 25, 15, 0)


class TestComputeStatus:
    @pytest.mark.asyncio
    async def test_past_date_closed(self):
        s = FakeSchedule(date=date(2026, 3, 20))
        db = mock_db_with_count(5)
        status = await compute_status(s, db, now=datetime(2026, 3, 28, 10, 0))
        assert status == ScheduleStatus.CLOSED

    @pytest.mark.asyncio
    async def test_today_past_end_time_closed(self):
        s = FakeSchedule(date=date(2026, 3, 28), end_time=time(12, 30))
        db = mock_db_with_count(5)
        status = await compute_status(s, db, now=datetime(2026, 3, 28, 13, 0))
        assert status == ScheduleStatus.CLOSED

    @pytest.mark.asyncio
    async def test_today_before_end_time_not_closed(self):
        s = FakeSchedule(
            date=date(2026, 3, 28),
            end_time=time(12, 30),
            registration_deadline=datetime(2026, 3, 25, 15, 0),
        )
        db = mock_db_with_count(5)
        status = await compute_status(s, db, now=datetime(2026, 3, 28, 10, 0))
        assert status == ScheduleStatus.GUEST_OPEN

    @pytest.mark.asyncio
    async def test_capacity_reached_closed(self):
        s = FakeSchedule(date=date(2026, 3, 29), capacity=12)
        db = mock_db_with_count(12)
        status = await compute_status(s, db, now=datetime(2026, 3, 27, 10, 0))
        assert status == ScheduleStatus.CLOSED

    @pytest.mark.asyncio
    async def test_past_deadline_under_capacity_guest_open(self):
        s = FakeSchedule(
            date=date(2026, 3, 29),
            capacity=12,
            registration_deadline=datetime(2026, 3, 25, 15, 0),
        )
        db = mock_db_with_count(8)
        status = await compute_status(s, db, now=datetime(2026, 3, 26, 10, 0))
        assert status == ScheduleStatus.GUEST_OPEN

    @pytest.mark.asyncio
    async def test_before_deadline_member_open(self):
        s = FakeSchedule(
            date=date(2026, 3, 29),
            capacity=12,
            registration_deadline=datetime(2026, 3, 25, 15, 0),
        )
        db = mock_db_with_count(5)
        status = await compute_status(s, db, now=datetime(2026, 3, 24, 10, 0))
        assert status == ScheduleStatus.MEMBER_OPEN

    @pytest.mark.asyncio
    async def test_at_exact_deadline_guest_open(self):
        deadline = datetime(2026, 3, 25, 15, 0)
        s = FakeSchedule(
            date=date(2026, 3, 29),
            capacity=12,
            registration_deadline=deadline,
        )
        db = mock_db_with_count(8)
        status = await compute_status(s, db, now=deadline)
        assert status == ScheduleStatus.GUEST_OPEN

    @pytest.mark.asyncio
    async def test_capacity_reached_overrides_guest_open(self):
        s = FakeSchedule(
            date=date(2026, 3, 29),
            capacity=12,
            registration_deadline=datetime(2026, 3, 25, 15, 0),
        )
        db = mock_db_with_count(12)
        status = await compute_status(s, db, now=datetime(2026, 3, 26, 10, 0))
        assert status == ScheduleStatus.CLOSED
