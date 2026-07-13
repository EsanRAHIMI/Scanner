from __future__ import annotations

from datetime import datetime, timezone

from .storage import sanitize_storage_name


def _prefix(base: str) -> str:
    return base.strip("/") or "proposals"


def proposal_export_pdf_key(
    prefix: str,
    proposal_id: str,
    *,
    version: int,
    title: str,
) -> str:
    """S3 key: {prefix}/{proposal_id}/exports/v{N}/{title}.pdf"""
    safe_title = sanitize_storage_name(title or "proposal")[:120]
    return f"{_prefix(prefix)}/{proposal_id}/exports/v{int(version)}/{safe_title}.pdf"


def proposal_asset_key(
    prefix: str,
    *,
    asset_id: str,
    filename: str,
    kind: str = "images",
    proposal_id: str | None = None,
    user_id: str | None = None,
) -> str:
    """Structured asset keys under each proposal or shared library."""
    safe_name = sanitize_storage_name(filename or "file")
    short_id = asset_id[:10]
    safe_kind = sanitize_storage_name(kind or "images")

    if proposal_id:
        return f"{_prefix(prefix)}/{proposal_id}/assets/{safe_kind}/{short_id}-{safe_name}"

    month = datetime.now(timezone.utc).strftime("%Y-%m")
    user_segment = sanitize_storage_name(user_id or "shared")[:32]
    return f"{_prefix(prefix)}/library/{user_segment}/{month}/{safe_kind}/{short_id}-{safe_name}"
