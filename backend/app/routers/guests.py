"""Guest registration endpoints (admin only)."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_admin
from app.database import get_db
from app.models.guest import Guest, GuestSkill
from app.models.member import Gender, Member
from app.models.schedule import Schedule, ScheduleStatus
from app.services.schedule_status import evaluate_and_update

router = APIRouter(tags=["guests"])


class GuestCreate(BaseModel):
    name: str
    gender: Gender
    estimated_skill: GuestSkill = GuestSkill.INTERMEDIATE


class GuestOut(BaseModel):
    id: uuid.UUID
    schedule_id: uuid.UUID
    name: str
    gender: str
    estimated_skill: str
    registered_by: uuid.UUID

    model_config = {"from_attributes": True}


@router.post("/schedules/{schedule_id}/guests", response_model=GuestOut)
async def register_guest(
    schedule_id: uuid.UUID,
    body: GuestCreate,
    admin: Member = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule not found")

    # Lazy evaluate status
    await evaluate_and_update(schedule, db)

    if schedule.status not in (ScheduleStatus.GUEST_OPEN, ScheduleStatus.MEMBER_OPEN):
        raise HTTPException(403, "Schedule is not open for guest registration")

    guest = Guest(
        schedule_id=schedule_id,
        name=body.name,
        gender=body.gender,
        estimated_skill=body.estimated_skill,
        registered_by=admin.id,
    )
    db.add(guest)
    await db.commit()
    await db.refresh(guest)
    return GuestOut.model_validate(guest)


@router.get("/schedules/{schedule_id}/guests", response_model=list[GuestOut])
async def list_guests(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Guest).where(Guest.schedule_id == schedule_id).order_by(Guest.created_at)
    )
    return [GuestOut.model_validate(g) for g in result.scalars().all()]


@router.delete("/guests/{guest_id}")
async def delete_guest(
    guest_id: uuid.UUID,
    admin: Member = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    guest = result.scalar_one_or_none()
    if not guest:
        raise HTTPException(404, "Guest not found")
    await db.delete(guest)
    await db.commit()
    return {"status": "deleted"}
