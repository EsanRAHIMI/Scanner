"""Process-wide startup flag.

The HTTP server accepts connections as soon as the process is up. Data routes
stay closed until Mongo is connected and the caches exist, and they answer
that wait with a fast 503 instead of leaving the socket unaccepted.
"""

from __future__ import annotations

ready = False
failed = False

_OPEN = {"/health", "/docs", "/redoc", "/openapi.json"}


def blocks_until_ready(path: str) -> bool:
    if ready or failed:
        return False
    if path in _OPEN or path.startswith("/docs/"):
        return False
    return True
