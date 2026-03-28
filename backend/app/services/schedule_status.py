"""Lazy evaluation of schedule status based on current time and attendance."""
from datetime import date, datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import Attendance
from app.models.schedule import Schedule, ScheduleStatus


def get_registration_deadline(schedule: Schedule) -> datetime:
    """Get the registration deadline for a schedule.

    Default: Wednesday 15:00 of the same week as the schedule date.
    """
    if schedule.registration_deadline:
        return schedule.registration_deadline
    # Find the Wednesday of the schedule's week (weekday 2 = Wednesday)
    schedule_date = schedule.date
    days_since_monday = schedule_date.weekday()
    wednesday = schedule_date - timedelta(days=days_since_monday - 2)
    if wednesday > schedule_date:
        wednesday -= timedelta(weeks=1)
    return datetime.combine(wednesday, time(15, 0))


async def compute_status(
    schedule: Schedule, db: AsyncSession, now: datetime | None = None
) -> ScheduleStatus:
    """Compute the effective status of a schedule based on current time.

    Rules (evaluated in order):
    1. Schedule date has passed → CLOSED
    2. Capacity reached → CLOSED
    3. Past registration deadline + under capacity → GUEST_OPEN
    4. Otherwise → keep current DB status (MEMBER_OPEN)
    """
    if now is None:
        now = datetime.now()

    today = now.date()

    # Rule 1: schedule date has passed
    if schedule.date < today:
        return ScheduleStatus.CLOSED

    # Rule 1b: schedule is today and past end_time
    if schedule.date == today and now.time() > schedule.end_time:
        return ScheduleStatus.CLOSED

    # Count current attendance
    count_result = await db.execute(
        select(func.count()).where(Attendance.schedule_id == schedule.id)
    )
    count = count_result.scalar() or 0

    # Rule 2: capacity reached
    if count >= schedule.capacity:
        return ScheduleStatus.CLOSED

    # Rule 3: past registration deadline + under capacity → GUEST_OPEN
    deadline = get_registration_deadline(schedule)
    if now >= deadline:
        return ScheduleStatus.GUEST_OPEN

    # Default: MEMBER_OPEN
    return ScheduleStatus.MEMBER_OPEN


async def evaluate_and_update(
    schedule: Schedule, db: AsyncSession, now: datetime | None = None
) -> tuple[ScheduleStatus, int]:
    """Compute status, update DB if changed, return (status, attendance_count)."""
    if now is None:
        now = datetime.now()

    new_status = await compute_status(schedule, db, now)

    if schedule.status != new_status:
        schedule.status = new_status
        db.add(schedule)
        await db.flush()

    count_result = await db.execute(
        select(func.count()).where(Attendance.schedule_id == schedule.id)
    )
    count = count_result.scalar() or 0

    return new_status, count
