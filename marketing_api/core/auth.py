from __future__ import annotations

from typing import Any

import jwt
from fastapi import Depends, HTTPException, Request

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
    return req.cookies.get(get_settings().trainer_auth_cookie_name)


def user_from_token(decoded: dict[str, Any]) -> dict[str, Any]:
    user_id = decoded.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=401, detail="INVALID_TOKEN")
    return {
        "id": user_id,
        "is_admin": decoded.get("is_admin") is True,
    }


async def get_current_user(req: Request) -> dict[str, Any]:
    token = _extract_token(req)
    if not token:
        raise HTTPException(status_code=401, detail="NOT_AUTHENTICATED")
    return user_from_token(_decode(token))


async def require_admin(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="ADMIN_REQUIRED")
    return user
