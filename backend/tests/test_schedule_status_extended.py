"""Extended schedule status tests: evaluate_and_update, transitions, no downgrade."""
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.schedule import ScheduleStatus
from app.services.schedule_status import compute_status, evaluate_and_update


@dataclass
class FakeSchedule:
    """Lightweight stand-in for Schedule ORM model."""
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
    created_at: datetime = field(default_factory=datetime.now)


def mock_db_with_count(count: int) -> AsyncMock:
    """Create a mock DB session that returns a given attendance count."""
    db = AsyncMock()
    result_mock = MagicMock()
    result_mock.scalar.return_value = count
    db.execute.return_value = result_mock
    return db


class TestEvaluateAndUpdate:
    @pytest.mark.asyncio
    async def test_returns_status_and_count(self):
        s = FakeSchedule(
            date=date(2026, 4, 5),
            registration_deadline=datetime(2026, 4, 1, 15, 0),
        )
        db = mock_db_with_count(7)
        status, count = await evaluate_and_update(s, db, now=datetime(2026, 3, 30, 10, 0))
        assert status == ScheduleStatus.MEMBER_OPEN
        assert count == 7

    @pytest.mark.asyncio
    async def test_returns_correct_count_when_full(self):
        s = FakeSchedule(date=date(2026, 4, 5), capacity=12)
        db = mock_db_with_count(12)
        status, count = await evaluate_and_update(s, db, now=datetime(2026, 3, 30, 10, 0))
        assert status == ScheduleStatus.CLOSED
        assert count == 12

    @pytest.mark.asyncio
    async def test_updates_status_in_db_when_changed(self):
        s = FakeSchedule(
            date=date(2026, 4, 5),
            capacity=12,
            status=ScheduleStatus.MEMBER_OPEN,
            registration_deadline=datetime(2026, 4, 1, 15, 0),
        )
        db = mock_db_with_count(8)
        # now is past deadline -> should transition to GUEST_OPEN
        status, _ = await evaluate_and_update(s, db, now=datetime(2026, 4, 2, 10, 0))
        assert status == ScheduleStatus.GUEST_OPEN
        assert s.status == ScheduleStatus.GUEST_OPEN
        db.add.assert_called_once_with(s)
        db.flush.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_does_not_flush_when_status_unchanged(self):
        s = FakeSchedule(
            date=date(2026, 4, 5),
            capacity=12,
            status=ScheduleStatus.MEMBER_OPEN,
            registration_deadline=datetime(2026, 4, 3, 15, 0),
        )
        db = mock_db_with_count(5)
        # now is before deadline -> stays MEMBER_OPEN
        status, _ = await evaluate_and_update(s, db, now=datetime(2026, 4, 1, 10, 0))
        assert status == ScheduleStatus.MEMBER_OPEN
        db.add.assert_not_called()
        db.flush.assert_not_awaited()


class TestStatusTransitions:
    @pytest.mark.asyncio
    async def test_member_open_to_guest_open_on_deadline(self):
        """MEMBER_OPEN -> GUEST_OPEN when deadline passes and under capacity."""
        s = FakeSchedule(
            date=date(2026, 4, 5),
            capacity=12,
            status=ScheduleStatus.MEMBER_OPEN,
            registration_deadline=datetime(2026, 4, 1, 15, 0),
        )
        db = mock_db_with_count(8)
        status, count = await compute_status(s, db, now=datetime(2026, 4, 1, 16, 0))
        assert status == ScheduleStatus.GUEST_OPEN
        assert count == 8

    @pytest.mark.asyncio
    async def test_member_open_to_closed_on_capacity(self):
        """MEMBER_OPEN -> CLOSED when capacity is reached."""
        s = FakeSchedule(
            date=date(2026, 4, 5),
            capacity=12,
            status=ScheduleStatus.MEMBER_OPEN,
            registration_deadline=datetime(2026, 4, 3, 15, 0),
        )
        db = mock_db_with_count(12)
        status, count = await compute_status(s, db, now=datetime(2026, 4, 1, 10, 0))
        assert status == ScheduleStatus.CLOSED
        assert count == 12

    @pytest.mark.asyncio
    async def test_guest_open_to_closed_on_capacity(self):
        """GUEST_OPEN -> CLOSED when capacity is reached."""
        s = FakeSchedule(
            date=date(2026, 4, 5),
            capacity=12,
            status=ScheduleStatus.GUEST_OPEN,
            registration_deadline=datetime(2026, 4, 1, 15, 0),
        )
        db = mock_db_with_count(12)
        status, count = await compute_status(s, db, now=datetime(2026, 4, 2, 10, 0))
        assert status == ScheduleStatus.CLOSED
        assert count == 12

    @pytest.mark.asyncio
    async def test_guest_open_to_closed_on_past_date(self):
        """GUEST_OPEN -> CLOSED when schedule date passes."""
        s = FakeSchedule(
            date=date(2026, 3, 20),
            status=ScheduleStatus.GUEST_OPEN,
        )
        db = mock_db_with_count(5)
        status, count = await compute_status(s, db, now=datetime(2026, 3, 28, 10, 0))
        assert status == ScheduleStatus.CLOSED


class TestNoStatusDowngrade:
    @pytest.mark.asyncio
    async def test_closed_stays_closed_past_date(self):
        """CLOSED schedule with past date stays CLOSED."""
        s = FakeSchedule(
            date=date(2026, 3, 20),
            status=ScheduleStatus.CLOSED,
        )
        db = mock_db_with_count(5)
        status, _ = await compute_status(s, db, now=datetime(2026, 3, 28, 10, 0))
        assert status == ScheduleStatus.CLOSED

    @pytest.mark.asyncio
    async def test_closed_stays_closed_at_capacity(self):
        """CLOSED schedule at capacity stays CLOSED."""
        s = FakeSchedule(
            date=date(2026, 4, 5),
            capacity=12,
            status=ScheduleStatus.CLOSED,
        )
        db = mock_db_with_count(12)
        status, _ = await compute_status(s, db, now=datetime(2026, 4, 1, 10, 0))
        assert status == ScheduleStatus.CLOSED

    @pytest.mark.asyncio
    async def test_closed_reopens_if_under_capacity_before_deadline(self):
        """Note: compute_status is stateless -- it recomputes from rules.
        A CLOSED schedule with spots available and before deadline
        will compute as MEMBER_OPEN. This tests current behavior."""
        s = FakeSchedule(
            date=date(2026, 4, 5),
            capacity=12,
            status=ScheduleStatus.CLOSED,
            registration_deadline=datetime(2026, 4, 3, 15, 0),
        )
        db = mock_db_with_count(5)
        status, _ = await compute_status(s, db, now=datetime(2026, 4, 1, 10, 0))
        # compute_status is purely rule-based: under capacity + before deadline = MEMBER_OPEN
        assert status == ScheduleStatus.MEMBER_OPEN

    @pytest.mark.asyncio
    async def test_closed_reopens_if_under_capacity_after_deadline(self):
        """Stateless compute: under capacity + past deadline = GUEST_OPEN."""
        s = FakeSchedule(
            date=date(2026, 4, 5),
            capacity=12,
            status=ScheduleStatus.CLOSED,
            registration_deadline=datetime(2026, 4, 1, 15, 0),
        )
        db = mock_db_with_count(10)
        status, _ = await compute_status(s, db, now=datetime(2026, 4, 2, 10, 0))
        assert status == ScheduleStatus.GUEST_OPEN
