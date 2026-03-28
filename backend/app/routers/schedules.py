"""Schedule endpoints."""
import uuid
from datetime import date, datetime, time, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_admin
from app.database import get_db
from app.models.member import Member
from app.models.schedule import Schedule, ScheduleStatus
from app.services.schedule_status import evaluate_and_update

router = APIRouter(prefix="/schedules", tags=["schedules"])


class ScheduleOut(BaseModel):
    id: uuid.UUID
    title: str
    date: date
    start_time: time
    end_time: time
    venue: str
    court_count: int
    capacity: int
    status: str
    attendance_count: int = 0

    model_config = {"from_attributes": True}


class ScheduleCreate(BaseModel):
    title: str
    date: date
    start_time: time
    end_time: time
    venue: str
    court_count: int = 2
    capacity: int = 12
    repeat_weeks: int = 0  # 0 = single, N = generate N weekly copies


class ScheduleUpdate(BaseModel):
    title: Optional[str] = None
    schedule_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    venue: Optional[str] = None
    court_count: Optional[int] = None
    capacity: Optional[int] = None


@router.get("/upcoming", response_model=list[ScheduleOut])
async def upcoming_schedules(
    db: AsyncSession = Depends(get_db),
):
    """List upcoming schedules with attendance counts. Excludes past schedules."""
    today = date.today()
    schedules = await db.execute(
        select(Schedule)
        .where(Schedule.date >= today)
        .order_by(Schedule.date, Schedule.start_time)
    )
    results = []
    for schedule in schedules.scalars().all():
        status, count = await evaluate_and_update(schedule, db)
        out = ScheduleOut.model_validate(schedule)
        out.attendance_count = count
        results.append(out)
    await db.commit()
    return results


@router.get("/{schedule_id}", response_model=ScheduleOut)
async def get_schedule(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule not found")
    status, count = await evaluate_and_update(schedule, db)
    await db.commit()
    out = ScheduleOut.model_validate(schedule)
    out.attendance_count = count
    return out


@router.post("/", response_model=list[ScheduleOut])
async def create_schedule(
    body: ScheduleCreate,
    admin: Member = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create schedule(s). If repeat_weeks > 0, generates weekly copies."""
    base_data = body.model_dump(exclude={"repeat_weeks"})
    total_weeks = max(1, body.repeat_weeks + 1) if body.repeat_weeks else 1

    created = []
    parent_id = None
    for week in range(total_weeks):
        schedule_date = body.date + timedelta(weeks=week)
        # Default deadline: Wednesday 15:00 of the schedule's week
        days_since_monday = schedule_date.weekday()
        wednesday = schedule_date - timedelta(days=days_since_monday - 2)
        if wednesday > schedule_date:
            wednesday -= timedelta(weeks=1)
        deadline = datetime.combine(wednesday, time(15, 0))

        schedule = Schedule(
            **{**base_data, "date": schedule_date},
            registration_deadline=deadline,
            parent_schedule_id=parent_id,
        )
        db.add(schedule)
        await db.flush()

        if week == 0:
            parent_id = schedule.id

        out = ScheduleOut.model_validate(schedule)
        out.attendance_count = 0
        created.append(out)

    await db.commit()
    return created


@router.put("/{schedule_id}", response_model=ScheduleOut)
async def update_schedule(
    schedule_id: uuid.UUID,
    body: ScheduleUpdate,
    admin: Member = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule not found")

    update_data = body.model_dump(exclude_unset=True)
    # Map schedule_date back to date column
    if "schedule_date" in update_data:
        update_data["date"] = update_data.pop("schedule_date")
    for field, value in update_data.items():
        setattr(schedule, field, value)

    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)

    status, count = await evaluate_and_update(schedule, db)
    await db.commit()
    out = ScheduleOut.model_validate(schedule)
    out.attendance_count = count
    return out


@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: uuid.UUID,
    admin: Member = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule not found")
    await db.delete(schedule)
    await db.commit()
    return {"status": "deleted"}


@router.get("/{schedule_id}/share-text")
async def get_share_text(
    schedule_id: uuid.UUID,
    admin: Member = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Generate KakaoTalk share text for a schedule."""
    from app.config import settings

    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule not found")

    status, count = await evaluate_and_update(schedule, db)
    await db.commit()

    weekday_names = ["월", "화", "수", "목", "금", "토", "일"]
    weekday = weekday_names[schedule.date.weekday()]

    status_text = {
        ScheduleStatus.MEMBER_OPEN: "멤버 신청중",
        ScheduleStatus.GUEST_OPEN: "게스트 모집중",
        ScheduleStatus.CLOSED: "마감",
    }[schedule.status]

    text = (
        f"🎾 HumbleB 정모 안내\n"
        f"\n"
        f"📅 {schedule.date.month}/{schedule.date.day} ({weekday})\n"
        f"⏰ {schedule.start_time.strftime('%H:%M')}~{schedule.end_time.strftime('%H:%M')}\n"
        f"📍 {schedule.venue}\n"
        f"👥 {count}/{schedule.capacity}명 ({status_text})\n"
        f"\n"
        f"참가 신청 👉 {settings.FRONTEND_URL}/schedule/{schedule.id}"
    )
    return {"text": text}
