"""Extended auth tests: JWT edge cases, expiry, invalid tokens."""
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import jwt as pyjwt
import pytest
from fastapi import HTTPException

from app.auth import create_jwt, decode_jwt
from app.config import settings


class TestCreateJwt:
    def test_produces_string(self):
        token = create_jwt("kakao123")
        assert isinstance(token, str)
        assert len(token) > 0

    def test_contains_kakao_id(self):
        token = create_jwt("kakao_abc")
        payload = pyjwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        assert payload["kakao_id"] == "kakao_abc"

    def test_contains_member_id_when_provided(self):
        mid = uuid.uuid4()
        token = create_jwt("kakao_abc", member_id=mid)
        payload = pyjwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        assert payload["member_id"] == str(mid)

    def test_has_exp_claim(self):
        token = create_jwt("kakao_abc")
        payload = pyjwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        assert "exp" in payload


class TestDecodeJwt:
    def test_roundtrip(self):
        token = create_jwt("id123")
        payload = decode_jwt(token)
        assert payload["kakao_id"] == "id123"

    def test_expired_token_raises(self):
        expired_payload = {
            "kakao_id": "old_user",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
        }
        token = pyjwt.encode(expired_payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
        with pytest.raises(HTTPException) as exc_info:
            decode_jwt(token)
        assert exc_info.value.status_code == 401
        assert "expired" in exc_info.value.detail.lower()

    def test_invalid_token_raises(self):
        with pytest.raises(HTTPException) as exc_info:
            decode_jwt("not.a.valid.token")
        assert exc_info.value.status_code == 401
        assert "invalid" in exc_info.value.detail.lower()

    def test_wrong_secret_raises(self):
        token = pyjwt.encode(
            {"kakao_id": "x", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            "wrong-secret",
            algorithm=settings.JWT_ALGORITHM,
        )
        with pytest.raises(HTTPException) as exc_info:
            decode_jwt(token)
        assert exc_info.value.status_code == 401

    def test_tampered_token_raises(self):
        token = create_jwt("legit_user")
        # Corrupt the signature portion (after the second dot)
        parts = token.split(".")
        sig = parts[2]
        # Reverse the signature to guarantee corruption
        parts[2] = sig[::-1] if sig[::-1] != sig else sig + "XX"
        tampered = ".".join(parts)
        with pytest.raises(HTTPException):
            decode_jwt(tampered)
