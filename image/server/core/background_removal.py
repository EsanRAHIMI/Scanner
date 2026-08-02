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


def warmup_model(config: RembgConfig) -> str:
    session = _get_session(config.model)
    del session  # session retained in module globals; drop local ref
    loaded = _SESSION_MODEL or config.model
    logger.info("Rembg warmup complete: %s", loaded)
    return loaded


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


def _close_image(image: Image.Image | None) -> None:
    if image is None:
        return
    try:
        image.close()
    except Exception:  # noqa: BLE001
        pass


def remove_background(data: bytes, config: RembgConfig) -> bytes:
    rembg_remove = _get_remove_fn()
    if rembg_remove is None:
        image = Image.open(io.BytesIO(data)).convert("RGBA")
        try:
            buf = io.BytesIO()
            image.save(buf, format="PNG")
            return buf.getvalue()
        finally:
            _close_image(image)

    image: Image.Image | None = None
    infer_image: Image.Image | None = None
    result: Image.Image | None = None
    mask: Image.Image | None = None
    try:
        image = Image.open(io.BytesIO(data))
        if image.mode not in ("RGB", "RGBA"):
            converted = image.convert("RGB")
            _close_image(image)
            image = converted
        original_size = image.size
        infer_image, scale = _prepare_for_inference(image, config)
        session = _get_session(config.model)

        if config.preserve_detail:
            mask_raw = rembg_remove(infer_image, session=session, only_mask=True)
            if isinstance(mask_raw, Image.Image):
                mask = mask_raw
            else:
                mask = Image.open(io.BytesIO(mask_raw))
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
            raw = rembg_remove(infer_image, **kwargs)
            if isinstance(raw, Image.Image):
                result = raw
            else:
                result = Image.open(io.BytesIO(raw))

        if scale != 1.0 and result is not None and result.size != original_size:
            resized = result.resize(original_size, Image.Resampling.LANCZOS)
            if result is not infer_image and result is not image:
                _close_image(result)
            result = resized

        buf = io.BytesIO()
        assert result is not None
        result.save(buf, format="PNG")
        return buf.getvalue()
    finally:
        # Drop temporary PIL buffers early inside the worker process.
        if infer_image is not None and infer_image is not image:
            _close_image(infer_image)
        _close_image(mask)
        if result is not None and result is not image and result is not infer_image:
            _close_image(result)
        _close_image(image)
