from __future__ import annotations

import re
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from subsmarket.core.database import utcnow
from subsmarket.families.models import (
    Family,
    FamilyMember,
    FamilyOwnerMetric,
    FamilyPayment,
    FamilyRequest,
)
from subsmarket.families.pagination import (
    cursor_datetime,
    cursor_uuid,
    decode_cursor,
)
from subsmarket.identity.models import User
from subsmarket.notifications.service import enqueue_notification

ACTIVE_OWNER_FAMILY_STATUSES = {"active", "full", "closing"}
ALLOWED_PERIODS = {"monthly", "yearly"}
ACTIVE_REQUEST_STATUS = "pending"
ACTIVE_MEMBER_STATUSES = {
    "awaiting_access",
    "awaiting_confirmation",
    "payment_due",
    "active",
    "removal_pending",
}
MEMBER_REMOVAL_REASONS = {
    "no_payment",
    "no_response",
    "access_issue",
    "mutual_agreement",
    "other",
}
PHONE_RE = re.compile(r"^\+?7\d{10}$")
FAMILY_AVAILABILITY_TTL = timedelta(days=3)


def _trim_page(items: list, limit: int, cursor_factory) -> tuple[list, str | None]:
    page_items = items[:limit]
    next_cursor = cursor_factory(page_items[-1]) if len(items) > limit else None
    return page_items, next_cursor


def _desc_datetime_uuid_condition(model, cursor: str):
    payload = decode_cursor(cursor)
    created_at = cursor_datetime(payload, "created_at")
    item_id = cursor_uuid(payload, "id")
    return or_(
        model.created_at < created_at,
        and_(model.created_at == created_at, model.id < item_id),
    )


def _desc_due_created_uuid_condition(model, cursor: str):
    payload = decode_cursor(cursor)
    due_at = cursor_datetime(payload, "due_at")
    created_at = cursor_datetime(payload, "created_at")
    item_id = cursor_uuid(payload, "id")
    return or_(
        model.due_at < due_at,
        and_(model.due_at == due_at, model.created_at < created_at),
        and_(
            model.due_at == due_at,
            model.created_at == created_at,
            model.id < item_id,
        ),
    )


def _asc_datetime_uuid_condition(model, cursor: str, datetime_field: str):
    payload = decode_cursor(cursor)
    value = cursor_datetime(payload, datetime_field)
    item_id = cursor_uuid(payload, "id")
    column = getattr(model, datetime_field)
    return or_(
        column > value,
        and_(column == value, model.id > item_id),
    )


def _desc_availability_datetime_uuid_condition(cursor: str):
    payload = decode_cursor(cursor)
    has_availability_value = payload.get("has_availability", "True")
    if has_availability_value not in {"True", "False"}:
        raise HTTPException(status_code=400, detail="INVALID_PAGE_CURSOR")
    has_availability = has_availability_value == "True"
    created_at = cursor_datetime(payload, "created_at")
    item_id = cursor_uuid(payload, "id")
    if not has_availability:
        return and_(
            Family.availability_confirmed_at.is_(None),
            or_(
                Family.created_at < created_at,
                and_(Family.created_at == created_at, Family.id < item_id),
            ),
        )

    availability_confirmed_at = cursor_datetime(payload, "availability_confirmed_at")
    return or_(
        Family.availability_confirmed_at < availability_confirmed_at,
        and_(
            Family.availability_confirmed_at == availability_confirmed_at,
            Family.created_at < created_at,
        ),
        and_(
            Family.availability_confirmed_at == availability_confirmed_at,
            Family.created_at == created_at,
            Family.id < item_id,
        ),
        Family.availability_confirmed_at.is_(None),
    )


def _as_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def calculate_member_share(total_price_kzt: int, max_members: int) -> tuple[int, int]:
    raw_share = (total_price_kzt + max_members - 1) // max_members
    member_share = ((raw_share + 49) // 50) * 50
    rounding_delta = member_share * max_members - total_price_kzt
    return member_share, rounding_delta


def normalize_payment_phone(value: str) -> str:
    normalized = re.sub(r"[\s()\\-]", "", value.strip())
    digits = re.sub(r"\D", "", normalized)
    if len(digits) >= 13:
        raise HTTPException(
            status_code=400,
            detail="PAYMENT_PHONE_ONLY_NO_CARD_OR_IBAN",
        )
    if not PHONE_RE.fullmatch(normalized):
        raise HTTPException(status_code=400, detail="INVALID_PAYMENT_PHONE")
    return normalized


def get_family_owner_metric(
    db: Session,
    owner_user_id: UUID,
) -> FamilyOwnerMetric | None:
    return db.scalar(
        select(FamilyOwnerMetric).where(
            FamilyOwnerMetric.owner_user_id == owner_user_id
        )
    )


def record_owner_request_received(
    db: Session,
    *,
    owner_user_id: UUID,
    received_at: datetime,
) -> FamilyOwnerMetric:
    metric = _get_or_create_owner_metric_for_update(db, owner_user_id)
    metric.requests_received_count += 1
    metric.last_request_received_at = received_at
    return metric


def record_owner_request_cancelled_by_candidate(
    db: Session,
    *,
    owner_user_id: UUID,
) -> FamilyOwnerMetric:
    metric = _get_or_create_owner_metric_for_update(db, owner_user_id)
    metric.requests_cancelled_by_candidate_count += 1
    return metric


def record_owner_request_decision(
    db: Session,
    *,
    owner_user_id: UUID,
    request: FamilyRequest,
    decision: str,
) -> FamilyOwnerMetric:
    metric = _get_or_create_owner_metric_for_update(db, owner_user_id)
    decided_at = request.decided_at or utcnow()
    created_at = _as_aware_utc(request.created_at)
    decided_at = _as_aware_utc(decided_at)
    response_seconds = max(0, int((decided_at - created_at).total_seconds()))
    if decision == "approved":
        metric.requests_approved_count += 1
    elif decision == "rejected":
        metric.requests_rejected_count += 1
    else:
        raise ValueError(f"Unsupported owner request decision: {decision}")
    metric.responses_count += 1
    metric.response_time_seconds_total += response_seconds
    metric.last_response_at = decided_at
    return metric


def record_owner_request_expired(
    db: Session,
    *,
    owner_user_id: UUID,
    expired_at: datetime,
) -> FamilyOwnerMetric:
    metric = _get_or_create_owner_metric_for_update(db, owner_user_id)
    metric.requests_expired_count += 1
    metric.last_request_expired_at = expired_at
    return metric


def _get_or_create_owner_metric_for_update(
    db: Session,
    owner_user_id: UUID,
) -> FamilyOwnerMetric:
    metric = db.scalar(
        select(FamilyOwnerMetric)
        .where(FamilyOwnerMetric.owner_user_id == owner_user_id)
        .with_for_update()
    )
    if metric is not None:
        return metric
    metric = FamilyOwnerMetric(owner_user_id=owner_user_id)
    db.add(metric)
    db.flush()
    return metric


def _get_owned_family_for_update(db: Session, user: User, family_id: UUID) -> Family:
    family = db.scalar(select(Family).where(Family.id == family_id).with_for_update())
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_CHANGE_FAMILY")
    return family


def _get_member_for_update(db: Session, member_id: UUID) -> FamilyMember:
    member = db.scalar(
        select(FamilyMember).where(FamilyMember.id == member_id).with_for_update()
    )
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")
    return member


def _get_payment_for_update(db: Session, payment_id: UUID) -> FamilyPayment:
    payment = db.scalar(
        select(FamilyPayment).where(FamilyPayment.id == payment_id).with_for_update()
    )
    if payment is None:
        raise HTTPException(status_code=404, detail="FAMILY_PAYMENT_NOT_FOUND")
    return payment


def _release_family_slot(family: Family) -> None:
    family.active_members_count = max(1, family.active_members_count - 1)
    if family.status == "full" and family.active_members_count < family.max_members:
        family.status = "active"


def _restored_member_status(db: Session, member: FamilyMember) -> str:
    if member.access_confirmed_at is None:
        if member.access_provided_at is None:
            return "awaiting_access"
        return "awaiting_confirmation"

    open_payment = db.scalar(
        select(FamilyPayment)
        .where(FamilyPayment.member_id == member.id)
        .where(FamilyPayment.status.in_({"due", "overdue", "payment_reported"}))
        .order_by(FamilyPayment.created_at.desc())
    )
    if open_payment is not None:
        return "payment_due"
    return "active"


def _enqueue_family_members_notification(
    db: Session,
    family: Family,
    *,
    event_type: str,
    message: str,
    include_owner: bool = False,
) -> int:
    members = list(
        db.scalars(
            select(FamilyMember)
            .where(FamilyMember.family_id == family.id)
            .where(FamilyMember.status.in_(ACTIVE_MEMBER_STATUSES))
        ).all()
    )
    count = 0
    for member in members:
        if not include_owner and member.user_id == family.owner_user_id:
            continue
        enqueue_notification(
            db,
            recipient_user_id=member.user_id,
            event_type=event_type,
            payload={
                "family_id": str(family.id),
                "member_id": str(member.id),
                "message": message,
            },
        )
        count += 1
    return count


def _active_request_count_for_service(
    db: Session, *, user_id: UUID, service_id: UUID
) -> int:
    return (
        db.scalar(
            select(func.count(FamilyRequest.id))
            .join(Family, Family.id == FamilyRequest.family_id)
            .where(FamilyRequest.user_id == user_id)
            .where(FamilyRequest.status == ACTIVE_REQUEST_STATUS)
            .where(Family.service_id == service_id)
        )
        or 0
    )


def _payment_period_exists(
    db: Session,
    member_id: UUID,
    period_start: date,
    period_end: date,
) -> bool:
    payment_id = db.scalar(
        select(FamilyPayment.id)
        .where(FamilyPayment.member_id == member_id)
        .where(FamilyPayment.kind.in_({"regular", "prepaid"}))
        .where(FamilyPayment.status != "cancelled")
        .where(FamilyPayment.period_start == period_start)
        .where(FamilyPayment.period_end == period_end)
    )
    return payment_id is not None


def _period_count_label(count: int, period: str) -> str:
    if period == "yearly":
        return "год" if count == 1 else "года"
    if count == 1:
        return "месяц"
    if 2 <= count <= 4:
        return "месяца"
    return "месяцев"
