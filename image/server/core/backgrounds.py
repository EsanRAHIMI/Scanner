from __future__ import annotations

import io
import logging
from pathlib import Path

from PIL import Image, ImageDraw
from pymongo.database import Database

from .config import Settings
from .db import COL_BACKGROUNDS
from .models import utc_now
from .storage import StorageBackend

logger = logging.getLogger("image-service")

_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def background_asset_url(background_id: str) -> str:
    return f"/api/v1/assets/backgrounds/{background_id}"


def slugify_background_id_from_path(path: Path) -> str:
    return path.stem.replace("-bg", "")


def _normalize_image(data: bytes, settings: Settings, ext: str) -> tuple[bytes, str]:
    image = Image.open(io.BytesIO(data))
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGB")
    else:
        image = image.convert("RGB")
    image = image.resize(
        (settings.image_output_width, settings.image_output_height),
        Image.Resampling.LANCZOS,
    )
    buf = io.BytesIO()
    out_ext = ext.lower() if ext.lower() in _IMAGE_EXTENSIONS else ".jpg"
    if out_ext in {".jpg", ".jpeg"}:
        image.save(buf, format="JPEG", quality=95)
        return buf.getvalue(), ".jpg"
    if out_ext == ".png":
        image.save(buf, format="PNG")
        return buf.getvalue(), ".png"
    image.save(buf, format="WEBP", quality=95)
    return buf.getvalue(), ".webp"


def _content_type_for_ext(ext: str) -> str:
    ext = ext.lower()
    if ext in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if ext == ".png":
        return "image/png"
    if ext == ".webp":
        return "image/webp"
    return "application/octet-stream"


class BackgroundStore:
    def __init__(self, settings: Settings, storage: StorageBackend, db: Database) -> None:
        self.settings = settings
        self.storage = storage
        self._collection = db[COL_BACKGROUNDS]

    def storage_key(self, background_id: str, ext: str) -> str:
        prefix = self.settings.aws_s3_backgrounds_prefix.strip("/")
        safe_id = background_id.replace("/", "_")
        return f"{prefix}/{safe_id}-bg{ext}"

    def _bundled_path(self, background_id: str) -> Path | None:
        root = self.settings.assets_root
        for name in (
            f"{background_id}-bg.jpg",
            f"{background_id}-bg.png",
            f"{background_id}-bg.webp",
            f"{background_id}.jpg",
            f"{background_id}.png",
        ):
            path = root / name
            if path.exists():
                return path
        return None

    def ensure_default_asset_file(self) -> Path:
        root = self.settings.assets_root
        root.mkdir(parents=True, exist_ok=True)
        target = root / "lorenzo-default-bg.jpg"
        if target.exists():
            return target

        width = self.settings.image_output_width
        height = self.settings.image_output_height
        image = Image.new("RGB", (width, height), "#DCDCDC")
        draw = ImageDraw.Draw(image)
        margin = 48
        draw.rectangle(
            [margin, margin, width - margin, height - margin],
            outline="#500F28",
            width=3,
        )
        draw.rectangle(
            [margin + 24, margin + 24, width - margin - 24, height - margin - 24],
            fill="#FFFFFF",
        )
        image.save(target, format="JPEG", quality=95)
        return target

    def register(
        self,
        background_id: str,
        name: str,
        data: bytes,
        *,
        ext: str = ".jpg",
        resize: bool = False,
    ) -> dict:
        if resize:
            data, ext = _normalize_image(data, self.settings, ext)

        content_type = _content_type_for_ext(ext)
        key = self.storage_key(background_id, ext)
        public_url = self.storage.put_bytes(key, data, content_type=content_type)
        now = utc_now().isoformat()
        doc = {
            "background_id": background_id,
            "name": name,
            "storage_key": key,
            "public_url": public_url,
            "content_type": content_type,
            "updated_at": now,
        }
        existing = self._collection.find_one({"background_id": background_id})
        if existing and not doc.get("created_at"):
            doc["created_at"] = existing.get("created_at", now)
        else:
            doc["created_at"] = existing.get("created_at", now) if existing else now

        self._collection.update_one({"background_id": background_id}, {"$set": doc}, upsert=True)
        return doc

    def save_upload(
        self,
        background_id: str,
        display_name: str,
        data: bytes,
        suffix: str,
    ) -> dict:
        ext = suffix.lower() if suffix.lower() in _IMAGE_EXTENSIONS else ".jpg"
        return self.register(background_id, display_name, data, ext=ext, resize=True)

    def seed_bundled_defaults(self) -> int:
        """Upload repo assets/ templates to shared storage + MongoDB (idempotent)."""
        self.ensure_default_asset_file()
        seeded = 0
        for path in sorted(self.settings.assets_root.glob("*")):
            if path.suffix.lower() not in _IMAGE_EXTENSIONS:
                continue
            bg_id = slugify_background_id_from_path(path)
            if self._collection.find_one({"background_id": bg_id, "storage_key": {"$exists": True}}):
                continue
            name = bg_id.replace("-", " ").title()
            self.register(bg_id, name, path.read_bytes(), ext=path.suffix.lower(), resize=False)
            seeded += 1
            logger.info("Seeded background %s from %s", bg_id, path.name)
        return seeded

    def list_all(self, default_background_id: str = "lorenzo-default") -> list[dict]:
        docs = list(self._collection.find().sort("name", 1))
        rows: list[dict] = []
        for doc in docs:
            bg_id = doc.get("background_id")
            if not bg_id:
                continue
            rows.append(
                {
                    "id": bg_id,
                    "name": doc.get("name") or bg_id.replace("-", " ").title(),
                    "preview_url": background_asset_url(bg_id),
                    "is_default": bg_id == default_background_id,
                }
            )
        if not rows:
            self.seed_bundled_defaults()
            return self.list_all(default_background_id)
        return rows

    def ensure_exists(self, background_id: str) -> None:
        if self._collection.find_one({"background_id": background_id}):
            return
        bundled = self._bundled_path(background_id)
        if bundled:
            self.register(
                background_id,
                background_id.replace("-", " ").title(),
                bundled.read_bytes(),
                ext=bundled.suffix.lower(),
                resize=False,
            )
            return
        if background_id == "lorenzo-default":
            path = self.ensure_default_asset_file()
            self.register("lorenzo-default", "Lorenzo Default", path.read_bytes(), ext=".jpg", resize=False)
            return
        raise FileNotFoundError(background_id)

    def get_bytes(self, background_id: str) -> bytes:
        doc = self._collection.find_one({"background_id": background_id})
        if doc and doc.get("storage_key"):
            try:
                return self.storage.get_bytes(doc["storage_key"])
            except FileNotFoundError:
                logger.warning("Background %s missing at %s", background_id, doc["storage_key"])

        bundled = self._bundled_path(background_id)
        if bundled:
            self.register(
                background_id,
                background_id.replace("-", " ").title(),
                bundled.read_bytes(),
                ext=bundled.suffix.lower(),
                resize=False,
            )
            return bundled.read_bytes()

        if background_id == "lorenzo-default":
            path = self.ensure_default_asset_file()
            data = path.read_bytes()
            self.register("lorenzo-default", "Lorenzo Default", data, ext=".jpg", resize=False)
            return data

        raise FileNotFoundError(background_id)

    def get_content_type(self, background_id: str) -> str:
        doc = self._collection.find_one({"background_id": background_id})
        if doc and doc.get("content_type"):
            return doc["content_type"]
        bundled = self._bundled_path(background_id)
        if bundled:
            return _content_type_for_ext(bundled.suffix)
        return "image/jpeg"
