"""Member endpoints: list, me, link."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_kakao_id, get_current_member
from app.database import get_db
from app.models.member import Member

router = APIRouter(prefix="/members", tags=["members"])


class MemberOut(BaseModel):
    id: uuid.UUID
    name: str
    gender: str
    ntrp: float
    is_admin: bool

    model_config = {"from_attributes": True}


class LinkRequest(BaseModel):
    member_id: uuid.UUID


@router.get("/", response_model=list[MemberOut])
async def list_members(db: AsyncSession = Depends(get_db)):
    """List all active members."""
    result = await db.execute(
        select(Member).where(Member.status == "ACTIVE").order_by(Member.name)
    )
    return result.scalars().all()


@router.get("/me", response_model=MemberOut)
async def get_me(member: Member = Depends(get_current_member)):
    """Get current authenticated member."""
    return member


@router.post("/link", response_model=MemberOut)
async def link_member(
    body: LinkRequest,
    kakao_id: str = Depends(get_current_kakao_id),
    db: AsyncSession = Depends(get_db),
):
    """Link kakao account to a member (first login only)."""
    # Check if kakao_id is already linked
    existing = await db.execute(select(Member).where(Member.kakao_id == kakao_id))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Kakao account already linked to a member")

    # Find the member
    result = await db.execute(select(Member).where(Member.id == body.member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(404, "Member not found")

    if member.kakao_id is not None:
        raise HTTPException(409, "Member already linked to another kakao account")

    member.kakao_id = kakao_id
    await db.commit()
    await db.refresh(member)
    return member
