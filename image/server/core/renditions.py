from __future__ import annotations

import io
import logging
from dataclasses import dataclass

from PIL import Image

logger = logging.getLogger("image-service")


@dataclass
class Rendition:
    name: str          # logical name, e.g. "master_png"
    ext: str           # file extension without dot, e.g. "png"
    content_type: str
    data: bytes

    def filename(self, stem: str) -> str:
        return f"{stem}__{self.name}.{self.ext}"


@dataclass
class RenditionSpec:
    """Resolved rendition configuration (env overlaid by admin settings)."""

    master_png: bool = True
    master_webp: bool = True
    web_webp: bool = True
    web_avif: bool = False
    branded_jpeg: bool = True
    master_max_dimension: int = 4096
    web_max_dimension: int = 2048
    webp_quality: int = 90
    avif_quality: int = 60

    @classmethod
    def from_config(cls, settings, sys_settings=None) -> "RenditionSpec":
        def pick(env_attr: str, sys_attr: str, default):
            if sys_settings is not None:
                v = getattr(sys_settings, sys_attr, None)
                if v is not None:
                    return v
            return getattr(settings, env_attr, default)

        return cls(
            master_png=bool(pick("image_render_master_png", "render_master_png", True)),
            master_webp=bool(pick("image_render_master_webp", "render_master_webp", True)),
            web_webp=bool(pick("image_render_web_webp", "render_web_webp", True)),
            web_avif=bool(pick("image_render_web_avif", "render_web_avif", False)),
            branded_jpeg=bool(pick("image_render_branded_jpeg", "render_branded_jpeg", True)),
            master_max_dimension=int(pick("image_master_max_dimension", "master_max_dimension", 4096)),
            web_max_dimension=int(pick("image_web_max_dimension", "web_max_dimension", 2048)),
            webp_quality=int(pick("image_webp_quality", "webp_quality", 90)),
            avif_quality=int(pick("image_avif_quality", "avif_quality", 60)),
        )


def _fit(image: Image.Image, max_dim: int) -> Image.Image:
    """Downscale (never upscale) so the long side <= max_dim. Preserves alpha."""
    w, h = image.size
    long_side = max(w, h)
    if long_side <= max_dim:
        return image
    scale = max_dim / long_side
    new_size = (max(1, int(w * scale)), max(1, int(h * scale)))
    return image.resize(new_size, Image.Resampling.LANCZOS)


def _png(image: Image.Image) -> bytes:
    buf = io.BytesIO()
    image.convert("RGBA").save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _webp(image: Image.Image, *, quality: int, lossless: bool) -> bytes:
    buf = io.BytesIO()
    image.convert("RGBA").save(buf, format="WEBP", quality=quality, lossless=lossless, method=6)
    return buf.getvalue()


def _avif(image: Image.Image, *, quality: int) -> bytes | None:
    try:
        buf = io.BytesIO()
        image.convert("RGBA").save(buf, format="AVIF", quality=quality)
        return buf.getvalue()
    except Exception as exc:  # noqa: BLE001
        logger.warning("AVIF rendition skipped (install pillow-avif-plugin or Pillow w/ libavif): %s", exc)
        return None


def build_transparent_renditions(tight_rgba: Image.Image, spec: RenditionSpec) -> list[Rendition]:
    """Standardized transparent renditions derived from a tight RGBA cutout.

    Consistent in color mode (RGBA) and bounded sizes. The branded JPEG-on-
    background output is produced separately by ImageProcessor.compose_on_background.
    """
    out: list[Rendition] = []
    tight_rgba = tight_rgba.convert("RGBA")

    master = _fit(tight_rgba, spec.master_max_dimension)
    web = _fit(tight_rgba, spec.web_max_dimension)

    if spec.master_png:
        out.append(Rendition("master", "png", "image/png", _png(master)))

    if spec.master_webp:
        out.append(Rendition("master", "webp", "image/webp", _webp(master, quality=100, lossless=True)))

    if spec.web_webp:
        out.append(
            Rendition("web", "webp", "image/webp", _webp(web, quality=spec.webp_quality, lossless=False))
        )

    if spec.web_avif:
        avif = _avif(web, quality=spec.avif_quality)
        if avif is not None:
            out.append(Rendition("web", "avif", "image/avif", avif))

    return out
