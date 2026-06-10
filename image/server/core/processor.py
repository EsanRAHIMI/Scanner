from __future__ import annotations

import io
from pathlib import Path

from PIL import Image

from .config import Settings
from .storage import StorageBackend

_rembg_remove = None


def _get_rembg_remove():
    global _rembg_remove
    if _rembg_remove is not None:
        return _rembg_remove
    try:
        from rembg import remove as rembg_remove

        _rembg_remove = rembg_remove
        return _rembg_remove
    except ImportError:
        return None


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

    def _load_image(self, data: bytes) -> Image.Image:
        image = Image.open(io.BytesIO(data))
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA")
        return image

    def remove_background(self, data: bytes) -> bytes:
        rembg_remove = _get_rembg_remove()
        if rembg_remove is None:
            image = self._load_image(data).convert("RGBA")
            buf = io.BytesIO()
            image.save(buf, format="PNG")
            return buf.getvalue()

        result = rembg_remove(data)
        if isinstance(result, bytes):
            return result
        buf = io.BytesIO()
        result.save(buf, format="PNG")
        return buf.getvalue()

    def normalize_rgba_cutout(self, image: Image.Image) -> Image.Image:
        """Strip opaque near-white pixels rembg sometimes leaves behind."""
        image = image.convert("RGBA")
        pixels = image.load()
        width, height = image.size
        for y in range(height):
            for x in range(width):
                red, green, blue, alpha = pixels[x, y]
                if alpha == 0:
                    continue
                if red > 238 and green > 238 and blue > 238:
                    pixels[x, y] = (red, green, blue, 0)
        return image

    def to_tight_cutout(self, cutout_png: bytes) -> Image.Image:
        subject = self.normalize_rgba_cutout(Image.open(io.BytesIO(cutout_png)))
        # Legacy items stored a full 1080x1440 canvas — crop to visible subject.
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

    def extract_tight_cutout(self, data: bytes) -> bytes:
        cutout = self.remove_background(data)
        subject = self.to_tight_cutout(cutout)
        buf = io.BytesIO()
        subject.save(buf, format="PNG")
        return buf.getvalue()

    def compose_on_background(self, tight_cutout_png: bytes, background: bytes | Path) -> bytes:
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

        buf = io.BytesIO()
        composed.save(buf, format="JPEG", quality=92, optimize=True)
        return buf.getvalue()

    def process_original(self, original_key: str, processed_key: str) -> str:
        raw = self.storage.get_bytes(original_key)
        tight = self.extract_tight_cutout(raw)
        return self.storage.put_bytes(processed_key, tight, content_type="image/png")

    def render_final(
        self,
        processed_key: str,
        final_key: str,
        background: bytes | Path,
        filename: str,
    ) -> str:
        cutout = self.storage.get_bytes(processed_key)
        final_bytes = self.compose_on_background(cutout, background)
        return self.storage.put_bytes(
            final_key,
            final_bytes,
            content_type=self.storage.guess_content_type(filename),
        )
