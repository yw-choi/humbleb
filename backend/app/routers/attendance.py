"""Attendance endpoints: attend, cancel."""
import uuid
from datetime import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_member
from app.database import get_db
from app.models.attendance import Attendance, AttendanceType
from app.models.member import Member
from app.models.schedule import Schedule, ScheduleStatus

router = APIRouter(prefix="/schedules", tags=["attendance"])


class AttendRequest(BaseModel):
    type: AttendanceType = AttendanceType.FULL
    comment: str | None = None


class AttendanceOut(BaseModel):
    id: uuid.UUID
    member_id: uuid.UUID
    member_name: str = ""
    attendance_type: str
    arrival_time: time | None
    departure_time: time | None
    comment: str | None

    model_config = {"from_attributes": True}


def compute_times(schedule: Schedule, attendance_type: AttendanceType) -> tuple[time, time]:
    """Compute arrival/departure times based on attendance type."""
    arrival = schedule.start_time
    departure = schedule.end_time

    if attendance_type == AttendanceType.LATE:
        # +30 minutes
        minutes = arrival.hour * 60 + arrival.minute + 30
        arrival = time(minutes // 60, minutes % 60)
    elif attendance_type == AttendanceType.EARLY:
        # -30 minutes
        minutes = departure.hour * 60 + departure.minute - 30
        departure = time(minutes // 60, minutes % 60)

    return arrival, departure


@router.post("/{schedule_id}/attend", response_model=AttendanceOut)
async def attend(
    schedule_id: uuid.UUID,
    body: AttendRequest,
    member: Member = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    # Get schedule
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule not found")

    # Check status
    if schedule.status == ScheduleStatus.CLOSED:
        raise HTTPException(403, "Registration is closed")

    if schedule.status == ScheduleStatus.GUEST_OPEN:
        # Members can still attend during GUEST_OPEN
        pass
    elif schedule.status != ScheduleStatus.MEMBER_OPEN:
        raise HTTPException(403, "Registration not open")

    # Check capacity
    from sqlalchemy import func
    count_result = await db.execute(
        select(func.count()).where(Attendance.schedule_id == schedule_id)
    )
    count = count_result.scalar() or 0
    if count >= schedule.capacity:
        raise HTTPException(409, "Schedule is full")

    # Check not already attending
    existing = await db.execute(
        select(Attendance).where(
            Attendance.schedule_id == schedule_id,
            Attendance.member_id == member.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Already attending")

    arrival, departure = compute_times(schedule, body.type)

    attendance = Attendance(
        schedule_id=schedule_id,
        member_id=member.id,
        attendance_type=body.type,
        arrival_time=arrival,
        departure_time=departure,
        comment=body.comment,
    )
    db.add(attendance)
    await db.commit()
    await db.refresh(attendance)

    out = AttendanceOut.model_validate(attendance)
    out.member_name = member.name
    return out


@router.delete("/{schedule_id}/attend")
async def cancel_attendance(
    schedule_id: uuid.UUID,
    member: Member = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    # Get schedule
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule not found")

    if schedule.status == ScheduleStatus.CLOSED:
        raise HTTPException(403, "Cannot cancel after registration closed")

    existing = await db.execute(
        select(Attendance).where(
            Attendance.schedule_id == schedule_id,
            Attendance.member_id == member.id,
        )
    )
    attendance = existing.scalar_one_or_none()
    if not attendance:
        raise HTTPException(404, "Not attending this schedule")

    await db.delete(attendance)
    await db.commit()
    return {"status": "cancelled"}


@router.get("/{schedule_id}/attendees", response_model=list[AttendanceOut])
async def list_attendees(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """List all attendees for a schedule."""
    result = await db.execute(
        select(Attendance, Member.name)
        .join(Member, Attendance.member_id == Member.id)
        .where(Attendance.schedule_id == schedule_id)
        .order_by(Attendance.created_at)
    )
    attendees = []
    for attendance, name in result.all():
        out = AttendanceOut.model_validate(attendance)
        out.member_name = name
        attendees.append(out)
    return attendees
