from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from subsmarket.catalog.models import FamilyService
from subsmarket.core.database import Base, utcnow
from subsmarket.identity.models import User


class Family(Base):
    __tablename__ = "families"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    service_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("family_services.id"), index=True
    )
    owner_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    family_type: Mapped[str] = mapped_column(Text, default="subscription", index=True)
    status: Mapped[str] = mapped_column(Text, default="active", index=True)
    is_search_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    period: Mapped[str] = mapped_column(Text)
    max_members: Mapped[int] = mapped_column(Integer)
    active_members_count: Mapped[int] = mapped_column(Integer, default=1)
    has_been_full: Mapped[bool] = mapped_column(Boolean, default=False)
    total_price_kzt: Mapped[int] = mapped_column(Integer)
    member_share_kzt: Mapped[int] = mapped_column(Integer)
    rounding_delta_kzt: Mapped[int] = mapped_column(Integer)
    payment_day: Mapped[int] = mapped_column(Integer)
    next_payment_date: Mapped[date] = mapped_column(Date)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_rules: Mapped[str | None] = mapped_column(Text, nullable=True)
    availability_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    availability_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    price_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    closing_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    closes_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    service: Mapped[FamilyService] = relationship()
    owner: Mapped[User] = relationship(foreign_keys=[owner_user_id])
    payment_requisite: Mapped[FamilyPaymentRequisite] = relationship(
        back_populates="family", uselist=False
    )


class FamilyInvite(Base):
    __tablename__ = "family_invites"
    __table_args__ = (
        CheckConstraint("length(code) = 8", name="family_invite_code_length_ck"),
        CheckConstraint(
            "status in ('active', 'revoked')",
            name="family_invite_status_ck",
        ),
        Index(
            "family_invite_one_active_idx",
            "family_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
            sqlite_where=text("status = 'active'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("families.id", ondelete="CASCADE"),
        index=True,
    )
    code: Mapped[str] = mapped_column(Text, unique=True)
    status: Mapped[str] = mapped_column(Text, default="active")
    revoked_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    family: Mapped[Family] = relationship()


class FamilyPaymentRequisite(Base):
    __tablename__ = "family_payment_requisites"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("families.id", ondelete="CASCADE"), unique=True
    )
    bank: Mapped[str] = mapped_column(Text)
    encrypted_phone: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    family: Mapped[Family] = relationship(back_populates="payment_requisite")


class FamilyMember(Base):
    __tablename__ = "family_members"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("families.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    access_provided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    access_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    removal_scheduled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    removal_acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    removal_cancel_requested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    removal_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    left_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    removed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    closing_acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    family: Mapped[Family] = relationship()
    user: Mapped[User] = relationship()


class FamilyRequest(Base):
    __tablename__ = "family_requests"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("families.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(Text, default="pending", index=True)
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expired_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    family: Mapped[Family] = relationship()
    user: Mapped[User] = relationship()


class FamilyRequestRestriction(Base):
    __tablename__ = "family_request_restrictions"
    __table_args__ = (
        UniqueConstraint("family_id", "user_id", name="family_request_restriction_uq"),
    )

    family_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("families.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )


class FamilyOwnerMetric(Base):
    __tablename__ = "family_owner_metrics"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    requests_received_count: Mapped[int] = mapped_column(Integer, default=0)
    requests_approved_count: Mapped[int] = mapped_column(Integer, default=0)
    requests_rejected_count: Mapped[int] = mapped_column(Integer, default=0)
    requests_expired_count: Mapped[int] = mapped_column(Integer, default=0)
    requests_cancelled_by_candidate_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )
    responses_count: Mapped[int] = mapped_column(Integer, default=0)
    response_time_seconds_total: Mapped[int] = mapped_column(Integer, default=0)
    last_request_received_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_response_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_request_expired_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    owner: Mapped[User] = relationship()


class FamilyPayment(Base):
    __tablename__ = "family_payments"
    __table_args__ = (
        UniqueConstraint(
            "member_id",
            "period_start",
            "period_end",
            "kind",
            name="family_payment_unique_period_uq",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("families.id", ondelete="CASCADE"), index=True
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("family_members.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, index=True)
    amount_kzt: Mapped[int] = mapped_column(Integer)
    period: Mapped[str] = mapped_column(Text)
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    requisites_opened_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reported_paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    confirmed_paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    overdue_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    family: Mapped[Family] = relationship()
    member: Mapped[FamilyMember] = relationship()


class FamilyAuditLog(Base):
    __tablename__ = "family_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("families.id", ondelete="CASCADE"), index=True
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    target_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    target_member_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("family_members.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    target_request_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("family_requests.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    target_payment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("family_payments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[str] = mapped_column(Text, index=True)
    old_status: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_status: Mapped[str | None] = mapped_column(Text, nullable=True)
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    family: Mapped[Family] = relationship()
    actor: Mapped[User | None] = relationship(foreign_keys=[actor_user_id])
    target_user: Mapped[User | None] = relationship(foreign_keys=[target_user_id])
    target_member: Mapped[FamilyMember | None] = relationship()
    target_request: Mapped[FamilyRequest | None] = relationship()
    target_payment: Mapped[FamilyPayment | None] = relationship()
