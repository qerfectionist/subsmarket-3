"""What a candidate gives the owner with a join request.

Each catalog service says in its metadata what the owner needs to send the
invite (``join_contact``: gmail, phone, apple_id, email or none), the service
rules shown before the request (``rules``) and, for services that limit how
often one can switch families, a sentence the candidate confirms
(``join_confirm``).
"""

from __future__ import annotations

import re
from typing import Any, cast

from fastapi import HTTPException

from subsmarket.catalog.models import FamilyService
from subsmarket.families.crypto import (
    decrypt_payment_requisite,
    encrypt_payment_requisite,
)
from subsmarket.families.schemas import FamilyJoinInfoOut, JoinContactKind

CONTACT_KINDS: set[str] = {"gmail", "phone", "apple_id", "email"}
EMAIL_RE = re.compile(r"^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$")
PHONE_RE = re.compile(r"^\+?7\d{10}$")


def _strings(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item).strip()]


def service_join_info(service: FamilyService) -> FamilyJoinInfoOut:
    metadata = service.service_metadata or {}
    kind = metadata.get("join_contact")
    confirm = metadata.get("join_confirm")
    return FamilyJoinInfoOut(
        contact_kind=cast(JoinContactKind, kind) if kind in CONTACT_KINDS else None,
        rules=_strings(metadata.get("rules")),
        confirm=confirm if isinstance(confirm, str) and confirm.strip() else None,
    )


def normalize_join_contact(kind: str, value: str | None) -> str:
    raw = (value or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="JOIN_CONTACT_REQUIRED")
    if kind == "phone":
        phone = re.sub(r"[\s()\-]", "", raw)
        if re.fullmatch(r"8\d{10}", phone):
            phone = f"+7{phone[1:]}"
        if not PHONE_RE.fullmatch(phone):
            raise HTTPException(status_code=400, detail="JOIN_CONTACT_PHONE_INVALID")
        return phone if phone.startswith("+") else f"+{phone}"
    email = raw.lower()
    if not EMAIL_RE.fullmatch(email):
        raise HTTPException(status_code=400, detail="JOIN_CONTACT_EMAIL_INVALID")
    return email


def check_join_request(
    service: FamilyService, *, contact: str | None, rules_confirmed: bool
) -> tuple[str | None, str | None]:
    """Returns (kind, encrypted contact) for a new request, or raises 400."""
    info = service_join_info(service)
    if info.confirm and not rules_confirmed:
        raise HTTPException(status_code=400, detail="JOIN_RULES_NOT_CONFIRMED")
    if info.contact_kind is None:
        return None, None
    normalized = normalize_join_contact(info.contact_kind, contact)
    return info.contact_kind, encrypt_payment_requisite(normalized)


def read_join_contact(encrypted: str | None) -> str | None:
    return decrypt_payment_requisite(encrypted) if encrypted else None
