"""Runs the cutout engine off the asyncio event loop (same process, no fork).

Routes through the provider-based engine (core.cutout). With the default
configuration (IMAGE_CUTOUT_ENGINE=self_hosted, IMAGE_QUALITY_MODE=balanced)
this reproduces the historical rembg + heuristic-refine output exactly.
Stronger modes (premium / managed_api / hybrid / gpu) are opt-in via env or
admin settings and require no code changes here.
"""

from __future__ import annotations

import io

from PIL import Image

# Fields that come from admin/system settings (RembgConfig) and override env defaults.
_REMBG_OVERRIDE_FIELDS = (
    "model",
    "preserve_detail",
    "mask_dilate",
    "alpha_matting",
    "foreground_threshold",
    "background_threshold",
    "erode_size",
    "min_dimension",
    "max_dimension",
    "managed_api_provider",
    "hybrid_escalate_below",
)
# Optional engine fields an admin layer may inject into the config dict later.
_ENGINE_OVERRIDE_FIELDS = ("engine", "processing_mode", "quality")


def _build_engine_config(config_dict: dict):
    from core.config import get_settings
    from core.cutout.base import EngineConfig, _coerce, CutoutEngine, ProcessingMode, QualityMode

    cfg = EngineConfig.from_settings(get_settings())

    for field in _REMBG_OVERRIDE_FIELDS:
        if field in config_dict and config_dict[field] is not None:
            setattr(cfg, field, config_dict[field])

    if config_dict.get("engine") is not None:
        cfg.engine = _coerce(CutoutEngine, config_dict["engine"], cfg.engine)
    if config_dict.get("processing_mode") is not None:
        cfg.processing_mode = _coerce(ProcessingMode, config_dict["processing_mode"], cfg.processing_mode)
    if config_dict.get("quality") is not None:
        cfg.quality = _coerce(QualityMode, config_dict["quality"], cfg.quality)
    if config_dict.get("managed_api_enabled") is not None:
        cfg.managed_api_enabled = bool(config_dict["managed_api_enabled"])

    return cfg


def extract_tight_cutout_bytes(image_bytes: bytes, config_dict: dict, on_stage=None) -> tuple[bytes, str | None]:
    from core.cutout import engine as cutout_engine

    cfg = _build_engine_config(config_dict)
    result = cutout_engine.run_cutout(image_bytes, cfg, on_stage=on_stage)

    subject = result.image.convert("RGBA")
    bbox = subject.getbbox()
    if bbox:
        subject = subject.crop(bbox)
    if subject.getbbox() is None:
        subject = Image.new("RGBA", (1, 1), (0, 0, 0, 0))

    buf = io.BytesIO()
    subject.save(buf, format="PNG")
    return buf.getvalue(), result.model
