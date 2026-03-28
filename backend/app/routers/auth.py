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
    return RedirectResponse(f"{settings.FRONTEND_URL}/auth/callback#token={token}")


@router.post("/logout")
async def logout():
    """No-op. Token is stored client-side in localStorage."""
    return {"status": "ok"}
