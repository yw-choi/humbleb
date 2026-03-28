"""Schedule endpoints."""
import uuid
from datetime import date, time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_admin
from app.database import get_db
from app.models.attendance import Attendance
from app.models.member import Member
from app.models.schedule import Schedule

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


@router.get("/upcoming", response_model=list[ScheduleOut])
async def upcoming_schedules(
    db: AsyncSession = Depends(get_db),
):
    """List upcoming schedules with attendance counts."""
    today = date.today()
    schedules = await db.execute(
        select(Schedule)
        .where(Schedule.date >= today)
        .order_by(Schedule.date, Schedule.start_time)
    )
    results = []
    for schedule in schedules.scalars().all():
        count_result = await db.execute(
            select(func.count()).where(Attendance.schedule_id == schedule.id)
        )
        count = count_result.scalar() or 0
        out = ScheduleOut.model_validate(schedule)
        out.attendance_count = count
        results.append(out)
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
    count_result = await db.execute(
        select(func.count()).where(Attendance.schedule_id == schedule.id)
    )
    out = ScheduleOut.model_validate(schedule)
    out.attendance_count = count_result.scalar() or 0
    return out


@router.post("/", response_model=ScheduleOut)
async def create_schedule(
    body: ScheduleCreate,
    admin: Member = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    schedule = Schedule(**body.model_dump())
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    out = ScheduleOut.model_validate(schedule)
    out.attendance_count = 0
    return out
