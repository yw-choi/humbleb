"""JWT utilities and auth dependencies."""
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Cookie, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.member import Member


def create_jwt(kakao_id: str, member_id: uuid.UUID | None = None) -> str:
    payload = {
        "kakao_id": kakao_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS),
    }
    if member_id:
        payload["member_id"] = str(member_id)
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


async def get_current_kakao_id(
    humbleb_token: str | None = Cookie(None),
) -> str:
    if not humbleb_token:
        raise HTTPException(401, "Not authenticated")
    payload = decode_jwt(humbleb_token)
    return payload["kakao_id"]


async def get_current_member(
    kakao_id: str = Depends(get_current_kakao_id),
    db: AsyncSession = Depends(get_db),
) -> Member:
    result = await db.execute(select(Member).where(Member.kakao_id == kakao_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(403, "Member not linked. Complete first-login setup.")
    return member


async def require_admin(
    member: Member = Depends(get_current_member),
) -> Member:
    if not member.is_admin:
        raise HTTPException(403, "Admin access required")
    return member
