from __future__ import annotations

import os
import platform
import socket
import sys
from importlib.metadata import PackageNotFoundError, version

from .background_removal import loaded_model_name
from .config import Settings


def _pkg_version(name: str) -> str | None:
    try:
        return version(name)
    except PackageNotFoundError:
        return None


def _library_versions() -> dict[str, str | None]:
    return {
        "rembg": _pkg_version("rembg"),
        "pillow": _pkg_version("pillow"),
        "onnxruntime": _pkg_version("onnxruntime"),
        "numpy": _pkg_version("numpy"),
        "pymongo": _pkg_version("pymongo"),
        "fastapi": _pkg_version("fastapi"),
        "boto3": _pkg_version("boto3"),
    }


def _onnx_providers() -> list[str]:
    try:
        import onnxruntime as ort

        return list(ort.get_available_providers())
    except Exception:  # noqa: BLE001
        return []


def _deploy_context() -> dict:
    in_container = os.path.exists("/.dockerenv") or bool(
        os.environ.get("KUBERNETES_SERVICE_HOST") or os.environ.get("DOCKER_CONTAINER")
    )
    return {
        "hostname": socket.gethostname(),
        "in_container": in_container,
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "executable": sys.executable,
    }


def runtime_info(settings: Settings, storage_s3_enabled: bool, mongo_ok: bool) -> dict:
    libraries = _library_versions()
    return {
        "output_width": settings.image_output_width,
        "output_height": settings.image_output_height,
        "deploy": _deploy_context(),
        "libraries": libraries,
        "rembg": {
            "configured_model": settings.image_rembg_model,
            "loaded_model": loaded_model_name(),
            "alpha_matting": settings.image_rembg_alpha_matting,
            "foreground_threshold": settings.image_rembg_foreground_threshold,
            "background_threshold": settings.image_rembg_background_threshold,
            "erode_size": settings.image_rembg_erode_size,
            "max_dimension": settings.image_rembg_max_dimension,
            "min_dimension": settings.image_rembg_min_dimension,
            "onnx_providers": _onnx_providers(),
            "available": libraries.get("rembg") is not None,
        },
        "storage": {
            "s3_enabled": storage_s3_enabled,
            "s3_bucket": settings.aws_s3_bucket,
            "s3_region": settings.aws_region,
            "s3_public_base_url": settings.aws_s3_public_base_url,
            "upload_prefix": settings.aws_s3_upload_prefix,
            "processed_prefix": settings.aws_s3_processed_prefix,
            "final_prefix": settings.aws_s3_final_prefix,
            "backgrounds_prefix": settings.aws_s3_backgrounds_prefix,
            "watermarks_prefix": settings.aws_s3_watermarks_prefix,
            "local_storage_root": str(settings.storage_root),
        },
        "mongodb": {
            "enabled": bool(settings.mongodb_uri),
            "ok": mongo_ok,
            "db": settings.image_mongodb_db,
        },
        "google_drive_configured": bool(settings.google_drive_credentials_json),
        # Flat aliases kept for older clients
        "s3_enabled": storage_s3_enabled,
        "s3_bucket": settings.aws_s3_bucket,
        "s3_public_base_url": settings.aws_s3_public_base_url,
        "upload_prefix": settings.aws_s3_upload_prefix,
        "processed_prefix": settings.aws_s3_processed_prefix,
        "final_prefix": settings.aws_s3_final_prefix,
        "mongodb_enabled": bool(settings.mongodb_uri),
        "mongodb_ok": mongo_ok,
        "mongodb_db": settings.image_mongodb_db,
        "rembg_model": settings.image_rembg_model,
        "rembg_alpha_matting": settings.image_rembg_alpha_matting,
    }
