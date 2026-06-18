from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from subsmarket.catalog.models import FamilyService

DEFAULT_PERIODS = ["monthly", "yearly"]
DEFAULT_MAX_MEMBERS = 6
ALLOWED_FAMILY_TYPES = {"subscription", "tariff"}


def _service_status(raw_status: str, activate_demo: bool) -> str:
    if activate_demo and raw_status == "pending_verification":
        return "active"
    return raw_status


def import_family_services(
    db: Session, catalog_file: Path, *, activate_demo: bool = False
) -> int:
    payload = json.loads(catalog_file.read_text(encoding="utf-8"))
    imported = 0
    for item in payload.get("services", []):
        slug = item["id"]
        service = db.scalar(select(FamilyService).where(FamilyService.slug == slug))
        metadata: dict[str, Any] = {
            key: value
            for key, value in item.items()
            if key
            not in {
                "id",
                "name",
                "variant",
                "family_type",
                "category",
                "subcategory",
                "max_members",
                "supported_periods",
                "status",
            }
        }
        family_type = item.get("family_type", "subscription")
        if family_type not in ALLOWED_FAMILY_TYPES:
            raise ValueError(f"Unsupported family_type: {family_type}")
        status = _service_status(item["status"], activate_demo)
        max_members = item.get("max_members", DEFAULT_MAX_MEMBERS)
        supported_periods = item.get("supported_periods", DEFAULT_PERIODS)
        if service is None:
            db.add(
                FamilyService(
                    slug=slug,
                    name=item["name"],
                    variant=item.get("variant"),
                    family_type=family_type,
                    category=item["category"],
                    subcategory=item.get("subcategory"),
                    max_members=max_members,
                    supported_periods=supported_periods,
                    status=status,
                    service_metadata=metadata,
                )
            )
            imported += 1
        else:
            service.name = item["name"]
            service.variant = item.get("variant")
            service.family_type = family_type
            service.category = item["category"]
            service.subcategory = item.get("subcategory")
            service.max_members = max_members
            service.supported_periods = supported_periods
            service.status = status
            service.service_metadata = metadata
    db.commit()
    return imported


def list_family_services(
    db: Session,
    *,
    status: str | None = "active",
    category: str | None = None,
    family_type: str | None = None,
) -> list[FamilyService]:
    stmt = select(FamilyService).order_by(
        FamilyService.family_type, FamilyService.category, FamilyService.name
    )
    if status:
        stmt = stmt.where(FamilyService.status == status)
    if category:
        stmt = stmt.where(FamilyService.category == category)
    if family_type:
        stmt = stmt.where(FamilyService.family_type == family_type)
    return list(db.scalars(stmt).all())
