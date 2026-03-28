"""Tests for share text generation logic."""
from datetime import date, time

from app.models.schedule import ScheduleStatus


WEEKDAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"]

STATUS_TEXT = {
    ScheduleStatus.MEMBER_OPEN: "멤버 신청중",
    ScheduleStatus.GUEST_OPEN: "게스트 모집중",
    ScheduleStatus.CLOSED: "마감",
}


class TestStatusText:
    def test_member_open(self):
        assert STATUS_TEXT[ScheduleStatus.MEMBER_OPEN] == "멤버 신청중"

    def test_guest_open(self):
        assert STATUS_TEXT[ScheduleStatus.GUEST_OPEN] == "게스트 모집중"

    def test_closed(self):
        assert STATUS_TEXT[ScheduleStatus.CLOSED] == "마감"

    def test_all_statuses_covered(self):
        for s in ScheduleStatus:
            assert s in STATUS_TEXT


class TestWeekdayNames:
    def test_monday(self):
        d = date(2026, 3, 30)  # Monday
        assert WEEKDAY_NAMES[d.weekday()] == "월"

    def test_saturday(self):
        d = date(2026, 3, 28)  # Saturday
        assert WEEKDAY_NAMES[d.weekday()] == "토"

    def test_sunday(self):
        d = date(2026, 3, 29)  # Sunday
        assert WEEKDAY_NAMES[d.weekday()] == "일"

    def test_wednesday(self):
        d = date(2026, 3, 25)  # Wednesday
        assert WEEKDAY_NAMES[d.weekday()] == "수"

    def test_friday(self):
        d = date(2026, 3, 27)  # Friday
        assert WEEKDAY_NAMES[d.weekday()] == "금"


class TestShareTextFormat:
    """Test that the share text template produces expected output."""

    def _build_share_text(self, sched_date, start, end, venue, count, capacity, status):
        weekday = WEEKDAY_NAMES[sched_date.weekday()]
        status_label = STATUS_TEXT[status]
        return (
            f"🎾 HumbleB 정모 안내\n"
            f"\n"
            f"📅 {sched_date.month}/{sched_date.day} ({weekday})\n"
            f"⏰ {start.strftime('%H:%M')}~{end.strftime('%H:%M')}\n"
            f"📍 {venue}\n"
            f"👥 {count}/{capacity}명 ({status_label})\n"
            f"\n"
            f"참가 신청 👉 http://localhost:3000/schedule/test-id"
        )

    def test_includes_attendance_count(self):
        text = self._build_share_text(
            date(2026, 4, 4), time(10, 0), time(12, 30),
            "Test Court", 8, 12, ScheduleStatus.MEMBER_OPEN,
        )
        assert "8/12명" in text

    def test_includes_status_text(self):
        text = self._build_share_text(
            date(2026, 4, 4), time(10, 0), time(12, 30),
            "Test Court", 8, 12, ScheduleStatus.GUEST_OPEN,
        )
        assert "게스트 모집중" in text

    def test_includes_weekday(self):
        text = self._build_share_text(
            date(2026, 4, 4), time(10, 0), time(12, 30),  # Saturday
            "Test Court", 8, 12, ScheduleStatus.MEMBER_OPEN,
        )
        assert "(토)" in text

    def test_full_capacity_closed(self):
        text = self._build_share_text(
            date(2026, 4, 4), time(10, 0), time(12, 30),
            "Test Court", 12, 12, ScheduleStatus.CLOSED,
        )
        assert "12/12명" in text
        assert "마감" in text

    def test_zero_attendees(self):
        text = self._build_share_text(
            date(2026, 4, 4), time(10, 0), time(12, 30),
            "Test Court", 0, 12, ScheduleStatus.MEMBER_OPEN,
        )
        assert "0/12명" in text
