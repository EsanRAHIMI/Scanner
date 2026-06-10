from __future__ import annotations

import mimetypes
from pathlib import Path
from typing import Iterable
from uuid import uuid4

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from .config import Settings
from .models import BatchRecord, ImportSource, ItemRecord
from .repository import ImageRepository
from .storage import StorageBackend

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".heic"}


def is_image_file(name: str) -> bool:
    return Path(name).suffix.lower() in IMAGE_EXTENSIONS


class ImportService:
    def __init__(
        self,
        settings: Settings,
        storage: StorageBackend,
        repository: ImageRepository,
    ) -> None:
        self.settings = settings
        self.storage = storage
        self.repository = repository

    def create_batch(
        self,
        name: str,
        source: ImportSource,
        metadata: dict | None = None,
        default_background_id: str = "lorenzo-default",
    ) -> BatchRecord:
        batch = BatchRecord(
            name=name,
            source=source,
            metadata=metadata or {},
            default_background_id=default_background_id,
        )
        return self.repository.save_batch(batch)

    def _store_imported_item(
        self,
        batch: BatchRecord,
        filename: str,
        data: bytes,
        source_ref: str,
        content_type: str | None = None,
    ) -> ItemRecord:
        safe_name = Path(filename).name
        item_id = str(uuid4())
        key = self.storage.original_key(batch.id, item_id, safe_name)
        original_url = self.storage.put_bytes(
            key,
            data,
            content_type=content_type or self.storage.guess_content_type(safe_name),
        )
        return ItemRecord(
            id=item_id,
            batch_id=batch.id,
            file_name=safe_name,
            display_name=Path(safe_name).stem,
            source_ref=source_ref,
            original_key=key,
            original_url=original_url,
        )

    def add_local_files(
        self,
        batch: BatchRecord,
        files: Iterable[tuple[str, bytes]],
        source_refs: Iterable[str] | None = None,
    ) -> list[ItemRecord]:
        refs = list(source_refs) if source_refs else []
        created: list[ItemRecord] = []
        for idx, (filename, data) in enumerate(files):
            if not is_image_file(filename):
                continue
            item = self._store_imported_item(
                batch,
                filename,
                data,
                refs[idx] if idx < len(refs) else f"local://{filename}",
            )
            created.append(self.repository.save_item(item))
        return created

    def import_from_s3_keys(self, batch: BatchRecord, keys: list[str]) -> list[ItemRecord]:
        created: list[ItemRecord] = []
        for key in keys:
            if not is_image_file(key):
                continue
            filename = Path(key).name
            data = self.storage.get_bytes(key)
            item = self._store_imported_item(batch, filename, data, f"s3://{key}")
            created.append(self.repository.save_item(item))
        return created

    def import_from_s3_prefix(self, batch: BatchRecord, prefix: str) -> list[ItemRecord]:
        keys = self.storage.list_keys(prefix)
        return self.import_from_s3_keys(batch, keys)

    def _drive_service(self):
        creds_path = self.settings.google_drive_credentials_json
        if not creds_path:
            raise RuntimeError("GOOGLE_DRIVE_CREDENTIALS_JSON is not configured")
        credentials = service_account.Credentials.from_service_account_file(
            creds_path,
            scopes=[self.settings.google_drive_scopes],
        )
        return build("drive", "v3", credentials=credentials, cache_discovery=False)

    def _download_drive_file(self, service, file_id: str) -> tuple[str, bytes]:
        meta = service.files().get(fileId=file_id, fields="id,name,mimeType").execute()
        name = meta.get("name") or f"{file_id}.jpg"
        request = service.files().get_media(fileId=file_id)
        from io import BytesIO

        buffer = BytesIO()
        downloader = MediaIoBaseDownload(buffer, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        return name, buffer.getvalue()

    def _list_drive_folder_images(self, service, folder_id: str) -> list[dict]:
        query = (
            f"'{folder_id}' in parents and trashed=false and "
            "(mimeType contains 'image/' or mimeType='application/vnd.google-apps.folder')"
        )
        files: list[dict] = []
        page_token = None
        while True:
            response = (
                service.files()
                .list(
                    q=query,
                    spaces="drive",
                    fields="nextPageToken, files(id,name,mimeType)",
                    pageToken=page_token,
                )
                .execute()
            )
            for entry in response.get("files", []):
                if entry.get("mimeType") == "application/vnd.google-apps.folder":
                    files.extend(self._list_drive_folder_images(service, entry["id"]))
                elif str(entry.get("mimeType", "")).startswith("image/"):
                    files.append(entry)
            page_token = response.get("nextPageToken")
            if not page_token:
                break
        return files

    def import_from_google_drive(
        self,
        batch: BatchRecord,
        *,
        file_ids: list[str] | None = None,
        folder_id: str | None = None,
    ) -> list[ItemRecord]:
        service = self._drive_service()
        targets: list[dict] = []

        if folder_id:
            targets.extend(self._list_drive_folder_images(service, folder_id))
        for file_id in file_ids or []:
            meta = service.files().get(fileId=file_id, fields="id,name,mimeType").execute()
            targets.append(meta)

        created: list[ItemRecord] = []
        seen: set[str] = set()
        for entry in targets:
            file_id = entry["id"]
            if file_id in seen:
                continue
            seen.add(file_id)
            filename, data = self._download_drive_file(service, file_id)
            if not is_image_file(filename):
                continue
            item = self._store_imported_item(
                batch,
                filename,
                data,
                f"google-drive://{file_id}",
                content_type=mimetypes.guess_type(filename)[0] or "image/jpeg",
            )
            created.append(self.repository.save_item(item))
        return created
