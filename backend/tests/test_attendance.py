"""Tests for attendance business logic (compute_times, attend rules)."""
from datetime import time

import pytest

from app.models.attendance import AttendanceType
from app.routers.attendance import compute_times


class FakeSchedule:
    """Minimal schedule stand-in for compute_times."""

    def __init__(self, start_time=time(10, 0), end_time=time(12, 30)):
        self.start_time = start_time
        self.end_time = end_time


class TestComputeTimes:
    def test_full_uses_schedule_times(self):
        s = FakeSchedule()
        arrival, departure = compute_times(s, AttendanceType.FULL)
        assert arrival == time(10, 0)
        assert departure == time(12, 30)

    def test_late_adds_30_minutes(self):
        s = FakeSchedule(start_time=time(10, 0))
        arrival, departure = compute_times(s, AttendanceType.LATE)
        assert arrival == time(10, 30)
        assert departure == s.end_time

    def test_early_subtracts_30_minutes(self):
        s = FakeSchedule(end_time=time(12, 30))
        arrival, departure = compute_times(s, AttendanceType.EARLY)
        assert arrival == s.start_time
        assert departure == time(12, 0)

    def test_late_rolls_over_hour(self):
        s = FakeSchedule(start_time=time(9, 45))
        arrival, _ = compute_times(s, AttendanceType.LATE)
        assert arrival == time(10, 15)

    def test_early_rolls_back_hour(self):
        s = FakeSchedule(end_time=time(12, 10))
        _, departure = compute_times(s, AttendanceType.EARLY)
        assert departure == time(11, 40)


class TestAttendRequest:
    def test_default_type_is_full(self):
        from app.routers.attendance import AttendRequest

        req = AttendRequest()
        assert req.type == AttendanceType.FULL
        assert req.comment is None

    def test_explicit_type(self):
        from app.routers.attendance import AttendRequest

        req = AttendRequest(type=AttendanceType.LATE, comment="bus delay")
        assert req.type == AttendanceType.LATE
        assert req.comment == "bus delay"


class TestAttendanceOut:
    def test_model_fields(self):
        import uuid
        from app.routers.attendance import AttendanceOut

        out = AttendanceOut(
            id=uuid.uuid4(),
            member_id=uuid.uuid4(),
            member_name="Alice",
            attendance_type="full",
            arrival_time=time(10, 0),
            departure_time=time(12, 30),
            comment=None,
        )
        assert out.member_name == "Alice"
        assert out.attendance_type == "full"
