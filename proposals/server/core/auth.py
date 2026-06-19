from __future__ import annotations

from typing import Any

import jwt
from fastapi import Depends, HTTPException, Request

from .config import get_settings
from .db import get_db


def _decode_access_token(token: str) -> dict[str, Any]:
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


def normalize_role(value: Any) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip().lower()
    return "user"


async def get_current_user(req: Request) -> dict[str, Any]:
    """Validate the shared trainer JWT (cookie or Bearer) and load the user."""
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="MONGODB_NOT_CONFIGURED")

    settings = get_settings()
    token: str | None = None
    auth_header = req.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    if not token:
        token = req.cookies.get(settings.trainer_auth_cookie_name)
    if not token:
        raise HTTPException(status_code=401, detail="NOT_AUTHENTICATED")

    decoded = _decode_access_token(token)
    user_id = decoded.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="INVALID_TOKEN")

    user = await db["users"].find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="USER_NOT_FOUND")
    if user.get("status") not in (None, "approved"):
        raise HTTPException(status_code=403, detail="USER_NOT_APPROVED")
    return user


def is_platform_admin(user: dict[str, Any]) -> bool:
    return user.get("is_admin") is True or normalize_role(user.get("role")) == "admin"


def require_role(user: dict[str, Any], allowed: set[str]) -> dict[str, Any]:
    if is_platform_admin(user):
        return user
    if normalize_role(user.get("role")) in allowed:
        return user
    raise HTTPException(status_code=403, detail="FORBIDDEN_ROLE")


async def require_operator(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Sales or admin — anyone who can create/manage their own proposals."""
    return require_role(user, {"admin", "sales"})


async def require_admin(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    if not is_platform_admin(user):
        raise HTTPException(status_code=403, detail="FORBIDDEN_ROLE")
    return user


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": user.get("_id"),
        "username": user.get("username"),
        "email": user.get("email"),
        "role": normalize_role(user.get("role")),
        "is_admin": is_platform_admin(user),
    }
