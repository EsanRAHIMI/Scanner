from __future__ import annotations

import io
import logging
from typing import Any

from PIL import Image

from .config import Settings

logger = logging.getLogger("image-service")

_SESSION: Any = None
_SESSION_MODEL: str | None = None

_FALLBACK_MODELS = ("bria-rmbg", "birefnet-general", "isnet-general-use", "u2net")


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


def _get_session(settings: Settings):
    global _SESSION, _SESSION_MODEL
    model = settings.image_rembg_model.strip().lower()
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


def _prepare_for_inference(image: Image.Image, settings: Settings) -> tuple[Image.Image, float]:
    width, height = image.size
    long_side = max(width, height)
    scale = 1.0

    if long_side < settings.image_rembg_min_dimension:
        scale = settings.image_rembg_min_dimension / long_side
    elif long_side > settings.image_rembg_max_dimension:
        scale = settings.image_rembg_max_dimension / long_side

    if abs(scale - 1.0) < 0.01:
        return image, 1.0

    new_size = (max(1, int(width * scale)), max(1, int(height * scale)))
    return image.resize(new_size, Image.Resampling.LANCZOS), scale


def remove_background(data: bytes, settings: Settings) -> bytes:
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
    infer_image, scale = _prepare_for_inference(image, settings)
    session = _get_session(settings)

    kwargs: dict[str, Any] = {"session": session}
    if settings.image_rembg_alpha_matting:
        kwargs.update(
            {
                "alpha_matting": True,
                "alpha_matting_foreground_threshold": settings.image_rembg_foreground_threshold,
                "alpha_matting_background_threshold": settings.image_rembg_background_threshold,
                "alpha_matting_erode_size": settings.image_rembg_erode_size,
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
