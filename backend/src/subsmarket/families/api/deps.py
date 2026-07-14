from __future__ import annotations

from subsmarket.identity.dependencies import get_current_user

MAX_PAGE_OFFSET = 100_000
MAX_CURSOR_LENGTH = 512


__all__ = ["MAX_CURSOR_LENGTH", "MAX_PAGE_OFFSET", "get_current_user"]
