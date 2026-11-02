from __future__ import annotations

import re
import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

FamilyPeriod = Literal["monthly", "yearly"]
FamilyChatKind = Literal["telegram", "whatsapp"]
JoinContactKind = Literal["gmail", "phone", "apple_id", "email"]
PaymentBank = Literal["kaspi", "halyk", "freedom", "jusan"]
FamilyMemberRemovalReason = Literal[
    "no_payment",
    "no_response",
    "access_issue",
    "mutual_agreement",
    "other",
]


class FamilyCreate(BaseModel):
    service_id: uuid.UUID
    plan_name: str | None = Field(default=None, max_length=120)
    full_speed_gb: int | None = Field(default=None, ge=1, le=5000)
    period: FamilyPeriod = "monthly"
    max_members: int = Field(ge=2, le=8)
    total_price_kzt: int = Field(gt=0, le=1_000_000)
    payment_day: int = Field(ge=1, le=31)
    next_payment_date: date
    description: str | None = Field(default=None, max_length=1000)
    owner_rules: str | None = Field(default=None, max_length=1000)
    payment_bank: PaymentBank
    payment_phone: str = Field(min_length=6, max_length=32)
    payment_recipient_name: str | None = Field(default=None, max_length=40)
    chat_kind: FamilyChatKind | None = None
    # False keeps the family out of the Market: people reach it only by the invite link.
    is_search_visible: bool = True

    @field_validator("payment_recipient_name")
    @classmethod
    def validate_payment_recipient_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        name = " ".join(value.split())
        if not name:
            return None
        if len(name) < 2:
            raise ValueError("PAYMENT_RECIPIENT_NAME_TOO_SHORT")
        if any(char.isdigit() for char in name):
            raise ValueError("PAYMENT_RECIPIENT_NAME_HAS_DIGITS")
        return re.sub(r"(^|[\s\-.,(«\"'])\w", lambda m: m.group(0).upper(), name)

    @field_validator("next_payment_date")
    @classmethod
    def validate_next_payment_date(cls, value: date) -> date:
        from subsmarket.core.database import kz_today

        today = kz_today()
        if value < today:
            raise ValueError("NEXT_PAYMENT_DATE_IN_PAST")
        if (value - today).days > 366:
            raise ValueError("NEXT_PAYMENT_DATE_TOO_FAR")
        return value


class FamilyDescriptionUpdate(BaseModel):
    description: str | None = Field(default=None, max_length=1000)


class FamilyPriceUpdate(BaseModel):
    total_price_kzt: int = Field(gt=0, le=1_000_000)


class FamilyPaymentDayUpdate(BaseModel):
    payment_day: int = Field(ge=1, le=31)
    next_payment_date: date

    @field_validator("next_payment_date")
    @classmethod
    def validate_next_payment_date(cls, value: date) -> date:
        from subsmarket.core.database import kz_today

        today = kz_today()
        if value < today:
            raise ValueError("NEXT_PAYMENT_DATE_IN_PAST")
        if (value - today).days > 366:
            raise ValueError("NEXT_PAYMENT_DATE_TOO_FAR")
        return value


class FamilyVisibilityUpdate(BaseModel):
    is_search_visible: bool


class PrepaymentPeriodsCreate(BaseModel):
    periods: int = Field(ge=1, le=12)


class FamilyMemberRemovalCreate(BaseModel):
    reason: FamilyMemberRemovalReason


class FamilyCloseCreate(BaseModel):
    closes_on: date


class PublicOwner(BaseModel):
    avatar_name: str
    first_name: str
    photo_url: str | None


class FamilyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    service_id: uuid.UUID
    family_type: str
    service_slug: str
    service_name: str
    service_variant: str | None
    plan_name: str | None
    full_speed_gb: int | None = None
    owner: PublicOwner
    status: str
    period: str
    max_members: int
    active_members_count: int
    free_slots: int
    total_price_kzt: int
    member_share_kzt: int
    rounding_delta_kzt: int
    payment_day: int
    next_payment_date: date
    description: str | None
    owner_rules: str | None
    availability_confirmed_at: datetime | None = None
    availability_expires_at: datetime | None = None
    is_search_visible: bool
    closing_started_at: datetime | None = None
    closes_at: datetime | None = None
    created_at: datetime


class FamilyCreateResult(BaseModel):
    family: FamilyOut


class FamilyPageOut(BaseModel):
    items: list[FamilyOut]
    next_cursor: str | None = None


class FamilyInviteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    status: str
    created_at: datetime


class RequestUserOut(BaseModel):
    id: uuid.UUID
    username: str
    first_name: str
    photo_url: str | None


class FamilyRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    family_id: uuid.UUID
    family_type: str
    service_name: str
    service_variant: str | None
    plan_name: str | None
    owner_username: str | None
    user_id: uuid.UUID
    status: str
    cancel_reason: str | None
    created_at: datetime
    expires_at: datetime
    decided_at: datetime | None
    cancelled_at: datetime | None
    expired_at: datetime | None
    member_share_kzt: int | None = None
    price_kzt: int | None = None
    join_contact_kind: JoinContactKind | None = None
    join_contact: str | None = None


class FamilyRequestCreate(BaseModel):
    join_contact: str | None = Field(default=None, max_length=120)
    rules_confirmed: bool = False


class FamilyJoinInfoOut(BaseModel):
    """What the service needs before a request: contact field and its rules."""

    contact_kind: JoinContactKind | None = None
    rules: list[str] = []
    confirm: str | None = None


class OwnerFamilyRequestOut(FamilyRequestOut):
    candidate: RequestUserOut


class FamilyRequestPageOut(BaseModel):
    items: list[FamilyRequestOut]
    next_cursor: str | None = None


class OwnerFamilyRequestPageOut(BaseModel):
    items: list[OwnerFamilyRequestOut]
    next_cursor: str | None = None


class FamilyMemberOut(BaseModel):
    id: uuid.UUID
    family_id: uuid.UUID
    user: RequestUserOut
    role: str
    status: str
    joined_at: datetime
    access_provided_at: datetime | None
    access_confirmed_at: datetime | None
    removal_reason: str | None = None
    left_at: datetime | None = None
    removed_at: datetime | None = None
    cancelled_at: datetime | None = None
    closing_acknowledged_at: datetime | None = None
    join_contact_kind: JoinContactKind | None = None
    join_contact: str | None = None
    access_issue_reported_at: datetime | None = None


class PaymentRequisiteOut(BaseModel):
    bank: PaymentBank
    phone: str
    recipient_name: str | None = None


class FamilyPaymentOut(BaseModel):
    id: uuid.UUID
    family_id: uuid.UUID
    member_id: uuid.UUID
    kind: str
    status: str
    amount_kzt: int
    period: str
    period_start: date
    period_end: date
    due_at: datetime
    requisites_opened_at: datetime | None
    reported_paid_at: datetime | None
    confirmed_paid_at: datetime | None
    overdue_at: datetime | None
    cancelled_at: datetime | None
    cancel_reason: str | None


class FamilyMemberPaymentsOut(BaseModel):
    member_id: uuid.UUID
    payments: list[FamilyPaymentOut]


class FamilyMemberPageOut(BaseModel):
    items: list[FamilyMemberOut]
    next_cursor: str | None = None


class FamilyPaymentPageOut(BaseModel):
    items: list[FamilyPaymentOut]
    next_cursor: str | None = None


class AccessConfirmationResult(BaseModel):
    member: FamilyMemberOut
    payment: FamilyPaymentOut
    payment_requisite: PaymentRequisiteOut


class PaymentConfirmationResult(BaseModel):
    member: FamilyMemberOut
    payment: FamilyPaymentOut


class FamilyChatOut(BaseModel):
    kind: FamilyChatKind
    status: Literal["pending", "connected"]
    # Owner and added members only, once the chat is connected.
    invite_url: str | None = None
    # Owner only, while a Telegram chat waits for the bot.
    connect_url: str | None = None


class FamilyChatKindUpdate(BaseModel):
    kind: FamilyChatKind


class FamilyChatWhatsappUpdate(BaseModel):
    url: str = Field(min_length=10, max_length=200)


class MyFamilyOut(BaseModel):
    family: FamilyOut
    membership: FamilyMemberOut
    payments: list[FamilyPaymentOut]
    pending_requests_count: int = 0
    chat: FamilyChatOut | None = None


class MyFamilyPageOut(BaseModel):
    items: list[MyFamilyOut]
    next_cursor: str | None = None


class FamilyViewOut(BaseModel):
    family: FamilyOut
    owner_username: str | None = None
    my_membership: FamilyMemberOut | None = None
    my_request: FamilyRequestOut | None = None
    my_payments: list[FamilyPaymentOut] = []
    can_request: bool
    join: FamilyJoinInfoOut = FamilyJoinInfoOut()


class FamilyAuditLogOut(BaseModel):
    id: uuid.UUID
    family_id: uuid.UUID
    actor_user_id: uuid.UUID | None
    target_user_id: uuid.UUID | None
    target_member_id: uuid.UUID | None
    target_request_id: uuid.UUID | None
    target_payment_id: uuid.UUID | None
    action: str
    old_status: str | None
    new_status: str | None
    details: dict[str, Any]
    created_at: datetime


class FamilyAuditLogPageOut(BaseModel):
    items: list[FamilyAuditLogOut]
    next_cursor: str | None = None
