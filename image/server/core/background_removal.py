from __future__ import annotations

import io
import logging
from typing import Any

from PIL import Image, ImageFilter

from .rembg_config import RembgConfig

logger = logging.getLogger("image-service")

_SESSION: Any = None
_SESSION_MODEL: str | None = None

_FALLBACK_MODELS = ("birefnet-general", "bria-rmbg", "isnet-general-use", "u2net")


def loaded_model_name() -> str | None:
    return _SESSION_MODEL


def _get_remove_fn():
    try:
        from rembg import remove as rembg_remove

        return rembg_remove
    except ImportError:
        return None


def _create_session(model_name: str):
    from rembg import new_session

    return new_session(model_name)


def _get_session(model_name: str):
    global _SESSION, _SESSION_MODEL
    model = model_name.strip().lower()
    if _SESSION is not None and _SESSION_MODEL == model:
        return _SESSION

    last_error: Exception | None = None
    candidates = [model, *[m for m in _FALLBACK_MODELS if m != model]]
    for candidate in candidates:
        try:
            _SESSION = _create_session(candidate)
            _SESSION_MODEL = candidate
            logger.info("Background removal model loaded: %s", candidate)
            return _SESSION
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            logger.warning("Failed to load rembg model %s: %s", candidate, exc)

    if last_error:
        raise last_error
    raise RuntimeError("No rembg model available")


def _prepare_for_inference(image: Image.Image, config: RembgConfig) -> tuple[Image.Image, float]:
    width, height = image.size
    long_side = max(width, height)
    scale = 1.0

    if long_side < config.min_dimension:
        scale = config.min_dimension / long_side
    elif long_side > config.max_dimension:
        scale = config.max_dimension / long_side

    if abs(scale - 1.0) < 0.01:
        return image, 1.0

    new_size = (max(1, int(width * scale)), max(1, int(height * scale)))
    return image.resize(new_size, Image.Resampling.LANCZOS), scale


def _compose_from_mask(rgb: Image.Image, mask: Image.Image, dilate: int) -> Image.Image:
    alpha = mask.convert("L")
    if dilate > 0:
        size = dilate * 2 + 1
        alpha = alpha.filter(ImageFilter.MaxFilter(size))
    cutout = rgb.convert("RGBA")
    cutout.putalpha(alpha)
    return cutout


def remove_background(data: bytes, config: RembgConfig) -> bytes:
    rembg_remove = _get_remove_fn()
    if rembg_remove is None:
        image = Image.open(io.BytesIO(data)).convert("RGBA")
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        return buf.getvalue()

    image = Image.open(io.BytesIO(data))
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGB")
    original_size = image.size
    infer_image, scale = _prepare_for_inference(image, config)
    session = _get_session(config.model)

    if config.preserve_detail:
        mask = rembg_remove(infer_image, session=session, only_mask=True)
        if not isinstance(mask, Image.Image):
            mask = Image.open(io.BytesIO(mask))
        result = _compose_from_mask(
            infer_image.convert("RGB"),
            mask,
            config.mask_dilate,
        )
    else:
        kwargs: dict[str, Any] = {"session": session}
        if config.alpha_matting:
            kwargs.update(
                {
                    "alpha_matting": True,
                    "alpha_matting_foreground_threshold": config.foreground_threshold,
                    "alpha_matting_background_threshold": config.background_threshold,
                    "alpha_matting_erode_size": config.erode_size,
                }
            )
        result = rembg_remove(infer_image, **kwargs)
        if not isinstance(result, Image.Image):
            result = Image.open(io.BytesIO(result))

    if scale != 1.0 and result.size != original_size:
        result = result.resize(original_size, Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    result.save(buf, format="PNG")
    return buf.getvalue()
