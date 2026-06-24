from __future__ import annotations

from typing import Any

import jwt
from fastapi import HTTPException, Request

from .config import get_settings


def _decode(token: str) -> dict[str, Any]:
    settings = get_settings()
    secret = settings.trainer_jwt_secret
    if not secret:
        raise HTTPException(status_code=500, detail="TRAINER_JWT_SECRET_NOT_SET")
    try:
        decoded = jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="TOKEN_EXPIRED")
    except Exception:
        raise HTTPException(status_code=401, detail="INVALID_TOKEN")
    if not isinstance(decoded, dict):
        raise HTTPException(status_code=401, detail="INVALID_TOKEN")
    return decoded


def _extract_token(req: Request) -> str | None:
    auth_header = req.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip()
    settings = get_settings()
    return req.cookies.get(settings.trainer_auth_cookie_name)


def _user_from_token(decoded: dict[str, Any]) -> dict[str, Any]:
    """Identity is taken from the signed token only — no cross-DB user lookup.

    The shared trainer JWT carries: sub, is_admin, permissions.
    """
    user_id = decoded.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=401, detail="INVALID_TOKEN")
    perms = decoded.get("permissions")
    return {
        "id": user_id,
        "is_admin": decoded.get("is_admin") is True,
        "permissions": perms if isinstance(perms, list) else [],
        "role": "admin" if decoded.get("is_admin") is True else "user",
    }


async def get_current_user(req: Request) -> dict[str, Any]:
    token = _extract_token(req)
    if not token:
        raise HTTPException(status_code=401, detail="NOT_AUTHENTICATED")
    return _user_from_token(_decode(token))


async def get_optional_user(req: Request) -> dict[str, Any] | None:
    """Returns the user if a valid token is present, else None (no error)."""
    token = _extract_token(req)
    if not token:
        return None
    try:
        return _user_from_token(_decode(token))
    except HTTPException:
        return None
