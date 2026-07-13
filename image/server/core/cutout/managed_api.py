from __future__ import annotations

import io
import logging
import uuid
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import numpy as np
from PIL import Image

from .base import CutoutError, CutoutProvider, CutoutResult, EngineConfig, StageCallback, emit_stage

logger = logging.getLogger("image-service")


def _multipart(fields: dict[str, str], file_field: str, filename: str, data: bytes) -> tuple[bytes, str]:
    boundary = f"----lorenzo{uuid.uuid4().hex}"
    crlf = b"\r\n"
    out = io.BytesIO()
    for key, value in fields.items():
        out.write(b"--" + boundary.encode() + crlf)
        out.write(f'Content-Disposition: form-data; name="{key}"'.encode() + crlf + crlf)
        out.write(str(value).encode() + crlf)
    out.write(b"--" + boundary.encode() + crlf)
    out.write(
        f'Content-Disposition: form-data; name="{file_field}"; filename="{filename}"'.encode() + crlf
    )
    out.write(b"Content-Type: application/octet-stream" + crlf + crlf)
    out.write(data + crlf)
    out.write(b"--" + boundary.encode() + b"--" + crlf)
    return out.getvalue(), f"multipart/form-data; boundary={boundary}"


# Provider name -> (url, api-key header, extra form fields)
_PROVIDERS = {
    "removebg": (
        "https://api.remove.bg/v1.0/removebg",
        "X-Api-Key",
        {"size": "auto", "format": "png"},
    ),
    "photoroom": (
        "https://sdk.photoroom.com/v1/segment",
        "x-api-key",
        {"format": "png"},
    ),
}


class ManagedApiProvider(CutoutProvider):
    name = "managed_api"

    def available(self, cfg: EngineConfig) -> bool:
        return bool(
            cfg.managed_api_enabled
            and cfg.managed_api_provider in _PROVIDERS
            and cfg.managed_api_key
        )

    def cutout(self, image_bytes: bytes, cfg: EngineConfig, on_stage: StageCallback | None = None) -> CutoutResult:
        if not self.available(cfg):
            raise CutoutError("Managed API is not configured (provider/key/enabled).")

        emit_stage(on_stage, "segmentation")
        url, key_header, fields = _PROVIDERS[cfg.managed_api_provider]
        body, content_type = _multipart(fields, "image_file", "image.png", image_bytes)
        req = Request(url, data=body, method="POST")
        req.add_header("Content-Type", content_type)
        req.add_header(key_header, cfg.managed_api_key or "")
        req.add_header("Accept", "image/png")

        try:
            with urlopen(req, timeout=cfg.managed_api_timeout_s) as resp:
                out = resp.read()
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", "ignore")[:300] if exc.fp else str(exc)
            raise CutoutError(f"Managed API error {exc.code}: {detail}") from exc
        except URLError as exc:
            raise CutoutError(f"Managed API unreachable: {exc.reason}") from exc

        try:
            image = Image.open(io.BytesIO(out)).convert("RGBA")
        except Exception as exc:  # noqa: BLE001
            raise CutoutError("Managed API returned a non-image response.") from exc

        alpha01 = np.asarray(image.split()[3], dtype=np.float32) / 255.0
        coverage = float((alpha01 > 0.5).mean())
        # Managed engines are high quality; trust unless clearly empty.
        confidence = 0.95 if 0.003 < coverage < 0.97 else 0.2
        return CutoutResult(
            image=image,
            confidence=confidence,
            provider=f"{self.name}:{cfg.managed_api_provider}",
            model=cfg.managed_api_provider,
            meta={"quality": cfg.quality.value, "path": "managed_api"},
        )
