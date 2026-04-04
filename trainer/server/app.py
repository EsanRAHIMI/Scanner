import json
import logging
import os
import random
import re
import shutil
import subprocess
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urlencode
from urllib.request import Request

from typing_extensions import TypedDict

import yaml
from fastapi import Depends, FastAPI, File, HTTPException, Request as FastAPIRequest, Response, UploadFile
from fastapi.responses import FileResponse
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image

import io

from fastapi.middleware.cors import CORSMiddleware

import jwt
from email_validator import EmailNotValidError, validate_email
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

class ClassItem(TypedDict):
  id: str
  name: str


class NormalizedBBox(TypedDict):
  x: float
  y: float
  w: float
  h: float


class Annotation(TypedDict):
  class_id: str
  bbox: NormalizedBBox


QueueStatus = Literal["pending", "labeled"]


class QueueItem(TypedDict, total=False):
  item_id: str
  filename: str
  status: QueueStatus
  created_at: str
  annotation: Annotation


pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def _env_int(name: str, default: int) -> int:
  raw = os.environ.get(name)
  if not raw:
    return default
  try:
    return int(raw)
  except Exception:
    return default


def _env_str(name: str, default: str) -> str:
  raw = os.environ.get(name)
  return raw if raw else default


def _is_production() -> bool:
  return (os.environ.get("ENV") == "production") or (os.environ.get("NODE_ENV") == "production")


def _hash_password(password: str) -> str:
  return pwd_context.hash(password)


def _verify_password(password: str, password_hash: str) -> bool:
  try:
    return pwd_context.verify(password, password_hash)
  except Exception:
    return False


def _jwt_secret() -> str:
  secret = os.environ.get("TRAINER_JWT_SECRET")
  if not secret:
    raise HTTPException(status_code=500, detail="TRAINER_JWT_SECRET_NOT_SET")
  if len(secret.strip()) < 16:
    raise HTTPException(status_code=500, detail="TRAINER_JWT_SECRET_TOO_SHORT")
  return secret


def _auth_cookie_name() -> str:
  return _env_str("TRAINER_AUTH_COOKIE_NAME", "trainer_auth")


def _cookie_domain() -> str | None:
  raw = os.environ.get("TRAINER_COOKIE_DOMAIN")
  if not raw:
    return None
  v = raw.strip()
  return v if v else None


def _admin_email_norm() -> str:
  raw = os.environ.get("TRAINER_ADMIN_EMAIL")
  v = raw.strip().lower() if isinstance(raw, str) else ""
  return v if v else "ehsanrahimi8@gmail.com"


def _normalize_role(value: Any) -> str:
  if not isinstance(value, str):
    return "user"
  v = value.strip().lower()
  if v in ["user", "sales", "admin"]:
    return v
  return "user"


def _normalize_permissions(value: Any) -> list[str]:
  if not isinstance(value, list):
    return []
  out: list[str] = []
  for item in value:
    if isinstance(item, str) and item.strip():
      out.append(item.strip())
  return sorted(set(out))


def _create_access_token(*, user_id: str, is_admin: bool, permissions: list[str]) -> str:
  now = int(time.time())
  exp_s = _env_int("TRAINER_JWT_EXPIRES_SECONDS", 60 * 60 * 24 * 7)
  payload = {
    "sub": user_id,
    "iat": now,
    "exp": now + exp_s,
    "is_admin": bool(is_admin),
    "permissions": permissions,
  }
  return jwt.encode(payload, _jwt_secret(), algorithm="HS256")


def _decode_access_token(token: str) -> dict[str, Any]:
  try:
    decoded = jwt.decode(token, _jwt_secret(), algorithms=["HS256"])
  except jwt.ExpiredSignatureError:
    raise HTTPException(status_code=401, detail="TOKEN_EXPIRED")
  except Exception:
    raise HTTPException(status_code=401, detail="INVALID_TOKEN")
  if not isinstance(decoded, dict):
    raise HTTPException(status_code=401, detail="INVALID_TOKEN")
  return decoded


def _utc_now_iso() -> str:
  return datetime.now(timezone.utc).isoformat()


_CONTENT_CALENDAR_FIELDS = [
  "Title",
  "Publish Date",
  "Day of Week",
  "Content Pillar",
  "Format",
  "Status",
  "Content Link",
  "Caption Idea",
  "CTA",
  "Tone of Voice",
  "Target Audience",
  "Week Number",
  "# Hashtag",
  "Product",
  "Product Image",
]


def _sanitize_content_calendar_fields(raw: Any) -> dict[str, Any]:
  if not isinstance(raw, dict):
    return {}
  out: dict[str, Any] = {}
  for k in _CONTENT_CALENDAR_FIELDS:
    if k in raw:
      out[k] = raw.get(k)
  return out


def _safe_write_json(path: Path, data: Any) -> None:
  tmp = path.with_suffix(path.suffix + ".tmp")
  tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
  tmp.replace(path)


def _read_json(path: Path, default: Any) -> Any:
  if not path.exists():
    return default
  try:
    return json.loads(path.read_text(encoding="utf-8"))
  except Exception:
    return default





def _validate_class_id(value: str) -> None:
  if not value:
    raise HTTPException(status_code=400, detail="INVALID_CLASS_ID")
  if not re.fullmatch(r"[a-z0-9_-]+", value):
    raise HTTPException(status_code=400, detail="INVALID_CLASS_ID")


api = FastAPI(title="Lorenzo Trainer Server")

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
app.mount("/trainer/api", api)
app.mount("/api", api)
app.mount("/", api)


def _get_db():
  db = getattr(app.state, "mongo_db", None)
  if db is None:
    raise HTTPException(status_code=503, detail="MONGODB_NOT_CONFIGURED")
  return db


async def _get_current_user(req: FastAPIRequest, db=Depends(_get_db)) -> dict[str, Any]:
  token = None
  auth_header = req.headers.get("authorization")
  if auth_header and auth_header.lower().startswith("bearer "):
    token = auth_header.split(" ", 1)[1].strip()
  if not token:
    token = req.cookies.get(_auth_cookie_name())
  if not token:
    raise HTTPException(status_code=401, detail="NOT_AUTHENTICATED")

  decoded = _decode_access_token(token)
  user_id = decoded.get("sub")
  if not isinstance(user_id, str) or not user_id:
    raise HTTPException(status_code=401, detail="INVALID_TOKEN")

  user = await db["users"].find_one({"_id": user_id})
  if not user:
    raise HTTPException(status_code=401, detail="USER_NOT_FOUND")
  if user.get("status") != "approved":
    raise HTTPException(status_code=403, detail="USER_NOT_APPROVED")

  user["permissions"] = _normalize_permissions(user.get("permissions"))
  return user


async def _require_admin(user: dict[str, Any] = Depends(_get_current_user)) -> dict[str, Any]:
  if user.get("is_admin") is True:
    return user
  raise HTTPException(status_code=403, detail="ADMIN_ONLY")

api.add_middleware(
  CORSMiddleware,
  allow_origins=[
    "http://localhost:3010",
    "http://127.0.0.1:3010",
    "http://localhost:3004",
    "http://127.0.0.1:3004",
    "http://localhost:3003",
    "http://127.0.0.1:3003",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://scanner.ehsanrahimi.com",
    "https://products.ehsanrahimi.com",
    "https://marketing.ehsanrahimi.com",
    "https://trainer.ehsanrahimi.com",
  ],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent

try:
  from dotenv import load_dotenv  # type: ignore

  load_dotenv(dotenv_path=BASE_DIR / ".env", override=False)
except Exception:
  pass


_log = logging.getLogger("uvicorn.error")


@app.on_event("startup")
async def _startup_mongo_after_env_loaded():
  uri = os.environ.get("MONGODB_URI")
  db_name = _env_str("MONGODB_DB_NAME", "trainer")

  if not uri:
    app.state.mongo_client = None
    app.state.mongo_db = None
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", flush=True)
    print("⚠  [MongoDB] MONGODB_URI is not set in .env", flush=True)
    print("   Auth endpoints (login/register/me) will return 503.", flush=True)
    print("   Fix: set MONGODB_URI, TRAINER_JWT_SECRET, TRAINER_ADMIN_EMAIL", flush=True)
    print("        in trainer/server/.env", flush=True)
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", flush=True)
    return

  uri_display = uri[:40] + "..." if len(uri) > 40 else uri
  print(f"[MongoDB] Connecting to db='{db_name}' uri={uri_display}", flush=True)

  try:
    client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=8000)
    await client.admin.command("ping")
  except Exception as e:
    app.state.mongo_client = None
    app.state.mongo_db = None
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", flush=True)
    print(f"✗  [MongoDB] Connection FAILED: {e}", flush=True)
    print("   Check: MONGODB_URI value, Atlas Network Access (IP whitelist),", flush=True)
    print("          and database user credentials.", flush=True)
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", flush=True)
    return

  app.state.mongo_client = client
  app.state.mongo_db = client[db_name]
  print("[MongoDB] ✓ Connected successfully.", flush=True)

  try:
    users = app.state.mongo_db["users"]
    await users.create_index("email", unique=True)
    await users.create_index("username", unique=True)
    await users.create_index("status")
    print("[MongoDB] ✓ Indexes ensured on 'users' collection.", flush=True)
  except Exception as e:
    print(f"[MongoDB] ⚠  Could not create indexes: {e}", flush=True)

  admin_email_norm = _admin_email_norm()
  try:
    existing = await users.find_one({"email": admin_email_norm})
    if existing is not None:
      await users.update_one(
        {"_id": existing.get("_id")},
        {"$set": {"is_admin": True, "role": "admin", "status": "approved", "updated_at": _utc_now_iso()}},
      )
      print(f"[MongoDB] ✓ Admin '{admin_email_norm}' marked approved+admin.", flush=True)
    else:
      print(f"[MongoDB] ℹ  Admin '{admin_email_norm}' not registered yet — auto-approved on first register.", flush=True)
  except Exception as e:
    print(f"[MongoDB] ⚠  Admin bootstrap error: {e}", flush=True)



@app.on_event("shutdown")
async def _shutdown_mongo_after_env_loaded():
  client = getattr(app.state, "mongo_client", None)
  try:
    if client is not None:
      client.close()
  except Exception:
    pass

STORAGE_DIR = BASE_DIR / "storage"
UPLOADS_DIR = STORAGE_DIR / "uploads"
DATASETS_DIR = STORAGE_DIR / "datasets"
RUNS_DIR = STORAGE_DIR / "runs"

CLASSES_PATH = STORAGE_DIR / "classes.json"
QUEUE_PATH = STORAGE_DIR / "queue.json"

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
DATASETS_DIR.mkdir(parents=True, exist_ok=True)
RUNS_DIR.mkdir(parents=True, exist_ok=True)


api.mount("/files", StaticFiles(directory=str(STORAGE_DIR)), name="files")


@api.get("/health")
def health():
  return {"status": "ok"}


@api.post("/auth/register")
async def auth_register(payload: dict[str, Any], db=Depends(_get_db)):
  email_raw = payload.get("email")
  username_raw = payload.get("username")
  password_raw = payload.get("password")

  if not isinstance(email_raw, str) or not isinstance(username_raw, str) or not isinstance(password_raw, str):
    raise HTTPException(status_code=400, detail="INVALID_PAYLOAD")

  email_raw = email_raw.strip()
  username_raw = username_raw.strip()
  password_raw = password_raw.strip()

  if len(username_raw) < 3 or len(username_raw) > 50:
    raise HTTPException(status_code=400, detail="INVALID_USERNAME")
  if not re.fullmatch(r"[a-zA-Z0-9_.-]+", username_raw):
    raise HTTPException(status_code=400, detail="INVALID_USERNAME")
  if len(password_raw) < 8:
    raise HTTPException(status_code=400, detail="WEAK_PASSWORD")

  try:
    v = validate_email(email_raw)
    email_norm = v.email.lower()
  except EmailNotValidError:
    raise HTTPException(status_code=400, detail="INVALID_EMAIL")

  admin_email_norm = _admin_email_norm()
  is_admin = bool(email_norm == admin_email_norm)
  status = "approved" if is_admin else "pending"
  role = "admin" if is_admin else "user"

  user_id = uuid.uuid4().hex
  doc = {
    "_id": user_id,
    "email": email_norm,
    "username": username_raw,
    "password_hash": _hash_password(password_raw),
    "status": status,
    "is_admin": is_admin,
    "role": role,
    "permissions": ["trainer:all"] if is_admin else [],
    "created_at": _utc_now_iso(),
    "updated_at": _utc_now_iso(),
  }

  try:
    await db["users"].insert_one(doc)
  except Exception as e:
    msg = str(e)
    if "E11000" in msg and "email" in msg:
      raise HTTPException(status_code=409, detail="EMAIL_ALREADY_EXISTS")
    if "E11000" in msg and "username" in msg:
      raise HTTPException(status_code=409, detail="USERNAME_ALREADY_EXISTS")
    raise HTTPException(status_code=500, detail="USER_CREATE_FAILED")

  return {"status": status, "user_id": user_id}


@api.post("/auth/login")
async def auth_login(payload: dict[str, Any], response: Response, req: FastAPIRequest, db=Depends(_get_db)):
  email_raw = payload.get("email")
  password_raw = payload.get("password")

  if not isinstance(email_raw, str) or not isinstance(password_raw, str):
    raise HTTPException(status_code=400, detail="INVALID_PAYLOAD")

  try:
    v = validate_email(email_raw.strip())
    email_norm = v.email.lower()
  except EmailNotValidError:
    raise HTTPException(status_code=400, detail="INVALID_EMAIL")

  user = await db["users"].find_one({"email": email_norm})
  if not user:
    raise HTTPException(status_code=401, detail="INVALID_CREDENTIALS")
  if user.get("status") != "approved":
    raise HTTPException(status_code=403, detail="USER_NOT_APPROVED")

  password_hash = user.get("password_hash")
  if not isinstance(password_hash, str) or not _verify_password(password_raw, password_hash):
    raise HTTPException(status_code=401, detail="INVALID_CREDENTIALS")

  permissions = _normalize_permissions(user.get("permissions"))
  token = _create_access_token(user_id=user.get("_id"), is_admin=bool(user.get("is_admin")), permissions=permissions)

  is_https = (req.url.scheme == "https")
  secure_cookie = _is_production() and is_https
  cookie_domain = _cookie_domain()

  response.set_cookie(
    key=_auth_cookie_name(),
    value=token,
    httponly=True,
    secure=secure_cookie,
    samesite="lax",
    path="/",
    domain=cookie_domain,
  )

  response.set_cookie(
    key="trainer_logged_in",
    value="1",
    httponly=False,
    secure=secure_cookie,
    samesite="lax",
    path="/",
    domain=cookie_domain,
  )

  return {"ok": True}


@api.post("/auth/logout")
async def auth_logout(response: Response):
  cookie_domain = _cookie_domain()
  response.delete_cookie(key=_auth_cookie_name(), path="/", domain=cookie_domain)
  response.delete_cookie(key="trainer_logged_in", path="/", domain=cookie_domain)
  return {"ok": True}


@api.get("/auth/me")
async def auth_me(user: dict[str, Any] = Depends(_get_current_user)):
  return {
    "id": user.get("_id"),
    "email": user.get("email"),
    "username": user.get("username"),
    "status": user.get("status"),
    "is_admin": bool(user.get("is_admin")),
    "role": _normalize_role(user.get("role")),
    "permissions": _normalize_permissions(user.get("permissions")),
  }


@api.get("/content-calendar")
async def content_calendar_list(
  limit: int = 200,
  skip: int = 0,
  _: dict[str, Any] = Depends(_get_current_user),
  db=Depends(_get_db),
):
  lim = max(1, min(int(limit), 500))
  sk = max(0, int(skip))

  items: list[dict[str, Any]] = []
  cursor = (
    db["content_calendar"]
    .find({}, {"_id": 1, "fields": 1, "publish_date": 1, "created_at": 1, "updated_at": 1})
    .sort([("publish_date", 1), ("created_at", -1)])
    .skip(sk)
    .limit(lim)
  )
  async for doc in cursor:
    items.append(
      {
        "id": doc.get("_id"),
        "fields": doc.get("fields") or {},
        "publish_date": doc.get("publish_date"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
      }
    )

  return {"items": items, "limit": lim, "skip": sk}


@api.post("/content-calendar")
async def content_calendar_create(
  payload: dict[str, Any],
  user: dict[str, Any] = Depends(_get_current_user),
  db=Depends(_get_db),
):
  raw_fields = payload.get("fields") if isinstance(payload, dict) else None
  fields = _sanitize_content_calendar_fields(raw_fields)

  now = _utc_now_iso()
  doc_id = str(uuid.uuid4())
  publish_date = fields.get("Publish Date")
  publish_date_norm = publish_date if isinstance(publish_date, str) and publish_date.strip() else None

  doc = {
    "_id": doc_id,
    "fields": fields,
    "publish_date": publish_date_norm,
    "created_at": now,
    "updated_at": now,
    "created_by": user.get("_id"),
    "updated_by": user.get("_id"),
  }

  await db["content_calendar"].insert_one(doc)
  return {
    "id": doc_id,
    "fields": fields,
    "publish_date": publish_date_norm,
    "created_at": now,
    "updated_at": now,
  }


@api.patch("/content-calendar/{item_id}")
async def content_calendar_update(
  item_id: str,
  payload: dict[str, Any],
  user: dict[str, Any] = Depends(_get_current_user),
  db=Depends(_get_db),
):
  raw_fields = payload.get("fields") if isinstance(payload, dict) else None
  patch_fields = _sanitize_content_calendar_fields(raw_fields)
  if not patch_fields:
    raise HTTPException(status_code=400, detail="EMPTY_PATCH")

  now = _utc_now_iso()
  update_doc: dict[str, Any] = {"updated_at": now, "updated_by": user.get("_id")}
  for k, v in patch_fields.items():
    update_doc[f"fields.{k}"] = v
  if "Publish Date" in patch_fields:
    v = patch_fields.get("Publish Date")
    update_doc["publish_date"] = v if isinstance(v, str) and v.strip() else None

  res = await db["content_calendar"].update_one({"_id": item_id}, {"$set": update_doc})
  if res.matched_count == 0:
    raise HTTPException(status_code=404, detail="NOT_FOUND")

  doc = await db["content_calendar"].find_one(
    {"_id": item_id},
    {"_id": 1, "fields": 1, "publish_date": 1, "created_at": 1, "updated_at": 1},
  )
  if not doc:
    raise HTTPException(status_code=404, detail="NOT_FOUND")

  return {
    "id": doc.get("_id"),
    "fields": doc.get("fields") or {},
    "publish_date": doc.get("publish_date"),
    "created_at": doc.get("created_at"),
    "updated_at": doc.get("updated_at"),
  }


@api.delete("/content-calendar/{item_id}")
async def content_calendar_delete(
  item_id: str,
  _: dict[str, Any] = Depends(_get_current_user),
  db=Depends(_get_db),
):
  res = await db["content_calendar"].delete_one({"_id": item_id})
  if res.deleted_count == 0:
    raise HTTPException(status_code=404, detail="NOT_FOUND")
  return {"ok": True}


@api.get("/admin/users")
async def admin_users(_: dict[str, Any] = Depends(_require_admin), db=Depends(_get_db)):
  out: list[dict[str, Any]] = []
  async for u in db["users"].find({}, {"password_hash": 0}).sort("created_at", -1):
    out.append(
      {
        "id": u.get("_id"),
        "email": u.get("email"),
        "username": u.get("username"),
        "status": u.get("status"),
        "is_admin": bool(u.get("is_admin")),
        "role": _normalize_role(u.get("role")),
        "permissions": _normalize_permissions(u.get("permissions")),
        "created_at": u.get("created_at"),
        "updated_at": u.get("updated_at"),
      }
    )
  return {"users": out}


@api.patch("/admin/users/{user_id}")
async def admin_update_user(
  user_id: str,
  payload: dict[str, Any],
  _: dict[str, Any] = Depends(_require_admin),
  db=Depends(_get_db),
):
  patch: dict[str, Any] = {}

  if "status" in payload:
    status = payload.get("status")
    if status not in ["pending", "approved", "disabled"]:
      raise HTTPException(status_code=400, detail="INVALID_STATUS")
    patch["status"] = status

  if "is_admin" in payload:
    is_admin = payload.get("is_admin")
    if not isinstance(is_admin, bool):
      raise HTTPException(status_code=400, detail="INVALID_IS_ADMIN")
    patch["is_admin"] = is_admin

  if "permissions" in payload:
    patch["permissions"] = _normalize_permissions(payload.get("permissions"))

  if "role" in payload:
    patch["role"] = _normalize_role(payload.get("role"))

  if not patch:
    raise HTTPException(status_code=400, detail="EMPTY_PATCH")

  patch["updated_at"] = _utc_now_iso()
  res = await db["users"].update_one({"_id": user_id}, {"$set": patch})
  if res.matched_count == 0:
    raise HTTPException(status_code=404, detail="USER_NOT_FOUND")

  return {"ok": True}


@api.get("/dam/assets")
async def dam_assets(
  _: dict[str, Any] = Depends(_get_current_user), 
  db=Depends(_get_db)
):
  records: list[dict[str, Any]] = []
  cursor = db["dam_assets"].find({}).sort("created_at", -1).limit(2000)
  
  async for doc in cursor:
    records.append({
      "id": doc.get("_id"),
      "fields": doc.get("fields") or {},
      "createdTime": doc.get("created_at")
    })

  columns_set: set[str] = set()
  for r in records:
    f = r.get("fields")
    if isinstance(f, dict):
      for k in f.keys():
        columns_set.add(k)

  # Ensure the DAM column is always present for the UI
  columns_set.add("DAM")

  columns = sorted(columns_set)
  return {"columns": columns, "records": records, "count": len(records)}


@api.get("/public/products/assets")
async def public_products_assets(db=Depends(_get_db)):
  records: list[dict[str, Any]] = []
  cursor = db["products"].find({}).sort("created_at", -1).limit(2000)
  
  async for doc in cursor:
    records.append({
      "id": doc.get("_id"),
      "fields": doc.get("fields") or {},
      "createdTime": doc.get("created_at")
    })

  columns_set: set[str] = set()
  for r in records:
    f = r.get("fields")
    if isinstance(f, dict):
      for k in f.keys():
        columns_set.add(k)
  columns_set.add("DAM")
  columns = sorted(columns_set)

  return {"columns": columns, "records": records, "count": len(records)}





@api.patch("/products/assets/{record_id}")
async def patch_product_asset(
  record_id: str,
  payload: dict[str, Any],
  user: dict[str, Any] = Depends(_get_current_user),
  db=Depends(_get_db),
):
  if _normalize_role(user.get("role")) not in ["admin", "sales"]:
    raise HTTPException(status_code=403, detail="FORBIDDEN_ROLE")

  fields_to_update = payload.get("fields")
  if not isinstance(fields_to_update, dict):
    raise HTTPException(status_code=400, detail="INVALID_PAYLOAD_EXPECTED_FIELDS")

  update_doc = {"updated_at": _utc_now_iso()}
  for k, v in fields_to_update.items():
    update_doc[f"fields.{k}"] = v

  res = await db["products"].update_one({"_id": record_id}, {"$set": update_doc})
  if res.matched_count == 0:
    raise HTTPException(status_code=404, detail="PRODUCT_NOT_FOUND")

  doc = await db["products"].find_one({"_id": record_id})
  return {"id": doc["_id"], "fields": doc["fields"]}


@api.get("/products/assets")
async def products_assets(
  _: dict[str, Any] = Depends(_get_current_user), 
  db=Depends(_get_db)
):
  records: list[dict[str, Any]] = []
  cursor = db["products"].find({}).sort("created_at", -1).limit(2000)
  
  async for doc in cursor:
    records.append({
      "id": doc.get("_id"),
      "fields": doc.get("fields") or {},
      "createdTime": doc.get("created_at")
    })

  columns_set: set[str] = set()
  for r in records:
    f = r.get("fields")
    if isinstance(f, dict):
      for k in f.keys():
        columns_set.add(k)

  columns = sorted(columns_set)
  return {"columns": columns, "records": records, "count": len(records)}


@api.get("/dam/collection-code")
async def dam_collection_code(collection_name: str, db=Depends(_get_db)):
  name = collection_name.strip()
  if not name:
    raise HTTPException(status_code=400, detail="COLLECTION_NAME_REQUIRED")

  # Search in dam_assets where "Collection Name" matches (case-insensitive)
  # Airtable filter formula was: LOWER({Collection Name})=LOWER("name")
  import re
  query = {"fields.Collection Name": re.compile(f"^{re.escape(name)}$", re.IGNORECASE)}
  
  doc = await db["dam_assets"].find_one(query)
  
  if not doc or not doc.get("fields"):
    return {"collection_name": name, "collection_code": None, "variant_number": None, "price": None}

  fields = doc["fields"]
  
  def _format_field(val):
    if val is None: return None
    if isinstance(val, (int, float)):
      return str(int(val)) if float(val).is_integer() else str(val)
    if isinstance(val, str):
      return val.strip()
    return str(val)

  return {
    "collection_name": name,
    "collection_code": _format_field(fields.get("Collection Code")),
    "variant_number": _format_field(fields.get("Variant Number")),
    "price": _format_field(fields.get("Price")),
  }


def _load_classes() -> list[ClassItem]:
  data = _read_json(CLASSES_PATH, [])
  if not isinstance(data, list):
    return []
  out: list[ClassItem] = []
  for item in data:
    if not isinstance(item, dict):
      continue
    cid = item.get("id")
    name = item.get("name")
    if isinstance(cid, str) and isinstance(name, str):
      out.append({"id": cid, "name": name})
  return out


def _save_classes(items: list[ClassItem]) -> None:
  _safe_write_json(CLASSES_PATH, items)


@api.get("/classes")
def get_classes():
  return _load_classes()


class _CreateClassBody(TypedDict):
  id: str
  name: str


@api.post("/classes")
def create_class(body: _CreateClassBody):
  cid = body.get("id")
  name = body.get("name")
  if not isinstance(cid, str) or not isinstance(name, str):
    raise HTTPException(status_code=400, detail="INVALID_BODY")
  _validate_class_id(cid)

  items = _load_classes()
  if any(c["id"] == cid for c in items):
    raise HTTPException(status_code=409, detail="CLASS_EXISTS")

  items.append({"id": cid, "name": name})
  _save_classes(items)
  return {"created": True}


class _RenameClassBody(TypedDict):
  name: str


@api.put("/classes/{class_id}")
def rename_class(class_id: str, body: _RenameClassBody):
  name = body.get("name")
  if not isinstance(name, str) or not name:
    raise HTTPException(status_code=400, detail="INVALID_BODY")

  items = _load_classes()
  found = False
  for c in items:
    if c["id"] == class_id:
      c["name"] = name
      found = True
      break

  if not found:
    raise HTTPException(status_code=404, detail="CLASS_NOT_FOUND")

  _save_classes(items)
  return {"updated": True}


@api.delete("/classes/{class_id}")
def delete_class(class_id: str):
  items = _load_classes()
  new_items = [c for c in items if c["id"] != class_id]
  if len(new_items) == len(items):
    raise HTTPException(status_code=404, detail="CLASS_NOT_FOUND")
  _save_classes(new_items)
  return {"deleted": True}


def _load_queue() -> list[QueueItem]:
  data = _read_json(QUEUE_PATH, [])
  if not isinstance(data, list):
    return []
  out: list[QueueItem] = []
  for item in data:
    if not isinstance(item, dict):
      continue
    item_id = item.get("item_id")
    filename = item.get("filename")
    status = item.get("status")
    created_at = item.get("created_at")
    annotation = item.get("annotation")

    if not isinstance(item_id, str) or not isinstance(filename, str):
      continue
    if status not in ("pending", "labeled"):
      status = "pending"

    qi: QueueItem = {
      "item_id": item_id,
      "filename": filename,
      "status": status,
      "created_at": created_at if isinstance(created_at, str) else _utc_now_iso(),
    }
    if isinstance(annotation, dict):
      qi["annotation"] = annotation  # type: ignore[assignment]
    out.append(qi)

  return out


def _save_queue(items: list[QueueItem]) -> None:
  _safe_write_json(QUEUE_PATH, items)


def _unlink_if_exists(p: Path) -> None:
  try:
    if p.exists():
      p.unlink()
  except Exception:
    return


@api.post("/uploads")
async def upload_image(file: UploadFile = File(...)):
  if not file.content_type or not file.content_type.startswith("image/"):
    raise HTTPException(status_code=400, detail="INVALID_IMAGE")

  raw = await file.read()
  try:
    img = Image.open(io.BytesIO(raw)).convert("RGB")
  except Exception:
    raise HTTPException(status_code=400, detail="INVALID_IMAGE")

  item_id = str(uuid.uuid4())
  filename = f"{item_id}.jpg"
  path = UPLOADS_DIR / filename
  img.save(path, format="JPEG", quality=92)

  queue = _load_queue()
  queue.insert(
    0,
    {
      "item_id": item_id,
      "filename": filename,
      "status": "pending",
      "created_at": _utc_now_iso(),
    },
  )
  _save_queue(queue)

  return {
    "item_id": item_id,
    "image_url": f"/files/uploads/{filename}",
  }


@api.get("/queue")
def get_queue():
  items = _load_queue()
  for item in items:
    item["image_url"] = f"/files/uploads/{item['filename']}"
  return items


@api.get("/queue/{item_id}")
def get_queue_item(item_id: str):
  items = _load_queue()
  for item in items:
    if item["item_id"] == item_id:
      item["image_url"] = f"/files/uploads/{item['filename']}"
      return item
  raise HTTPException(status_code=404, detail="ITEM_NOT_FOUND")


@api.delete("/queue/{item_id}")
def delete_queue_item(item_id: str):
  items = _load_queue()
  target: QueueItem | None = None
  new_items: list[QueueItem] = []
  for it in items:
    if it.get("item_id") == item_id:
      target = it
      continue
    new_items.append(it)

  if target is None:
    raise HTTPException(status_code=404, detail="ITEM_NOT_FOUND")

  _save_queue(new_items)

  filename = target.get("filename")
  if isinstance(filename, str) and filename:
    _unlink_if_exists(UPLOADS_DIR / filename)

    ds_dir = _dataset_dir()
    stem = Path(filename).stem
    for split in ("train", "val"):
      _unlink_if_exists(ds_dir / "images" / split / filename)
      _unlink_if_exists(ds_dir / "labels" / split / f"{stem}.txt")

  return {"deleted": True}


@api.post("/queue/{item_id}/delete")
def delete_queue_item_post(item_id: str):
  return delete_queue_item(item_id)


class _SaveAnnotationBody(TypedDict):
  class_id: str
  bbox: NormalizedBBox


def _validate_bbox(b: NormalizedBBox) -> None:
  for k in ("x", "y", "w", "h"):
    v = b.get(k)
    if not isinstance(v, (float, int)):
      raise HTTPException(status_code=400, detail="INVALID_BBOX")
    if float(v) < 0 or float(v) > 1:
      raise HTTPException(status_code=400, detail="INVALID_BBOX")
  if float(b["w"]) <= 0 or float(b["h"]) <= 0:
    raise HTTPException(status_code=400, detail="INVALID_BBOX")


@api.post("/queue/{item_id}/annotation")
def save_annotation(item_id: str, body: _SaveAnnotationBody):
  class_id = body.get("class_id")
  bbox = body.get("bbox")
  if not isinstance(class_id, str) or not isinstance(bbox, dict):
    raise HTTPException(status_code=400, detail="INVALID_BODY")

  _validate_bbox(bbox)  # type: ignore[arg-type]

  classes = _load_classes()
  if not any(c["id"] == class_id for c in classes):
    raise HTTPException(status_code=400, detail="UNKNOWN_CLASS")

  items = _load_queue()
  found = False
  for item in items:
    if item["item_id"] == item_id:
      item["annotation"] = {"class_id": class_id, "bbox": bbox}  # type: ignore[assignment]
      item["status"] = "labeled"
      found = True
      break

  if not found:
    raise HTTPException(status_code=404, detail="ITEM_NOT_FOUND")

  _save_queue(items)
  return {"saved": True}


def _dataset_dir() -> Path:
  return DATASETS_DIR / "lorenzo_v1"


@api.post("/export")
def export_dataset():
  ds_dir = _dataset_dir()
  images_train = ds_dir / "images" / "train"
  images_val = ds_dir / "images" / "val"
  labels_train = ds_dir / "labels" / "train"
  labels_val = ds_dir / "labels" / "val"

  for d in (images_train, images_val, labels_train, labels_val):
    d.mkdir(parents=True, exist_ok=True)

  classes = _load_classes()
  class_to_index = {c["id"]: i for i, c in enumerate(classes)}
  if not classes:
    raise HTTPException(status_code=400, detail="NO_CLASSES")

  queue = _load_queue()
  labeled = [q for q in queue if q.get("status") == "labeled" and isinstance(q.get("annotation"), dict)]
  if not labeled:
    raise HTTPException(status_code=400, detail="NO_LABELED_ITEMS")

  rng = random.Random(42)
  ids = [q["item_id"] for q in labeled if isinstance(q.get("item_id"), str)]
  ids_sorted = sorted(ids)
  rng.shuffle(ids_sorted)

  split = max(1, int(len(ids_sorted) * 0.8))
  train_ids = set(ids_sorted[:split])

  for item in labeled:
    item_id = item["item_id"]
    filename = item["filename"]
    ann = item.get("annotation")
    if not isinstance(ann, dict):
      continue

    class_id = ann.get("class_id")
    bbox = ann.get("bbox")
    if not isinstance(class_id, str) or not isinstance(bbox, dict):
      continue

    class_index = class_to_index.get(class_id)
    if class_index is None:
      continue

    src_img = UPLOADS_DIR / filename
    if not src_img.exists():
      continue

    is_train = item_id in train_ids
    dst_img_dir = images_train if is_train else images_val
    dst_label_dir = labels_train if is_train else labels_val

    dst_img = dst_img_dir / filename
    shutil.copyfile(src_img, dst_img)

    x = float(bbox["x"])
    y = float(bbox["y"])
    w = float(bbox["w"])
    h = float(bbox["h"])

    xc = x + w / 2
    yc = y + h / 2

    label_line = f"{class_index} {xc:.6f} {yc:.6f} {w:.6f} {h:.6f}\n"
    (dst_label_dir / f"{Path(filename).stem}.txt").write_text(label_line, encoding="utf-8")

  data_yaml = {
    "path": str(ds_dir),
    "train": "images/train",
    "val": "images/val",
    "names": [c["name"] for c in classes],
  }

  (ds_dir / "data.yaml").write_text(yaml.safe_dump(data_yaml, sort_keys=False), encoding="utf-8")

  return {
    "exported": True,
    "dataset": "lorenzo_v1",
    "path": str(ds_dir),
    "labeled_count": len(labeled),
  }


_jobs_lock = threading.Lock()
_jobs: dict[str, subprocess.Popen[bytes]] = {}


def _job_dir(job_id: str) -> Path:
  return RUNS_DIR / job_id


def _write_job_meta(job_id: str, meta: dict[str, Any]) -> None:
  _safe_write_json(_job_dir(job_id) / "job.json", meta)


def _read_job_meta(job_id: str) -> dict[str, Any] | None:
  p = _job_dir(job_id) / "job.json"
  data = _read_json(p, None)
  return data if isinstance(data, dict) else None


def _tail_lines(path: Path, n: int) -> list[str]:
  if not path.exists():
    return []
  text = path.read_text(encoding="utf-8", errors="ignore")
  lines = text.splitlines()
  return lines[-n:]


def _monitor_job(job_id: str, proc: subprocess.Popen[bytes], log_path: Path, run_dir: Path) -> None:
  status: Literal["running", "finished", "failed"] = "running"
  exit_code: int | None = None

  try:
    exit_code = proc.wait()
    status = "finished" if exit_code == 0 else "failed"
  except Exception:
    status = "failed"

  best_pt = run_dir / "weights" / "best.pt"
  meta = _read_job_meta(job_id) or {}
  meta["status"] = status
  meta["exit_code"] = exit_code
  meta["finished_at"] = _utc_now_iso()
  meta["best_pt"] = str(best_pt) if best_pt.exists() else None
  _write_job_meta(job_id, meta)

  with _jobs_lock:
    _jobs.pop(job_id, None)


class _TrainBody(TypedDict, total=False):
  epochs: int
  batch: int
  imgsz: int


@api.post("/train")
def start_train(body: _TrainBody):
  ds_dir = _dataset_dir()
  data_yaml = ds_dir / "data.yaml"
  if not data_yaml.exists():
    raise HTTPException(status_code=400, detail="DATASET_NOT_EXPORTED")

  epochs = int(body.get("epochs", 50))
  batch = int(body.get("batch", 8))
  imgsz = int(body.get("imgsz", 640))

  if epochs <= 0 or batch <= 0 or imgsz <= 0:
    raise HTTPException(status_code=400, detail="INVALID_PARAMS")

  job_id = str(uuid.uuid4())
  run_dir = _job_dir(job_id)
  run_dir.mkdir(parents=True, exist_ok=True)

  log_path = run_dir / "train.log"

  cmd = [
    "yolo",
    "train",
    "model=yolov8n.pt",
    f"data={str(data_yaml)}",
    f"imgsz={imgsz}",
    f"epochs={epochs}",
    f"batch={batch}",
    f"project={str(run_dir)}",
    "exist_ok=True",
  ]

  with log_path.open("wb") as log_file:
    try:
      proc = subprocess.Popen(
        cmd,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        cwd=str(BASE_DIR),
      )
    except FileNotFoundError:
      raise HTTPException(status_code=500, detail="ULTRALYTICS_NOT_INSTALLED")

  meta = {
    "job_id": job_id,
    "status": "running",
    "started_at": _utc_now_iso(),
    "params": {"epochs": epochs, "batch": batch, "imgsz": imgsz},
    "log_path": str(log_path),
    "run_dir": str(run_dir),
  }
  _write_job_meta(job_id, meta)

  with _jobs_lock:
    _jobs[job_id] = proc

  t = threading.Thread(target=_monitor_job, args=(job_id, proc, log_path, run_dir), daemon=True)
  t.start()

  return {"job_id": job_id, "status": "running"}


def _read_metrics(run_dir: Path) -> dict[str, Any] | None:
  results_csv = run_dir / "results.csv"
  if not results_csv.exists():
    return None

  try:
    rows = results_csv.read_text(encoding="utf-8", errors="ignore").splitlines()
    if len(rows) < 2:
      return None
    header = [h.strip() for h in rows[0].split(",")]
    last = [v.strip() for v in rows[-1].split(",")]
    if len(header) != len(last):
      return None
    d = dict(zip(header, last))

    keys = [
      "metrics/precision(B)",
      "metrics/recall(B)",
      "metrics/mAP50(B)",
      "metrics/mAP50-95(B)",
    ]
    out: dict[str, Any] = {}
    for k in keys:
      if k in d:
        try:
          out[k] = float(d[k])
        except Exception:
          out[k] = d[k]
    return out or None
  except Exception:
    return None


@api.get("/train/{job_id}")
def get_train_status(job_id: str, lines: int = 120):
  meta = _read_job_meta(job_id)
  if meta is None:
    raise HTTPException(status_code=404, detail="JOB_NOT_FOUND")

  log_path = Path(str(meta.get("log_path", "")))
  tail = _tail_lines(log_path, max(1, min(int(lines), 500)))

  run_dir = Path(str(meta.get("run_dir", "")))
  metrics = _read_metrics(run_dir)

  return {
    "job_id": job_id,
    "status": meta.get("status"),
    "best_pt": meta.get("best_pt"),
    "metrics": metrics,
    "log": tail,
  }


@api.post("/train/{job_id}/publish")
def publish(job_id: str):
  meta = _read_job_meta(job_id)
  if meta is None:
    raise HTTPException(status_code=404, detail="JOB_NOT_FOUND")

  best_pt = meta.get("best_pt")
  if not isinstance(best_pt, str) or not best_pt:
    raise HTTPException(status_code=400, detail="BEST_PT_NOT_AVAILABLE")

  src = Path(best_pt)
  if not src.exists():
    raise HTTPException(status_code=400, detail="BEST_PT_NOT_AVAILABLE")

  repo_root = BASE_DIR.parent.parent
  dst = repo_root / "backend" / "models" / "best.pt"
  dst.parent.mkdir(parents=True, exist_ok=True)
  shutil.copyfile(src, dst)

  return {"published": True, "path": str(dst)}
