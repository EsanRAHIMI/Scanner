from __future__ import annotations

import logging
from pathlib import Path

from pymongo.database import Database

from .config import Settings
from .db import COL_WATERMARK
from .models import utc_now
from .storage import StorageBackend

logger = logging.getLogger("image-service")

DEFAULT_WATERMARK_ID = "default"
_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def watermark_asset_url() -> str:
    return "/api/v1/assets/watermark"


def _content_type_for_ext(ext: str) -> str:
    ext = ext.lower()
    if ext in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if ext == ".png":
        return "image/png"
    if ext == ".webp":
        return "image/webp"
    return "application/octet-stream"


class WatermarkStore:
    def __init__(self, settings: Settings, storage: StorageBackend, db: Database) -> None:
        self.settings = settings
        self.storage = storage
        self._collection = db[COL_WATERMARK]

    def storage_key(self, ext: str) -> str:
        prefix = self.settings.aws_s3_watermarks_prefix.strip("/")
        return f"{prefix}/{DEFAULT_WATERMARK_ID}{ext}"

    def _bundled_path(self) -> Path:
        return self.settings.assets_root / "lorenzo-logo-white.png"

    def register(self, data: bytes, *, ext: str = ".png", name: str = "Lorenzo Logo") -> dict:
        content_type = _content_type_for_ext(ext)
        key = self.storage_key(ext)
        public_url = self.storage.put_bytes(key, data, content_type=content_type)
        now = utc_now().isoformat()
        doc = {
            "_id": DEFAULT_WATERMARK_ID,
            "name": name,
            "storage_key": key,
            "public_url": public_url,
            "content_type": content_type,
            "updated_at": now,
        }
        existing = self._collection.find_one({"_id": DEFAULT_WATERMARK_ID})
        doc["created_at"] = existing.get("created_at", now) if existing else now
        self._collection.replace_one({"_id": DEFAULT_WATERMARK_ID}, doc, upsert=True)
        return doc

    def seed_default(self) -> bool:
        if self._collection.find_one({"_id": DEFAULT_WATERMARK_ID, "storage_key": {"$exists": True}}):
            return False
        path = self._bundled_path()
        if not path.exists():
            logger.warning("Default watermark asset missing at %s", path)
            return False
        self.register(path.read_bytes(), ext=path.suffix.lower())
        logger.info("Seeded default watermark from %s", path.name)
        return True

    def info(self) -> dict:
        doc = self._collection.find_one({"_id": DEFAULT_WATERMARK_ID})
        return {
            "preview_url": watermark_asset_url(),
            "configured": bool(doc and doc.get("storage_key")),
            "name": (doc or {}).get("name", "Lorenzo Logo"),
            "updated_at": (doc or {}).get("updated_at"),
        }

    def get_bytes(self) -> bytes:
        doc = self._collection.find_one({"_id": DEFAULT_WATERMARK_ID})
        if doc and doc.get("storage_key"):
            try:
                return self.storage.get_bytes(doc["storage_key"])
            except FileNotFoundError:
                logger.warning("Watermark missing at %s", doc["storage_key"])

        path = self._bundled_path()
        if path.exists():
            data = path.read_bytes()
            self.register(data, ext=path.suffix.lower())
            return data

        raise FileNotFoundError("watermark")

    def get_content_type(self) -> str:
        doc = self._collection.find_one({"_id": DEFAULT_WATERMARK_ID})
        if doc and doc.get("content_type"):
            return doc["content_type"]
        return "image/png"

    def save_upload(self, data: bytes, suffix: str, name: str | None = None) -> dict:
        ext = suffix.lower() if suffix.lower() in _IMAGE_EXTENSIONS else ".png"
        return self.register(data, ext=ext, name=name or "Custom watermark")

    def reset_to_default(self) -> dict:
        path = self._bundled_path()
        if not path.exists():
            raise FileNotFoundError("bundled watermark")
        return self.register(path.read_bytes(), ext=path.suffix.lower(), name="Lorenzo Logo")
