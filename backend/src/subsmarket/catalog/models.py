from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from subsmarket.core.database import Base, utcnow


class FamilyService(Base):
    __tablename__ = "family_services"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(Text, unique=True, index=True)
    name: Mapped[str] = mapped_column(Text)
    variant: Mapped[str | None] = mapped_column(Text, nullable=True)
    family_type: Mapped[str] = mapped_column(Text, default="subscription", index=True)
    category: Mapped[str] = mapped_column(Text, index=True)
    subcategory: Mapped[str | None] = mapped_column(Text, nullable=True)
    max_members: Mapped[int] = mapped_column(Integer, default=6)
    supported_periods: Mapped[list[str]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(Text, index=True)
    service_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
