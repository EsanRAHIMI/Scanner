from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

from .config import Settings
from .rembg_config import RembgConfig
from .rembg_pool import run_cutout
from .storage import StorageBackend


@dataclass
class WatermarkConfig:
    enabled: bool = True
    scale: float = 0.185
    opacity: float = 1.0
    bottom_margin_px: int = 28


class ImageProcessor:
    def __init__(
        self,
        settings: Settings,
        storage: StorageBackend,
        subject_fill_ratio: float = 0.82,
    ) -> None:
        self.settings = settings
        self.storage = storage
        self.output_size = (settings.image_output_width, settings.image_output_height)
        self.subject_fill_ratio = subject_fill_ratio

    def set_subject_fill_ratio(self, ratio: float) -> None:
        self.subject_fill_ratio = max(0.5, min(0.95, ratio))

    async def extract_tight_cutout_async(self, data: bytes, rembg_config: RembgConfig, on_stage=None) -> bytes:
        tight, _ = await run_cutout(data, rembg_config, on_stage=on_stage)
        return tight

    async def process_original_async(
        self,
        original_key: str,
        processed_key: str,
        rembg_config: RembgConfig,
        on_stage=None,
    ) -> str:
        raw = self.storage.get_bytes(original_key)
        tight = await self.extract_tight_cutout_async(raw, rembg_config, on_stage=on_stage)
        return self.storage.put_bytes(processed_key, tight, content_type="image/png")

    def to_tight_cutout(self, cutout_png: bytes) -> Image.Image:
        subject = Image.open(io.BytesIO(cutout_png)).convert("RGBA")
        if subject.size == self.output_size:
            bbox = subject.getbbox()
            if bbox:
                subject = subject.crop(bbox)
        else:
            bbox = subject.getbbox()
            if bbox:
                subject = subject.crop(bbox)
        if subject.getbbox() is None:
            return Image.new("RGBA", (1, 1), (0, 0, 0, 0))
        return subject

    def _apply_watermark(
        self,
        image: Image.Image,
        watermark_bytes: bytes,
        config: WatermarkConfig,
    ) -> Image.Image:
        watermark = Image.open(io.BytesIO(watermark_bytes)).convert("RGBA")
        canvas_w, canvas_h = image.size
        target_w = max(1, int(canvas_w * config.scale))
        ratio = target_w / watermark.width
        target_h = max(1, int(watermark.height * ratio))
        watermark = watermark.resize((target_w, target_h), Image.Resampling.LANCZOS)

        if config.opacity < 1.0:
            alpha = watermark.split()[3]
            alpha = alpha.point(lambda value: int(value * config.opacity))
            watermark.putalpha(alpha)

        x = (canvas_w - target_w) // 2
        y = max(0, canvas_h - target_h - config.bottom_margin_px)
        base = image.convert("RGBA")
        base.paste(watermark, (x, y), watermark)
        return base.convert("RGB")

    def compose_on_background(
        self,
        tight_cutout_png: bytes,
        background: bytes | Path,
        *,
        watermark_bytes: bytes | None = None,
        watermark_config: WatermarkConfig | None = None,
    ) -> bytes:
        subject = self.to_tight_cutout(tight_cutout_png)
        canvas_w, canvas_h = self.output_size
        max_w = int(canvas_w * self.subject_fill_ratio)
        max_h = int(canvas_h * self.subject_fill_ratio)
        sw, sh = subject.size
        scale = min(max_w / sw, max_h / sh)
        new_size = (max(1, int(sw * scale)), max(1, int(sh * scale)))
        resized = subject.resize(new_size, Image.Resampling.LANCZOS)

        if isinstance(background, bytes):
            background = Image.open(io.BytesIO(background)).convert("RGB")
        else:
            background = Image.open(background).convert("RGB")
        background = background.resize(self.output_size, Image.Resampling.LANCZOS)
        composed = background.copy()
        x = (canvas_w - new_size[0]) // 2
        y = (canvas_h - new_size[1]) // 2
        composed.paste(resized, (x, y), resized)

        if (
            watermark_bytes
            and watermark_config
            and watermark_config.enabled
        ):
            composed = self._apply_watermark(composed, watermark_bytes, watermark_config)

        buf = io.BytesIO()
        composed.save(buf, format="JPEG", quality=92, optimize=True)
        return buf.getvalue()

    # ------------------------------------------------------------------ #
    # Non-destructive touch-up
    # ------------------------------------------------------------------ #
    def build_adjusted_subject(
        self,
        original_cutout_png: bytes,
        *,
        mask_png: bytes | None = None,
        rotation: float = 0.0,
        flip_h: bool = False,
        flip_v: bool = False,
    ) -> Image.Image:
        """Apply cleanup (erase mask) + flip + rotation to the original cutout.

        The mask is interpreted as 'remove where painted' using its alpha (or
        luminance) — painted areas become transparent. Returns a tight RGBA image.
        """
        subject = Image.open(io.BytesIO(original_cutout_png)).convert("RGBA")

        if mask_png:
            try:
                from PIL import ImageChops

                mask_img = Image.open(io.BytesIO(mask_png)).convert("RGBA")
                if mask_img.size != subject.size:
                    mask_img = mask_img.resize(subject.size, Image.Resampling.LANCZOS)
                remove = mask_img.split()[3]  # painted strokes are opaque
                keep = remove.point(lambda v: 0 if v > 10 else 255)  # 0 where erased
                subj_alpha = subject.split()[3]
                subject.putalpha(ImageChops.multiply(subj_alpha, keep))
            except Exception:  # noqa: BLE001 - never let a bad mask break rendering
                pass

        if flip_h:
            subject = subject.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        if flip_v:
            subject = subject.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        if rotation:
            subject = subject.rotate(-rotation, expand=True, resample=Image.Resampling.BICUBIC)

        bbox = subject.getbbox()
        if bbox:
            subject = subject.crop(bbox)
        if subject.getbbox() is None:
            return Image.new("RGBA", (1, 1), (0, 0, 0, 0))
        return subject

    def render_adjusted(
        self,
        subject_rgba: Image.Image,
        background: bytes | Path,
        *,
        scale: float = 1.0,
        offset_x: float = 0.0,
        offset_y: float = 0.0,
        watermark_bytes: bytes | None = None,
        watermark_config: WatermarkConfig | None = None,
    ) -> bytes:
        """Compose an adjusted subject onto the canvas with manual placement.

        scale: multiplier of the standard subject fill (0.2–2.0).
        offset_x/offset_y: fraction of the canvas (-0.5..0.5) from centre.
        """
        subject = subject_rgba.convert("RGBA")
        bbox = subject.getbbox()
        if bbox:
            subject = subject.crop(bbox)

        canvas_w, canvas_h = self.output_size
        base = self.subject_fill_ratio * max(0.2, min(2.0, scale))
        max_w = max(1, int(canvas_w * base))
        max_h = max(1, int(canvas_h * base))
        sw, sh = subject.size
        f = min(max_w / sw, max_h / sh)
        new_size = (max(1, int(sw * f)), max(1, int(sh * f)))
        resized = subject.resize(new_size, Image.Resampling.LANCZOS)

        if isinstance(background, bytes):
            bg = Image.open(io.BytesIO(background)).convert("RGB")
        else:
            bg = Image.open(background).convert("RGB")
        bg = bg.resize(self.output_size, Image.Resampling.LANCZOS)
        composed = bg.copy()

        x = (canvas_w - new_size[0]) // 2 + int(offset_x * canvas_w)
        y = (canvas_h - new_size[1]) // 2 + int(offset_y * canvas_h)
        composed.paste(resized, (x, y), resized)

        if watermark_bytes and watermark_config and watermark_config.enabled:
            composed = self._apply_watermark(composed, watermark_bytes, watermark_config)

        buf = io.BytesIO()
        composed.convert("RGB").save(buf, format="JPEG", quality=92, optimize=True)
        return buf.getvalue()

    def render_final(
        self,
        processed_key: str,
        final_key: str,
        background: bytes | Path,
        filename: str,
        *,
        watermark_bytes: bytes | None = None,
        watermark_config: WatermarkConfig | None = None,
    ) -> str:
        cutout = self.storage.get_bytes(processed_key)
        final_bytes = self.compose_on_background(
            cutout,
            background,
            watermark_bytes=watermark_bytes,
            watermark_config=watermark_config,
        )
        return self.storage.put_bytes(
            final_key,
            final_bytes,
            content_type=self.storage.guess_content_type(filename),
        )
