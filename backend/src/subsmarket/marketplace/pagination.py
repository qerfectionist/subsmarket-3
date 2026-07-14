from __future__ import annotations

import base64
import json
import uuid
from datetime import datetime
from typing import Any

from fastapi import HTTPException


def encode_cursor(values: dict[str, Any]) -> str:
    raw = json.dumps(values, separators=(",", ":"), default=str).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_cursor(value: str) -> dict[str, Any]:
    try:
        padded = value + "=" * (-len(value) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="INVALID_CURSOR") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="INVALID_CURSOR")
    return payload


def cursor_uuid(payload: dict[str, Any], key: str = "id") -> uuid.UUID:
    try:
        return uuid.UUID(str(payload[key]))
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="INVALID_CURSOR") from exc


def cursor_datetime(payload: dict[str, Any], key: str) -> datetime:
    try:
        return datetime.fromisoformat(str(payload[key]))
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="INVALID_CURSOR") from exc


def cursor_int(payload: dict[str, Any], key: str) -> int:
    try:
        return int(payload[key])
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="INVALID_CURSOR") from exc
