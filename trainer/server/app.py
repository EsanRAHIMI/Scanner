import json
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

from typing_extensions import TypedDict

import yaml
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image

import io

from fastapi.middleware.cors import CORSMiddleware

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


def _utc_now_iso() -> str:
  return datetime.now(timezone.utc).isoformat()


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
app.mount("/trainer/api", api)
app.mount("/", api)

api.add_middleware(
  CORSMiddleware,
  allow_origins=[
    "http://localhost:3010",
    "http://127.0.0.1:3010",
  ],
  allow_credentials=False,
  allow_methods=["*"] ,
  allow_headers=["*"] ,
)

BASE_DIR = Path(__file__).resolve().parent
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
