from __future__ import annotations

import base64
import json
import uuid
from datetime import datetime
from typing import Any

from fastapi import HTTPException


def encode_cursor(values: dict[str, Any]) -> str:
    payload = {
        key: _serialize_value(value)
        for key, value in values.items()
    }
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_cursor(value: str) -> dict[str, Any]:
    try:
        padded = value + "=" * (-len(value) % 4)
        raw = base64.urlsafe_b64decode(padded.encode("ascii"))
        payload = json.loads(raw.decode("utf-8"))
    except (ValueError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="INVALID_PAGE_CURSOR") from None
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="INVALID_PAGE_CURSOR")
    return payload


def cursor_datetime(payload: dict[str, Any], key: str) -> datetime:
    value = payload.get(key)
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail="INVALID_PAGE_CURSOR")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=400, detail="INVALID_PAGE_CURSOR") from None


def cursor_uuid(payload: dict[str, Any], key: str) -> uuid.UUID:
    value = payload.get(key)
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail="INVALID_PAGE_CURSOR")
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail="INVALID_PAGE_CURSOR") from None


def _serialize_value(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    return str(value)
