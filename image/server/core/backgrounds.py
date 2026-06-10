from __future__ import annotations

import io
from pathlib import Path

from PIL import Image, ImageDraw

from .config import Settings


def ensure_default_background(settings: Settings) -> Path:
    assets_dir = settings.assets_root
    assets_dir.mkdir(parents=True, exist_ok=True)
    target = assets_dir / "lorenzo-default-bg.jpg"
    if target.exists():
        return target

    width = settings.image_output_width
    height = settings.image_output_height
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


def background_asset_url(background_id: str) -> str:
    return f"/api/v1/assets/backgrounds/{background_id}"


def list_backgrounds(settings: Settings, default_background_id: str = "lorenzo-default") -> list[dict]:
    ensure_default_background(settings)
    rows: list[dict] = []
    for path in sorted(settings.assets_root.glob("*")):
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        background_id = path.stem.replace("-bg", "")
        rows.append(
            {
                "id": background_id,
                "name": background_id.replace("-", " ").title(),
                "path": str(path),
                "preview_url": background_asset_url(background_id),
                "is_default": background_id == default_background_id,
            }
        )
    return rows


def save_background_upload(
    settings: Settings,
    *,
    background_id: str,
    data: bytes,
    suffix: str,
) -> Path:
    assets_dir = settings.assets_root
    assets_dir.mkdir(parents=True, exist_ok=True)
    ext = suffix.lower() if suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"} else ".jpg"
    target = assets_dir / f"{background_id}-bg{ext}"

    image = Image.open(io.BytesIO(data))
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGB")
    else:
        image = image.convert("RGB")
    image = image.resize(
        (settings.image_output_width, settings.image_output_height),
        Image.Resampling.LANCZOS,
    )
    if ext in {".jpg", ".jpeg"}:
        image.save(target, format="JPEG", quality=95)
    elif ext == ".png":
        image.save(target, format="PNG")
    else:
        image.save(target, format="WEBP", quality=95)
    return target


def resolve_background_path(settings: Settings, background_id: str) -> Path:
    ensure_default_background(settings)
    candidates = [
        settings.assets_root / f"{background_id}-bg.jpg",
        settings.assets_root / f"{background_id}-bg.png",
        settings.assets_root / f"{background_id}.jpg",
        settings.assets_root / f"{background_id}.png",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return ensure_default_background(settings)
