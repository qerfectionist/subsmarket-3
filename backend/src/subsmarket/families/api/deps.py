from __future__ import annotations

from fastapi import Query

from subsmarket.families.service import normalize_family_invite_code
from subsmarket.identity.dependencies import get_current_user

MAX_PAGE_OFFSET = 100_000
MAX_CURSOR_LENGTH = 512


def optional_invite_code(
    invite_code: str | None = Query(default=None, min_length=1, max_length=32),
) -> str | None:
    """Invite code that opens a hidden family; optional for visible ones."""
    if invite_code is None:
        return None
    return normalize_family_invite_code(invite_code)


__all__ = [
    "MAX_CURSOR_LENGTH",
    "MAX_PAGE_OFFSET",
    "get_current_user",
    "optional_invite_code",
]
