import asyncio
import json
import logging
import os
import re
import time
import traceback
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, TypedDict

from fastapi import FastAPI, File, Request, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image

import io

_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,128}$")


def _utc_timestamp_iso() -> str:
  return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _json_logger() -> logging.Logger:
  name = "lorenzo.backend"
  log = logging.getLogger(name)
  if log.handlers:
    return log
  log.setLevel(logging.INFO)
  log.propagate = False
  handler = logging.StreamHandler()
  handler.setFormatter(logging.Formatter("%(message)s"))
  log.addHandler(handler)
  return log


_json_log = _json_logger()

_REQUEST_ID_CTX: ContextVar[str | None] = ContextVar("request_id", default=None)


def _emit_json_log(level: int, payload: dict[str, Any]) -> None:
  out = dict(payload)
  if (
    "request_id" not in out
    and (cv_rid := _REQUEST_ID_CTX.get()) is not None
  ):
    out["request_id"] = cv_rid
  _json_log.log(level, json.dumps(out, default=str, separators=(",", ":")))


def _incoming_request_id(raw: str | None) -> str:
  if raw:
    stripped = raw.strip()
    if stripped and _REQUEST_ID_RE.fullmatch(stripped):
      return stripped
  return str(uuid.uuid4())


def _is_detect_route_path(path: str) -> bool:
  normalized = path.rstrip("/") or "/"
  return normalized.endswith("/detect")


def _env_path(name: str, default: str) -> Path:
  return Path(os.getenv(name, default)).expanduser().resolve()


def _resolve_model_path() -> Path:
  v = os.getenv("MODEL_PATH")
  if v:
    return Path(v).expanduser().resolve()

  docker_path = Path("/models/best.pt")
  if docker_path.exists():
    return docker_path

  return Path("./models/best.pt").expanduser().resolve()


def _yolo_inference_timeout_seconds() -> float:
  raw = os.getenv("YOLO_INFERENCE_TIMEOUT_SEC")
  default = 120.0
  if raw is None or str(raw).strip() == "":
    return default
  try:
    parsed = float(raw)
  except (TypeError, ValueError):
    return default
  if parsed <= 0:
    return default
  return max(5.0, min(parsed, 600.0))


def _health_probe_timeout_seconds() -> float:
  raw = os.getenv("HEALTH_INFERENCE_PROBE_TIMEOUT_MS")
  default_ms = 250.0
  if raw is None or str(raw).strip() == "":
    ms = default_ms
  else:
    try:
      ms = float(raw)
    except (TypeError, ValueError):
      ms = default_ms
    if ms <= 0:
      ms = default_ms
  ms = max(50.0, min(ms, 2000.0))
  return ms / 1000.0


# Frequent probes (e.g. aggressive orchestrator pings) multiply predict() load; set
# HEALTH_INFERENCE_PROBE_SKIP=true to skip inference and rely on model_loaded only.
def _health_probe_disabled() -> bool:
  v = os.getenv("HEALTH_INFERENCE_PROBE_SKIP", "").strip().lower()
  return v in ("1", "true", "yes", "on")


def _quick_yolo_predict(model: Any) -> None:
  img = Image.new("RGB", (32, 32), color=(0, 0, 0))
  model.predict(img, verbose=False)


class ProductSpecs(TypedDict):
  type: str
  finish: str


class Product(TypedDict):
  id: str
  name: str
  collection: str
  specs: ProductSpecs


class Detection(TypedDict):
  class_: str
  confidence: float
  bbox: list[float]
  product: Product


class DetectResponse(TypedDict):
  detections: list[dict[str, Any]]


api = FastAPI(title="Lorenzo YOLOv8 Detect Service")

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def _detect_request_logging_middleware(request: Request, call_next):
  path = request.url.path
  if not _is_detect_route_path(path):
    return await call_next(request)

  request_id = request.state.request_id
  started = time.perf_counter()
  try:
    response = await call_next(request)
  except Exception:
    ms = (time.perf_counter() - started) * 1000.0
    _emit_json_log(
      logging.ERROR,
      {
        "event": "detect_request",
        "timestamp": _utc_timestamp_iso(),
        "request_id": request_id,
        "path": path,
        "method": request.method,
        "processing_time_ms": round(ms, 3),
        "success": False,
        "status_code": 500,
        "error_kind": "unhandled_exception",
        "traceback": traceback.format_exc(),
      },
    )
    raise

  ms = (time.perf_counter() - started) * 1000.0
  code = getattr(response, "status_code", 500)
  ok = 200 <= code < 300
  payload: dict[str, Any] = {
    "event": "detect_request",
    "timestamp": _utc_timestamp_iso(),
    "request_id": request_id,
    "path": path,
    "method": request.method,
    "processing_time_ms": round(ms, 3),
    "success": ok,
    "status_code": code,
  }
  if not ok:
    payload["error_kind"] = "http_error_response"
  _emit_json_log(logging.INFO, payload)
  return response


@app.middleware("http")
async def _request_id_middleware(request: Request, call_next):
  request_id = _incoming_request_id(request.headers.get("x-request-id"))
  request.state.request_id = request_id
  rid_token = _REQUEST_ID_CTX.set(request_id)
  try:
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response
  finally:
    _REQUEST_ID_CTX.reset(rid_token)


app.mount("/api", api)
app.mount("/", api)

_PRODUCTS_PATH = Path(__file__).with_name("products.json")
_MODEL_PATH = _resolve_model_path()

_products_by_class: dict[str, Product] = {}
_yolo_model: Any | None = None
_yolo_load_error: Literal["MODEL_NOT_FOUND", "MODEL_LOAD_FAILED"] | None = None
_yolo_load_error_detail: str | None = None


def _load_products() -> dict[str, Product]:
  if not _PRODUCTS_PATH.exists():
    return {}
  raw = json.loads(_PRODUCTS_PATH.read_text(encoding="utf-8"))
  items = raw.get("products")
  if not isinstance(items, list):
    return {}

  out: dict[str, Product] = {}
  for item in items:
    if not isinstance(item, dict):
      continue
    cls = item.get("class")
    product = item.get("product")
    if isinstance(cls, str) and isinstance(product, dict):
      out[cls] = product  # type: ignore[assignment]
  return out


def _ensure_model_loaded() -> None:
  global _yolo_model, _yolo_load_error, _yolo_load_error_detail

  if _yolo_model is not None:
    return

  if _yolo_load_error is not None and _MODEL_PATH.exists():
    _yolo_load_error = None
    _yolo_load_error_detail = None

  if _yolo_load_error is not None:
    return

  if not _MODEL_PATH.exists():
    _yolo_load_error = "MODEL_NOT_FOUND"
    _yolo_load_error_detail = None
    return

  try:
    from ultralytics import YOLO  # type: ignore

    _yolo_model = YOLO(str(_MODEL_PATH))
  except Exception as e:
    _yolo_load_error = "MODEL_LOAD_FAILED"
    _yolo_load_error_detail = f"{type(e).__name__}: {e}"


@api.on_event("startup")
def _startup() -> None:
  global _products_by_class
  _products_by_class = _load_products()


@api.get("/health")
async def health():
  model_exists = _MODEL_PATH.exists()
  model_size = _MODEL_PATH.stat().st_size if model_exists else None
  model_mtime = _MODEL_PATH.stat().st_mtime if model_exists else None
  _ensure_model_loaded()

  model_loaded = _yolo_model is not None

  inference_probe: dict[str, Any] = {
    "ran": False,
    "skipped": False,
    "ok": False,
    "duration_ms": None,
    "detail": None,
  }

  body: dict[str, Any] = {
    "model_path": str(_MODEL_PATH),
    "model_exists": model_exists,
    "model_size_bytes": model_size,
    "model_mtime": model_mtime,
    "model_loaded": model_loaded,
    "model_load_error": _yolo_load_error,
    "model_load_error_detail": _yolo_load_error_detail,
    "products_loaded": len(_products_by_class),
    "inference_probe": inference_probe,
  }

  if not model_loaded:
    body["status"] = "error"
    inference_probe["skipped"] = True
    inference_probe["ok"] = False
    if not model_exists:
      inference_probe["detail"] = "MODEL_FILE_MISSING"
    elif _yolo_load_error:
      inference_probe["detail"] = _yolo_load_error
    else:
      inference_probe["detail"] = "MODEL_NOT_LOADED"
    return JSONResponse(content=body, status_code=503)

  if _health_probe_disabled():
    inference_probe["skipped"] = True
    inference_probe["ok"] = True
    inference_probe["detail"] = "probe_skipped"
    body["status"] = "healthy"
    return JSONResponse(content=body, status_code=200)

  probe_deadline = _health_probe_timeout_seconds()
  inference_probe["ran"] = True
  inference_probe["skipped"] = False
  t0 = time.perf_counter()
  try:
    await asyncio.wait_for(
      asyncio.to_thread(_quick_yolo_predict, _yolo_model),
      timeout=probe_deadline,
    )
    inference_probe["ok"] = True
    inference_probe["duration_ms"] = round((time.perf_counter() - t0) * 1000.0, 3)
    inference_probe["detail"] = None
    body["status"] = "healthy"
    return JSONResponse(content=body, status_code=200)
  except asyncio.TimeoutError:
    inference_probe["ok"] = False
    inference_probe["duration_ms"] = round(probe_deadline * 1000.0, 3)
    inference_probe["detail"] = "INFERENCE_PROBE_TIMEOUT"
    body["status"] = "degraded"
    return JSONResponse(content=body, status_code=503)
  except Exception as e:
    inference_probe["ok"] = False
    inference_probe["duration_ms"] = round((time.perf_counter() - t0) * 1000.0, 3)
    inference_probe["detail"] = f"{type(e).__name__}: {e}"[:500]
    body["status"] = "degraded"
    return JSONResponse(content=body, status_code=503)


def _default_product_for_class(cls: str) -> Product:
  return {
    "id": "UNKNOWN",
    "name": cls.upper(),
    "collection": "Lorenzo",
    "specs": {"type": "Custom chandelier", "finish": "Brass + Crystal"},
  }


@api.post("/detect")
async def detect(request: Request, file: UploadFile = File(...)):
  request_id = getattr(request.state, "request_id", _incoming_request_id(None))

  _ensure_model_loaded()

  if _yolo_model is None:
    if _yolo_load_error == "MODEL_LOAD_FAILED":
      return JSONResponse(
        status_code=500,
        content={"error": "MODEL_LOAD_FAILED", "detail": _yolo_load_error_detail},
      )
    return JSONResponse(status_code=500, content={"error": "MODEL_NOT_FOUND"})

  try:
    contents = await file.read()
    img = Image.open(io.BytesIO(contents)).convert("RGB")
  except Exception:
    _emit_json_log(
      logging.ERROR,
      {
        "event": "detect_error",
        "timestamp": _utc_timestamp_iso(),
        "request_id": request_id,
        "error_kind": "INVALID_IMAGE",
        "traceback": traceback.format_exc(),
      },
    )
    return JSONResponse(status_code=400, content={"error": "INVALID_IMAGE"})

  infer_timeout_s = _yolo_inference_timeout_seconds()
  try:
    results = await asyncio.wait_for(
      asyncio.to_thread(_yolo_model.predict, img, verbose=False),
      timeout=infer_timeout_s,
    )
  except asyncio.TimeoutError:
    _emit_json_log(
      logging.ERROR,
      {
        "event": "detect_error",
        "timestamp": _utc_timestamp_iso(),
        "request_id": request_id,
        "error_kind": "INFERENCE_TIMEOUT",
        "timeout_sec": infer_timeout_s,
      },
    )
    return JSONResponse(status_code=500, content={"error": "INFERENCE_FAILED"})
  except Exception:
    _emit_json_log(
      logging.ERROR,
      {
        "event": "detect_error",
        "timestamp": _utc_timestamp_iso(),
        "request_id": request_id,
        "error_kind": "INFERENCE_FAILED",
        "traceback": traceback.format_exc(),
      },
    )
    return JSONResponse(status_code=500, content={"error": "INFERENCE_FAILED"})

  detections: list[dict[str, Any]] = []

  for r in results:
    names: dict[int, str] = getattr(r, "names", {})
    boxes = getattr(r, "boxes", None)
    if boxes is None:
      continue

    xyxy = getattr(boxes, "xyxy", None)
    conf = getattr(boxes, "conf", None)
    cls = getattr(boxes, "cls", None)
    if xyxy is None or conf is None or cls is None:
      continue

    xyxy_list = xyxy.tolist()
    conf_list = conf.tolist()
    cls_list = cls.tolist()

    for i in range(min(len(xyxy_list), len(conf_list), len(cls_list))):
      bbox = xyxy_list[i]
      confidence = float(conf_list[i])
      class_id = int(cls_list[i])
      class_name = names.get(class_id, str(class_id))

      product = _products_by_class.get(class_name) or _default_product_for_class(
        class_name
      )

      detections.append(
        {
          "class": class_name,
          "confidence": confidence,
          "bbox": [float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])],
          "product": product,
        }
      )

  return {"detections": detections}
