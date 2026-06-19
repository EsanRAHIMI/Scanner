from __future__ import annotations

import mimetypes
import re
import unicodedata
from pathlib import Path

from .config import Settings


def sanitize_storage_name(name: str) -> str:
    """Make object keys URL-safe (same approach as image/server)."""
    normalized = unicodedata.normalize("NFKC", name)
    normalized = normalized.replace("/", "_").replace("\\", "_")
    normalized = re.sub(r"\s+", "_", normalized.strip())
    normalized = re.sub(r"[^\w.\-]", "_", normalized, flags=re.UNICODE)
    normalized = re.sub(r"_+", "_", normalized).strip("._")
    return normalized or "file"


class StorageBackend:
    """S3 when configured, otherwise a persistent local volume (image/server pattern)."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.local_root = settings.storage_root_path / "files"
        self.local_root.mkdir(parents=True, exist_ok=True)
        self._s3 = None
        if settings.s3_enabled:
            import boto3  # imported lazily so local dev doesn't require it configured

            self._s3 = boto3.client(
                "s3",
                region_name=settings.aws_region,
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key,
            )

    @property
    def s3_enabled(self) -> bool:
        return self._s3 is not None

    def _local_path(self, key: str) -> Path:
        path = self.local_root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def put_bytes(self, key: str, data: bytes, content_type: str | None = None) -> str:
        """Store bytes; returns a public (S3) or API-served (local) URL path."""
        if self._s3:
            extra: dict[str, str] = {}
            if content_type:
                extra["ContentType"] = content_type
            self._s3.put_object(
                Bucket=self.settings.aws_s3_bucket, Key=key, Body=data, **extra
            )
            return self.public_url(key)
        self._local_path(key).write_bytes(data)
        return self.public_url(key)

    def get_bytes(self, key: str) -> bytes | None:
        if self._s3:
            try:
                obj = self._s3.get_object(Bucket=self.settings.aws_s3_bucket, Key=key)
                return obj["Body"].read()
            except Exception:
                return None
        path = self._local_path(key)
        return path.read_bytes() if path.exists() else None

    def delete(self, key: str) -> None:
        if self._s3:
            try:
                self._s3.delete_object(Bucket=self.settings.aws_s3_bucket, Key=key)
            except Exception:
                pass
            return
        path = self._local_path(key)
        if path.exists():
            path.unlink()

    def public_url(self, key: str) -> str:
        """URL usable by browsers AND by the render/PDF pipeline."""
        if self._s3:
            base = self.settings.aws_s3_public_base_url
            if base:
                return f"{base.rstrip('/')}/{key}"
            return (
                f"https://{self.settings.aws_s3_bucket}.s3."
                f"{self.settings.aws_region}.amazonaws.com/{key}"
            )
        # Served by this API (same-origin through the web proxy).
        return f"/api/proposals/files/{key}"

    @staticmethod
    def guess_content_type(filename: str) -> str:
        return mimetypes.guess_type(filename)[0] or "application/octet-stream"
