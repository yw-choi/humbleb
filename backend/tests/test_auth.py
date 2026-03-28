"""Tests for auth utilities and member endpoints."""
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth import create_jwt, decode_jwt
from app.main import app


def test_jwt_roundtrip():
    kakao_id = "12345"
    member_id = uuid.uuid4()
    token = create_jwt(kakao_id, member_id)
    payload = decode_jwt(token)
    assert payload["kakao_id"] == kakao_id
    assert payload["member_id"] == str(member_id)


def test_jwt_without_member_id():
    token = create_jwt("99999")
    payload = decode_jwt(token)
    assert payload["kakao_id"] == "99999"
    assert "member_id" not in payload


@pytest.mark.asyncio
async def test_me_unauthenticated():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/members/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_unlinked():
    """Authenticated but kakao_id not linked to any member → 403."""
    token = create_jwt("unlinked_kakao_id")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/members/me", cookies={"humbleb_token": token})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_kakao_login_returns_url():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/auth/kakao")
    assert resp.status_code == 200
    assert "kauth.kakao.com" in resp.json()["url"]
