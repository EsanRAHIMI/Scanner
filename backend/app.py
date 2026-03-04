import json
import os
from pathlib import Path
from typing import Any, Literal, TypedDict

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image

import io


def _env_path(name: str, default: str) -> Path:
  return Path(os.getenv(name, default)).expanduser().resolve()


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
app.mount("/api", api)
app.mount("/", api)

_PRODUCTS_PATH = Path(__file__).with_name("products.json")
_MODEL_PATH = _env_path("MODEL_PATH", "/models/best.pt")

_products_by_class: dict[str, Product] = {}
_yolo_model: Any | None = None
_yolo_load_error: Literal["MODEL_NOT_FOUND"] | None = None


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
  global _yolo_model, _yolo_load_error

  if _yolo_model is not None or _yolo_load_error is not None:
    return

  if not _MODEL_PATH.exists():
    _yolo_load_error = "MODEL_NOT_FOUND"
    return

  try:
    from ultralytics import YOLO  # type: ignore

    _yolo_model = YOLO(str(_MODEL_PATH))
  except Exception:
    _yolo_load_error = "MODEL_NOT_FOUND"


@api.on_event("startup")
def _startup() -> None:
  global _products_by_class
  _products_by_class = _load_products()


@api.get("/health")
def health():
  model_exists = _MODEL_PATH.exists()
  return {
    "status": "ok",
    "model_path": str(_MODEL_PATH),
    "model_exists": model_exists,
    "products_loaded": len(_products_by_class),
  }


def _default_product_for_class(cls: str) -> Product:
  return {
    "id": "UNKNOWN",
    "name": cls.upper(),
    "collection": "Lorenzo",
    "specs": {"type": "Custom chandelier", "finish": "Brass + Crystal"},
  }


@api.post("/detect")
async def detect(file: UploadFile = File(...)):
  _ensure_model_loaded()

  if _yolo_load_error == "MODEL_NOT_FOUND" or _yolo_model is None:
    return JSONResponse(status_code=500, content={"error": "MODEL_NOT_FOUND"})

  try:
    contents = await file.read()
    img = Image.open(io.BytesIO(contents)).convert("RGB")
  except Exception:
    return JSONResponse(status_code=400, content={"error": "INVALID_IMAGE"})

  try:
    results = _yolo_model.predict(img, verbose=False)
  except Exception:
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
