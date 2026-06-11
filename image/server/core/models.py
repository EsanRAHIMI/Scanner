from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ImportSource(str, Enum):
    LOCAL = "local"
    S3 = "s3"
    GOOGLE_DRIVE = "google_drive"


class BatchStatus(str, Enum):
    DRAFT = "draft"
    PROCESSING = "processing"
    REVIEW = "review"
    BACKGROUND = "background"
    FINALIZED = "finalized"
    FAILED = "failed"


class ItemStatus(str, Enum):
    IMPORTED = "imported"
    PROCESSING = "processing"
    PROCESSED = "processed"
    REVIEWED = "reviewed"
    BACKGROUND_APPLIED = "background_applied"
    FINALIZED = "finalized"
    FAILED = "failed"
    NEEDS_MANUAL_REVIEW = "needs_manual_review"


class BatchRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    source: ImportSource
    status: BatchStatus = BatchStatus.DRAFT
    default_background_id: str = "lorenzo-default"
    total_count: int = 0
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ItemRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    batch_id: str
    file_name: str
    display_name: str
    source_ref: str
    source: ImportSource | None = None
    original_key: str
    original_url: str | None = None
    processed_key: str | None = None
    processed_url: str | None = None
    final_key: str | None = None
    final_url: str | None = None
    background_id: str | None = None
    status: ItemStatus = ItemStatus.IMPORTED
    error: str | None = None
    processing_meta: dict[str, Any] | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class OutputRecord(BaseModel):
    id: str
    item_id: str
    batch_id: str
    file_name: str
    final_url: str
    final_key: str | None = None
    source_ref: str
    original_ref: str
    source: ImportSource
    status: ItemStatus
    background_id: str | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ChangeOutputBackgroundRequest(BaseModel):
    background_id: str


class LocalImportResponse(BaseModel):
    batch_id: str
    item_count: int


class S3ImportRequest(BaseModel):
    keys: list[str] = Field(default_factory=list)
    prefix: str | None = None
    batch_name: str | None = None


class GoogleDriveImportRequest(BaseModel):
    file_ids: list[str] = Field(default_factory=list)
    folder_id: str | None = None
    batch_name: str | None = None


class RenameItemRequest(BaseModel):
    display_name: str


class ApplyBackgroundRequest(BaseModel):
    default_background_id: str | None = None
    overrides: dict[str, str] = Field(default_factory=dict)


class FinalizeBatchRequest(BaseModel):
    confirm: bool = True
