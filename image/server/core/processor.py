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

    async def extract_tight_cutout_async(self, data: bytes, rembg_config: RembgConfig) -> bytes:
        tight, _ = await run_cutout(data, rembg_config)
        return tight

    async def process_original_async(
        self,
        original_key: str,
        processed_key: str,
        rembg_config: RembgConfig,
    ) -> str:
        raw = self.storage.get_bytes(original_key)
        tight = await self.extract_tight_cutout_async(raw, rembg_config)
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
