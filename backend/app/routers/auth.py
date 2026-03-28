"""Kakao OAuth login/logout endpoints."""
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.auth import create_jwt
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

KAKAO_AUTH_URL = "https://kauth.kakao.com/oauth/authorize"
KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token"
KAKAO_USER_URL = "https://kapi.kakao.com/v2/user/me"


@router.get("/kakao")
async def kakao_login():
    """Return Kakao OAuth authorization URL."""
    params = urlencode({
        "client_id": settings.KAKAO_CLIENT_ID,
        "redirect_uri": settings.KAKAO_REDIRECT_URI,
        "response_type": "code",
    })
    return {"url": f"{KAKAO_AUTH_URL}?{params}"}


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

    # 3. Issue JWT (member_id will be added after linking)
    token = create_jwt(kakao_id)

    # 4. Redirect to frontend with httpOnly cookie
    response = RedirectResponse(f"{settings.FRONTEND_URL}/auth/callback")
    response.set_cookie(
        key="humbleb_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=settings.JWT_EXPIRE_HOURS * 3600,
        path="/",
    )
    return response


@router.post("/logout")
async def logout():
    """Clear session cookie."""
    response = RedirectResponse(settings.FRONTEND_URL, status_code=303)
    response.delete_cookie("humbleb_token", path="/")
    return response
