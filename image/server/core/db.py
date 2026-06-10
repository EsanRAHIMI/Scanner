from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.database import Database
from pymongo.errors import PyMongoError

from .config import Settings

if TYPE_CHECKING:
    from pymongo import MongoClient as MongoClientType

logger = logging.getLogger("image-service")

COL_BATCHES = "image_batches"
COL_ITEMS = "image_items"
COL_OUTPUTS = "image_outputs"
COL_SETTINGS = "image_settings"
COL_BACKGROUNDS = "image_backgrounds"


def connect_mongo(settings: Settings) -> Database:
    if not settings.mongodb_uri:
        raise RuntimeError("MONGODB_URI is not configured")
    client: MongoClientType = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=8000)
    client.admin.command("ping")
    db = client[settings.image_mongodb_db]
    logger.info("Connected to MongoDB database=%s", settings.image_mongodb_db)
    return db


def ensure_indexes(db: Database) -> None:
    batches = db[COL_BATCHES]
    items = db[COL_ITEMS]
    outputs = db[COL_OUTPUTS]
    backgrounds = db[COL_BACKGROUNDS]

    batches.create_index([("created_at", DESCENDING)])
    batches.create_index([("status", ASCENDING)])
    batches.create_index([("source", ASCENDING)])

    items.create_index([("batch_id", ASCENDING)])
    items.create_index([("status", ASCENDING)])
    items.create_index([("file_name", ASCENDING)])
    items.create_index([("display_name", ASCENDING)])
    items.create_index([("batch_id", ASCENDING), ("file_name", ASCENDING)])
    items.create_index([("transparent_key", ASCENDING)], sparse=True)
    items.create_index([("final_key", ASCENDING)], sparse=True)

    outputs.create_index([("item_id", ASCENDING)], unique=True)
    outputs.create_index([("batch_id", ASCENDING)])
    outputs.create_index([("file_name", ASCENDING)])
    outputs.create_index([("final_key", ASCENDING)], sparse=True)
    outputs.create_index([("status", ASCENDING)])
    outputs.create_index([("updated_at", DESCENDING)])

    backgrounds.create_index([("background_id", ASCENDING)], unique=True)

    settings_col = db[COL_SETTINGS]
    settings_col.create_index([("_id", ASCENDING)])


def mongo_health(db: Database | None) -> dict:
    if db is None:
        return {"ok": False, "detail": "not_configured"}
    try:
        db.client.admin.command("ping")
        return {"ok": True}
    except PyMongoError as exc:
        return {"ok": False, "detail": str(exc)}
