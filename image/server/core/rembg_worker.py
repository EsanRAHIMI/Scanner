"""Runs rembg cutout off the asyncio event loop (same process, no fork)."""

from __future__ import annotations

import io

from PIL import Image


def extract_tight_cutout_bytes(image_bytes: bytes, config_dict: dict) -> tuple[bytes, str | None]:
    from core.background_removal import loaded_model_name, remove_background
    from core.cutout_refine import refine_cutout
    from core.rembg_config import RembgConfig

    config = RembgConfig.model_validate(config_dict)
    cutout = remove_background(image_bytes, config)
    refined = refine_cutout(
        Image.open(io.BytesIO(cutout)),
        preserve_detail=config.preserve_detail,
    )
    subject = refined.convert("RGBA")
    bbox = subject.getbbox()
    if bbox:
        subject = subject.crop(bbox)
    if subject.getbbox() is None:
        subject = Image.new("RGBA", (1, 1), (0, 0, 0, 0))
    buf = io.BytesIO()
    subject.save(buf, format="PNG")
    return buf.getvalue(), loaded_model_name()
