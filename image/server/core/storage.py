from __future__ import annotations

import mimetypes
import re
import unicodedata
from pathlib import Path
from typing import BinaryIO
from urllib.parse import quote

import boto3
from botocore.exceptions import ClientError

from .config import Settings


def sanitize_storage_name(name: str) -> str:
    """Make S3 object keys URL-safe (no spaces or exotic unicode whitespace)."""
    normalized = unicodedata.normalize("NFKC", name)
    normalized = normalized.replace("/", "_").replace("\\", "_")
    normalized = re.sub(r"\s+", "_", normalized.strip())
    normalized = re.sub(r"[^\w.\-]", "_", normalized, flags=re.UNICODE)
    normalized = re.sub(r"_+", "_", normalized).strip("._")
    return normalized or "image"


class StorageBackend:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.local_root = settings.storage_root / "files"
        self.local_root.mkdir(parents=True, exist_ok=True)
        self._s3 = None
        if settings.s3_enabled:
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
        if self._s3:
            extra = {}
            if content_type:
                extra["ContentType"] = content_type
            self._s3.put_object(
                Bucket=self.settings.aws_s3_bucket,
                Key=key,
                Body=data,
                **extra,
            )
            return self.public_url(key)

        path = self._local_path(key)
        path.write_bytes(data)
        return self.public_url(key)

    def put_file(self, key: str, file_path: Path, content_type: str | None = None) -> str:
        return self.put_bytes(key, file_path.read_bytes(), content_type=content_type)

    def get_bytes(self, key: str) -> bytes:
        if self._s3:
            try:
                obj = self._s3.get_object(Bucket=self.settings.aws_s3_bucket, Key=key)
                return obj["Body"].read()
            except ClientError as exc:
                raise FileNotFoundError(key) from exc

        path = self._local_path(key)
        if not path.exists():
            raise FileNotFoundError(key)
        return path.read_bytes()

    def delete_key(self, key: str) -> None:
        if self._s3:
            try:
                self._s3.delete_object(Bucket=self.settings.aws_s3_bucket, Key=key)
            except ClientError:
                return
            return

        path = self._local_path(key)
        if path.exists():
            path.unlink()

    def exists(self, key: str) -> bool:
        if self._s3:
            try:
                self._s3.head_object(Bucket=self.settings.aws_s3_bucket, Key=key)
                return True
            except ClientError:
                return False
        return self._local_path(key).exists()

    def list_keys(self, prefix: str) -> list[str]:
        if self._s3:
            keys: list[str] = []
            paginator = self._s3.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=self.settings.aws_s3_bucket, Prefix=prefix):
                for obj in page.get("Contents", []):
                    key = obj["Key"]
                    if not key.endswith("/"):
                        keys.append(key)
            return keys

        base = self.local_root / prefix
        if not base.exists():
            return []
        return [
            str(p.relative_to(self.local_root)).replace("\\", "/")
            for p in base.rglob("*")
            if p.is_file()
        ]

    def public_url(self, key: str) -> str:
        if self.settings.aws_s3_public_base_url:
            base = self.settings.aws_s3_public_base_url.rstrip("/")
            return f"{base}/{quote(key, safe='/')}"
        return f"/api/v1/files/{quote(key, safe='/')}"

    def guess_content_type(self, filename: str) -> str:
        guessed, _ = mimetypes.guess_type(filename)
        return guessed or "application/octet-stream"

    def upload_prefix(self, batch_id: str) -> str:
        return f"{self.settings.aws_s3_upload_prefix}/{batch_id}"

    def processed_prefix(self, batch_id: str) -> str:
        return f"{self.settings.aws_s3_processed_prefix}/{batch_id}"

    def final_prefix(self, batch_id: str) -> str:
        return f"{self.settings.aws_s3_final_prefix}/{batch_id}"

    def original_key(self, batch_id: str, item_id: str, filename: str) -> str:
        safe = sanitize_storage_name(Path(filename).name)
        return f"{self.upload_prefix(batch_id)}/{item_id}_{safe}"

    def processed_key(self, batch_id: str, item_id: str) -> str:
        return f"{self.processed_prefix(batch_id)}/{item_id}.png"

    def final_key(
        self,
        batch_id: str,
        item_id: str,
        filename: str,
        background_id: str = "default",
    ) -> str:
        stem = sanitize_storage_name(Path(filename).stem)
        safe_bg = sanitize_storage_name(background_id)
        return f"{self.final_prefix(batch_id)}/{stem}__{safe_bg}.jpg"

    def read_stream(self, key: str) -> BinaryIO:
        from io import BytesIO

        return BytesIO(self.get_bytes(key))
