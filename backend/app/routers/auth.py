"""Kakao OAuth login/logout endpoints."""
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from app.auth import create_jwt
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

KAKAO_AUTH_URL = "https://kauth.kakao.com/oauth/authorize"
KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token"
KAKAO_USER_URL = "https://kapi.kakao.com/v2/user/me"


@router.get("/kakao")
async def kakao_login():
    """Redirect to Kakao OAuth authorization page."""
    params = urlencode({
        "client_id": settings.KAKAO_CLIENT_ID,
        "redirect_uri": settings.KAKAO_REDIRECT_URI,
        "response_type": "code",
    })
    return RedirectResponse(f"{KAKAO_AUTH_URL}?{params}")


@router.get("/kakao/callback")
async def kakao_callback(code: str = Query(...)):
    """Exchange code for token, get kakao_id, issue JWT, redirect to frontend."""
    # 1. code → access_token
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            KAKAO_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "client_id": settings.KAKAO_CLIENT_ID,
                "client_secret": settings.KAKAO_CLIENT_SECRET,
                "redirect_uri": settings.KAKAO_REDIRECT_URI,
                "code": code,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

    if token_resp.status_code != 200:
        raise HTTPException(502, f"Kakao token exchange failed: {token_resp.text}")

    access_token = token_resp.json()["access_token"]

    # 2. access_token → user info
    async with httpx.AsyncClient() as client:
        user_resp = await client.get(
            KAKAO_USER_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if user_resp.status_code != 200:
        raise HTTPException(502, f"Kakao user info failed: {user_resp.text}")

    kakao_id = str(user_resp.json()["id"])

    # 3. Issue JWT and pass via URL fragment (not query param, so it stays client-side)
    token = create_jwt(kakao_id)
    # basePath="/humbleb" on frontend, so callback is at /humbleb/auth/callback
    frontend_base = settings.FRONTEND_URL.rstrip("/")
    callback_path = "/humbleb/auth/callback" if "vesper" in frontend_base else "/auth/callback"
    return RedirectResponse(f"{frontend_base}{callback_path}#token={token}")


@router.post("/logout")
async def logout():
    """No-op. Token is stored client-side in localStorage."""
    return {"status": "ok"}


@router.get("/dev-login")
async def dev_login(
    request: Request,
    member_id: str = Query(...),
    redirect: str = Query(default=""),
):
    """Dev-only: issue a JWT for a member by ID, bypassing Kakao OAuth.

    Usage: GET /auth/dev-login?member_id=<uuid>[&redirect=http://...]
    """
    import uuid

    from sqlalchemy import select

    from app.database import async_session
    from app.models.member import Member

    try:
        mid = uuid.UUID(member_id)
    except ValueError:
        raise HTTPException(400, "Invalid member_id")

    async with async_session() as db:
        result = await db.execute(select(Member).where(Member.id == mid))
        member = result.scalar_one_or_none()
        if not member:
            raise HTTPException(404, "Member not found")

        kakao_id = member.kakao_id or f"dev_{member_id}"
        if not member.kakao_id:
            member.kakao_id = kakao_id
            db.add(member)
            await db.commit()

    token = create_jwt(kakao_id, mid)

    # Use custom redirect or default to FRONTEND_URL
    base = redirect or f"{settings.FRONTEND_URL}/humbleb"
    return RedirectResponse(f"{base}/auth/callback#token={token}")
