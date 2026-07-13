"""Display/render-only image URL helpers for proposal HTML + PDF.

Mirrors the Products service logic (products/app/products/lib/product-utils.tsx)
so the same Google Drive image that renders in Products also renders in the
proposal preview and the exported PDF.

IMPORTANT: these are READ/RENDER-ONLY transforms. The converted URL is never
written back to MongoDB — it is only used as an <img> src at render time.
"""

from __future__ import annotations

import re

_LEGACY_APP_DOMAIN_RE = re.compile(r"ehsanrahimi\.com", re.IGNORECASE)
_CURRENT_APP_DOMAIN = "lorenzohome.ae"

# Large width keeps product visuals crisp in the high-DPI PDF export.
DEFAULT_IMAGE_WIDTH = 1600

_LH3_RE = re.compile(r"lh3\.googleusercontent\.com/d/([a-zA-Z0-9_-]+)")
_D_PATH_RE = re.compile(r"/(?:file/)?d/([a-zA-Z0-9_-]{25,})")
_ID_QUERY_RE = re.compile(r"[?&](?:id|fileId|docid|fileid)=([a-zA-Z0-9_-]{25,})")


def rewrite_legacy_app_domain(url: str) -> str:
    """Stored product media may still reference the previous deployment domain."""
    u = (url or "").strip()
    if not u or not _LEGACY_APP_DOMAIN_RE.search(u):
        return u
    return _LEGACY_APP_DOMAIN_RE.sub(_CURRENT_APP_DOMAIN, u)


def _lh3_direct_url(file_id: str, width: int) -> str:
    fid = file_id.split("=")[0] or file_id
    return f"https://lh3.googleusercontent.com/d/{fid}=w{width}"


def drive_direct_link(url: str | None, width: int = DEFAULT_IMAGE_WIDTH) -> str:
    """Convert a Google Drive link to a high-performance lh3 direct link.

    Handles /d/ paths, ?id= query params, and existing lh3 URLs. Non-Drive URLs
    are returned unchanged (after the legacy-domain rewrite).
    """
    if not url:
        return ""
    u = rewrite_legacy_app_domain(url)

    if not (u.startswith("http") or u.startswith("//") or u.startswith("/")):
        return ""

    if (
        "drive.google.com" not in u
        and "google.com/file/d/" not in u
        and "googleusercontent.com" not in u
    ):
        return u

    lh3 = _LH3_RE.search(u)
    if lh3 and lh3.group(1):
        return _lh3_direct_url(lh3.group(1), width)

    file_id = ""
    md = _D_PATH_RE.search(u)
    if md and md.group(1):
        file_id = md.group(1)
    else:
        mq = _ID_QUERY_RE.search(u)
        if mq and mq.group(1):
            file_id = mq.group(1)

    if file_id:
        return _lh3_direct_url(file_id, width)
    return u
