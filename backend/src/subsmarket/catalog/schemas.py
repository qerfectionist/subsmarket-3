from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict


class FamilyServiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    name: str
    variant: str | None
    family_type: str
    category: str
    subcategory: str | None
    max_members: int
    supported_periods: list[str]
    status: str
    service_metadata: dict[str, Any]


class CatalogImportResult(BaseModel):
    imported: int
    activated_for_demo: bool
