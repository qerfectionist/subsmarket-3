from __future__ import annotations

import re
import secrets
from datetime import UTC, date, datetime, time, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from subsmarket.catalog.models import FamilyService
from subsmarket.core.config import settings
from subsmarket.core.database import utcnow
from subsmarket.core.idempotency import claim_idempotency, complete_idempotency
from subsmarket.families.audit import record_family_audit_event
from subsmarket.families.calendar import add_payment_period, payment_due_at
from subsmarket.families.crypto import (
    decrypt_payment_requisite,
    encrypt_payment_requisite,
)
from subsmarket.families.models import (
    Family,
    FamilyAuditLog,
    FamilyInvite,
    FamilyMember,
    FamilyPayment,
    FamilyPaymentRequisite,
    FamilyRequest,
    FamilyRequestRestriction,
)
from subsmarket.families.pagination import (
    cursor_datetime,
    cursor_uuid,
    decode_cursor,
    encode_cursor,
)
from subsmarket.families.schemas import (
    AccessConfirmationResult,
    FamilyAuditLogOut,
    FamilyCreate,
    FamilyDescriptionUpdate,
    FamilyMemberOut,
    FamilyOut,
    FamilyPaymentDayUpdate,
    FamilyPaymentOut,
    FamilyPriceUpdate,
    FamilyRequestOut,
    FamilyViewOut,
    FamilyVisibilityUpdate,
    MyFamilyOut,
    OwnerFamilyRequestOut,
    PaymentConfirmationResult,
    PaymentRequisiteOut,
    PrepaymentPeriodsCreate,
    PublicOwner,
    RequestUserOut,
)
from subsmarket.identity.models import User
from subsmarket.notifications.models import NotificationJob
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
KAZAKHSTAN_TIMEZONE = timezone(timedelta(hours=5))
PHONE_RE = re.compile(r"^\+?7\d{10}$")


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


def _asc_datetime_uuid_condition(model, cursor: str, datetime_field: str):
    payload = decode_cursor(cursor)
    value = cursor_datetime(payload, datetime_field)
    item_id = cursor_uuid(payload, "id")
    column = getattr(model, datetime_field)
    return or_(
        column > value,
        and_(column == value, model.id > item_id),
    )


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


def to_family_out(family: Family) -> FamilyOut:
    return FamilyOut(
        id=family.id,
        service_id=family.service_id,
        family_type=family.family_type,
        service_slug=family.service.slug,
        service_name=family.service.name,
        service_variant=family.service.variant,
        owner=PublicOwner(
            first_name=family.owner.first_name,
            photo_url=family.owner.photo_url,
        ),
        status=family.status,
        period=family.period,
        max_members=family.max_members,
        active_members_count=family.active_members_count,
        free_slots=family.max_members - family.active_members_count,
        total_price_kzt=family.total_price_kzt,
        member_share_kzt=family.member_share_kzt,
        rounding_delta_kzt=family.rounding_delta_kzt,
        payment_day=family.payment_day,
        next_payment_date=family.next_payment_date,
        description=family.description,
        owner_rules=family.owner_rules,
        is_search_visible=family.is_search_visible,
        closing_started_at=family.closing_started_at,
        closes_at=family.closes_at,
        created_at=family.created_at,
    )


def to_family_request_out(request: FamilyRequest) -> FamilyRequestOut:
    return FamilyRequestOut(
        id=request.id,
        family_id=request.family_id,
        family_type=request.family.family_type,
        service_name=request.family.service.name,
        service_variant=request.family.service.variant,
        owner_username=(
            request.family.owner.username
            if request.status in {"pending", "approved"}
            else None
        ),
        user_id=request.user_id,
        status=request.status,
        cancel_reason=request.cancel_reason,
        created_at=request.created_at,
        expires_at=request.expires_at,
        decided_at=request.decided_at,
        cancelled_at=request.cancelled_at,
        expired_at=request.expired_at,
    )


def to_owner_family_request_out(request: FamilyRequest) -> OwnerFamilyRequestOut:
    return OwnerFamilyRequestOut(
        **to_family_request_out(request).model_dump(),
        candidate=RequestUserOut(
            id=request.user.id,
            username=request.user.username,
            first_name=request.user.first_name,
            photo_url=request.user.photo_url,
        ),
    )


def to_member_out(member: FamilyMember) -> FamilyMemberOut:
    return FamilyMemberOut(
        id=member.id,
        family_id=member.family_id,
        user=RequestUserOut(
            id=member.user.id,
            username=member.user.username,
            first_name=member.user.first_name,
            photo_url=member.user.photo_url,
        ),
        role=member.role,
        status=member.status,
        joined_at=member.joined_at,
        access_provided_at=member.access_provided_at,
        access_confirmed_at=member.access_confirmed_at,
        removal_scheduled_at=member.removal_scheduled_at,
        removal_acknowledged_at=member.removal_acknowledged_at,
        removal_cancel_requested_at=member.removal_cancel_requested_at,
        removal_reason=member.removal_reason,
        left_at=member.left_at,
        removed_at=member.removed_at,
        cancelled_at=member.cancelled_at,
        closing_acknowledged_at=member.closing_acknowledged_at,
    )


def to_payment_out(payment: FamilyPayment) -> FamilyPaymentOut:
    return FamilyPaymentOut(
        id=payment.id,
        family_id=payment.family_id,
        member_id=payment.member_id,
        kind=payment.kind,
        status=payment.status,
        amount_kzt=payment.amount_kzt,
        period=payment.period,
        period_start=payment.period_start,
        period_end=payment.period_end,
        due_at=payment.due_at,
        requisites_opened_at=payment.requisites_opened_at,
        reported_paid_at=payment.reported_paid_at,
        confirmed_paid_at=payment.confirmed_paid_at,
        overdue_at=payment.overdue_at,
        cancelled_at=payment.cancelled_at,
        cancel_reason=payment.cancel_reason,
    )


def to_audit_log_out(log: FamilyAuditLog) -> FamilyAuditLogOut:
    return FamilyAuditLogOut(
        id=log.id,
        family_id=log.family_id,
        actor_user_id=log.actor_user_id,
        target_user_id=log.target_user_id,
        target_member_id=log.target_member_id,
        target_request_id=log.target_request_id,
        target_payment_id=log.target_payment_id,
        action=log.action,
        old_status=log.old_status,
        new_status=log.new_status,
        details=log.details,
        created_at=log.created_at,
    )


def create_family(
    db: Session,
    user: User,
    data: FamilyCreate,
    *,
    idempotency_key: str | None = None,
) -> Family:
    user_id = user.id
    claim = claim_idempotency(
        db,
        user_id=user_id,
        operation="family.create",
        idempotency_key=idempotency_key,
        payload=data.model_dump(mode="json"),
        resource_type="family",
    )
    if claim.is_replay:
        family = get_family_by_id(db, claim.resource_id)
        if family is None:
            raise RuntimeError("Idempotent family was not found")
        return family

    service = db.get(FamilyService, data.service_id)
    if service is None or service.status != "active":
        raise HTTPException(status_code=404, detail="FAMILY_SERVICE_NOT_FOUND")
    if (
        data.period not in ALLOWED_PERIODS
        or data.period not in service.supported_periods
    ):
        raise HTTPException(status_code=400, detail="UNSUPPORTED_FAMILY_PERIOD")
    if data.max_members > service.max_members:
        raise HTTPException(status_code=400, detail="MAX_MEMBERS_EXCEEDS_SERVICE_LIMIT")

    payment_phone = normalize_payment_phone(data.payment_phone)
    member_share, rounding_delta = calculate_member_share(
        data.total_price_kzt, data.max_members
    )

    locked_user = db.scalar(
        select(User).where(User.id == user_id).with_for_update()
    )
    if locked_user is None:
        raise RuntimeError("Family owner disappeared during creation")

    active_owned_count = db.scalar(
        select(func.count(Family.id))
        .where(Family.owner_user_id == user_id)
        .where(Family.status.in_(ACTIVE_OWNER_FAMILY_STATUSES))
    )
    if active_owned_count and active_owned_count >= 2:
        raise HTTPException(status_code=409, detail="OWNER_ACTIVE_FAMILY_LIMIT_REACHED")

    family = Family(
        service_id=service.id,
        owner_user_id=user_id,
        family_type=service.family_type,
        status="active",
        period=data.period,
        max_members=data.max_members,
        active_members_count=1,
        total_price_kzt=data.total_price_kzt,
        member_share_kzt=member_share,
        rounding_delta_kzt=rounding_delta,
        payment_day=data.payment_day,
        next_payment_date=data.next_payment_date,
        description=data.description,
        owner_rules=data.owner_rules,
    )
    db.add(family)
    db.flush()

    db.add(
        FamilyPaymentRequisite(
            family_id=family.id,
            bank=data.payment_bank,
            encrypted_phone=encrypt_payment_requisite(payment_phone),
        )
    )
    owner_member = FamilyMember(
        family_id=family.id,
        user_id=user_id,
        role="owner",
        status="active",
    )
    db.add(owner_member)
    db.flush()
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_created",
        actor_user_id=user_id,
        target_user_id=user_id,
        target_member_id=owner_member.id,
        new_status=family.status,
        details={
            "family_type": family.family_type,
            "service_id": str(family.service_id),
            "period": family.period,
            "max_members": family.max_members,
            "total_price_kzt": family.total_price_kzt,
            "member_share_kzt": family.member_share_kzt,
            "payment_day": family.payment_day,
            "next_payment_date": family.next_payment_date.isoformat(),
        },
    )
    complete_idempotency(
        claim,
        resource_type="family",
        resource_id=family.id,
    )
    db.commit()

    loaded = get_family_by_id(db, family.id)
    if loaded is None:
        raise RuntimeError("Created family was not found")
    return loaded


def update_family_description(
    db: Session, user: User, family_id: UUID, data: FamilyDescriptionUpdate
) -> Family:
    family = _get_owned_family_for_update(db, user, family_id)
    if family.status not in {"active", "full", "closing"}:
        raise HTTPException(status_code=409, detail="FAMILY_NOT_EDITABLE")
    old_description = family.description
    family.description = data.description
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_description_updated",
        actor_user_id=user.id,
        details={
            "old_description": old_description,
            "new_description": family.description,
        },
    )
    db.commit()
    loaded = get_family_by_id(db, family.id)
    if loaded is None:
        raise RuntimeError("Updated family was not found")
    return loaded


def update_family_price(
    db: Session, user: User, family_id: UUID, data: FamilyPriceUpdate
) -> Family:
    family = _get_owned_family_for_update(db, user, family_id)
    if family.status not in {"active", "full"}:
        raise HTTPException(status_code=409, detail="FAMILY_PRICE_NOT_EDITABLE")

    now = utcnow()
    if (
        family.price_updated_at
        and family.price_updated_at.year == now.year
        and family.price_updated_at.month == now.month
    ):
        raise HTTPException(status_code=409, detail="FAMILY_PRICE_ALREADY_UPDATED")

    old_total_price = family.total_price_kzt
    old_member_share = family.member_share_kzt
    member_share, rounding_delta = calculate_member_share(
        data.total_price_kzt, family.max_members
    )
    family.total_price_kzt = data.total_price_kzt
    family.member_share_kzt = member_share
    family.rounding_delta_kzt = rounding_delta
    family.price_updated_at = now
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_price_updated",
        actor_user_id=user.id,
        details={
            "old_total_price_kzt": old_total_price,
            "new_total_price_kzt": family.total_price_kzt,
            "old_member_share_kzt": old_member_share,
            "new_member_share_kzt": family.member_share_kzt,
            "rounding_delta_kzt": family.rounding_delta_kzt,
        },
    )
    _enqueue_family_members_notification(
        db,
        family,
        event_type="family_price_changed",
        message=(
            "Стоимость семьи изменилась. Новая сумма будет применяться "
            "к будущим платежам."
        ),
    )
    db.commit()
    loaded = get_family_by_id(db, family.id)
    if loaded is None:
        raise RuntimeError("Updated family was not found")
    return loaded


def update_family_payment_day(
    db: Session, user: User, family_id: UUID, data: FamilyPaymentDayUpdate
) -> Family:
    family = _get_owned_family_for_update(db, user, family_id)
    if family.has_been_full:
        raise HTTPException(status_code=409, detail="FAMILY_PAYMENT_DAY_LOCKED")
    if family.status not in {"active", "full"}:
        raise HTTPException(status_code=409, detail="FAMILY_PAYMENT_DAY_NOT_EDITABLE")
    old_payment_day = family.payment_day
    old_next_payment_date = family.next_payment_date
    family.payment_day = data.payment_day
    family.next_payment_date = data.next_payment_date
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_payment_day_updated",
        actor_user_id=user.id,
        details={
            "old_payment_day": old_payment_day,
            "new_payment_day": family.payment_day,
            "old_next_payment_date": old_next_payment_date.isoformat(),
            "new_next_payment_date": family.next_payment_date.isoformat(),
        },
    )
    db.commit()
    loaded = get_family_by_id(db, family.id)
    if loaded is None:
        raise RuntimeError("Updated family was not found")
    return loaded


def update_family_visibility(
    db: Session,
    user: User,
    family_id: UUID,
    data: FamilyVisibilityUpdate,
) -> Family:
    family = _get_owned_family_for_update(db, user, family_id)
    if family.status not in {"active", "full"}:
        raise HTTPException(status_code=409, detail="FAMILY_VISIBILITY_NOT_EDITABLE")
    old_visibility = family.is_search_visible
    family.is_search_visible = data.is_search_visible
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_search_visibility_updated",
        actor_user_id=user.id,
        details={
            "old_is_search_visible": old_visibility,
            "new_is_search_visible": family.is_search_visible,
        },
    )
    db.commit()
    loaded = get_family_by_id(db, family.id)
    if loaded is None:
        raise RuntimeError("Updated family was not found")
    return loaded


def get_family_invite(
    db: Session,
    user: User,
    family_id: UUID,
) -> FamilyInvite | None:
    family = db.get(Family, family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_VIEW_INVITE")
    return db.scalar(
        select(FamilyInvite)
        .where(FamilyInvite.family_id == family_id)
        .where(FamilyInvite.status == "active")
    )


def create_family_invite(
    db: Session,
    user: User,
    family_id: UUID,
) -> FamilyInvite:
    family = _get_owned_family_for_update(db, user, family_id)
    _ensure_family_can_manage_invite(family)
    existing = db.scalar(
        select(FamilyInvite)
        .where(FamilyInvite.family_id == family.id)
        .where(FamilyInvite.status == "active")
        .with_for_update()
    )
    if existing is not None:
        return existing

    invite = _insert_family_invite(db, family.id)
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_invite_created",
        actor_user_id=user.id,
    )
    db.commit()
    db.refresh(invite)
    return invite


def rotate_family_invite(
    db: Session,
    user: User,
    family_id: UUID,
) -> FamilyInvite:
    family = _get_owned_family_for_update(db, user, family_id)
    _ensure_family_can_manage_invite(family)
    _revoke_active_family_invite(db, family.id, reason="rotated")
    invite = _insert_family_invite(db, family.id)
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_invite_rotated",
        actor_user_id=user.id,
    )
    db.commit()
    db.refresh(invite)
    return invite


def disable_family_invite(
    db: Session,
    user: User,
    family_id: UUID,
) -> None:
    family = _get_owned_family_for_update(db, user, family_id)
    invite = _revoke_active_family_invite(db, family.id, reason="owner_disabled")
    if invite is None:
        raise HTTPException(status_code=409, detail="FAMILY_INVITE_NOT_ACTIVE")
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_invite_disabled",
        actor_user_id=user.id,
    )
    db.commit()


def resolve_family_invite(
    db: Session,
    user: User,
    raw_code: str,
) -> FamilyViewOut:
    code = normalize_family_invite_code(raw_code)
    invite = db.scalar(
        select(FamilyInvite)
        .options(joinedload(FamilyInvite.family))
        .where(FamilyInvite.code == code)
    )
    if invite is None:
        raise HTTPException(status_code=404, detail="FAMILY_INVITE_NOT_FOUND")
    family = invite.family
    if invite.status != "active" or family.status in {"closing", "closed"}:
        raise HTTPException(status_code=410, detail="FAMILY_INVITE_INACTIVE")
    return get_family_view(db, user, family.id)


def normalize_family_invite_code(value: str) -> str:
    code = re.sub(r"[\s-]", "", value.strip())
    if not re.fullmatch(r"\d{8}", code):
        raise HTTPException(status_code=400, detail="INVALID_FAMILY_INVITE_CODE")
    return code


def _ensure_family_can_manage_invite(family: Family) -> None:
    if family.status not in {"active", "full"}:
        raise HTTPException(status_code=409, detail="FAMILY_INVITE_NOT_EDITABLE")


def _insert_family_invite(db: Session, family_id: UUID) -> FamilyInvite:
    for _ in range(20):
        code = f"{secrets.randbelow(100_000_000):08d}"
        if db.scalar(select(FamilyInvite.id).where(FamilyInvite.code == code)):
            continue
        invite = FamilyInvite(family_id=family_id, code=code, status="active")
        savepoint = db.begin_nested()
        try:
            db.add(invite)
            db.flush()
        except IntegrityError:
            savepoint.rollback()
            continue
        savepoint.commit()
        return invite
    raise RuntimeError("Could not allocate a unique family invite code")


def _revoke_active_family_invite(
    db: Session,
    family_id: UUID,
    *,
    reason: str,
) -> FamilyInvite | None:
    invite = db.scalar(
        select(FamilyInvite)
        .where(FamilyInvite.family_id == family_id)
        .where(FamilyInvite.status == "active")
        .with_for_update()
    )
    if invite is None:
        return None
    invite.status = "revoked"
    invite.revoked_reason = reason
    invite.revoked_at = utcnow()
    db.flush()
    return invite


def get_family_by_id(db: Session, family_id: UUID) -> Family | None:
    return db.scalar(
        select(Family)
        .options(joinedload(Family.service), joinedload(Family.owner))
        .where(Family.id == family_id)
    )


def list_searchable_families(
    db: Session,
    user: User,
    *,
    family_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Family]:
    stmt = (
        select(Family)
        .options(joinedload(Family.service), joinedload(Family.owner))
        .where(Family.status == "active")
        .where(Family.is_search_visible.is_(True))
        .where(Family.active_members_count < Family.max_members)
        .where(Family.owner_user_id != user.id)
        .where(
            ~select(FamilyRequestRestriction.family_id)
            .where(FamilyRequestRestriction.family_id == Family.id)
            .where(FamilyRequestRestriction.user_id == user.id)
            .exists()
        )
        .where(
            ~select(FamilyRequest.id)
            .where(FamilyRequest.family_id == Family.id)
            .where(FamilyRequest.user_id == user.id)
            .where(FamilyRequest.status == ACTIVE_REQUEST_STATUS)
            .exists()
        )
        .where(
            ~select(FamilyMember.id)
            .where(FamilyMember.family_id == Family.id)
            .where(FamilyMember.user_id == user.id)
            .where(FamilyMember.status.in_(ACTIVE_MEMBER_STATUSES))
            .exists()
        )
        .order_by(Family.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    if family_type:
        stmt = stmt.where(Family.family_type == family_type)
    return list(
        db.scalars(stmt).all()
    )


def list_searchable_families_page(
    db: Session,
    user: User,
    *,
    family_type: str | None = None,
    limit: int = 50,
    cursor: str | None = None,
) -> tuple[list[Family], str | None]:
    stmt = (
        select(Family)
        .options(joinedload(Family.service), joinedload(Family.owner))
        .where(Family.status == "active")
        .where(Family.is_search_visible.is_(True))
        .where(Family.active_members_count < Family.max_members)
        .where(Family.owner_user_id != user.id)
        .where(
            ~select(FamilyRequestRestriction.family_id)
            .where(FamilyRequestRestriction.family_id == Family.id)
            .where(FamilyRequestRestriction.user_id == user.id)
            .exists()
        )
        .where(
            ~select(FamilyRequest.id)
            .where(FamilyRequest.family_id == Family.id)
            .where(FamilyRequest.user_id == user.id)
            .where(FamilyRequest.status == ACTIVE_REQUEST_STATUS)
            .exists()
        )
        .where(
            ~select(FamilyMember.id)
            .where(FamilyMember.family_id == Family.id)
            .where(FamilyMember.user_id == user.id)
            .where(FamilyMember.status.in_(ACTIVE_MEMBER_STATUSES))
            .exists()
        )
        .order_by(Family.created_at.desc(), Family.id.desc())
        .limit(limit + 1)
    )
    if family_type:
        stmt = stmt.where(Family.family_type == family_type)
    if cursor:
        stmt = stmt.where(_desc_datetime_uuid_condition(Family, cursor))
    items = list(db.scalars(stmt).all())
    return _trim_page(
        items,
        limit,
        lambda family: encode_cursor(
            {"created_at": family.created_at, "id": family.id}
        ),
    )


def list_my_families(
    db: Session,
    user: User,
    *,
    limit: int = 50,
    offset: int = 0,
    payment_limit_per_family: int = 20,
) -> list[MyFamilyOut]:
    memberships = list(
        db.scalars(
            select(FamilyMember)
            .options(
                joinedload(FamilyMember.user),
                joinedload(FamilyMember.family).joinedload(Family.service),
                joinedload(FamilyMember.family).joinedload(Family.owner),
            )
            .where(FamilyMember.user_id == user.id)
            .where(FamilyMember.status.in_(ACTIVE_MEMBER_STATUSES))
            .order_by(FamilyMember.joined_at.desc())
            .offset(offset)
            .limit(limit)
        ).all()
    )

    return _my_family_out_from_memberships(
        db,
        memberships,
        payment_limit_per_family=payment_limit_per_family,
    )


def _my_family_out_from_memberships(
    db: Session,
    memberships: list[FamilyMember],
    *,
    payment_limit_per_family: int,
) -> list[MyFamilyOut]:
    membership_ids = [membership.id for membership in memberships]
    payments_by_member_id: dict[UUID, list[FamilyPayment]] = {
        membership_id: [] for membership_id in membership_ids
    }
    if membership_ids:
        row_number = (
            func.row_number()
            .over(
                partition_by=FamilyPayment.member_id,
                order_by=(
                    FamilyPayment.due_at.desc(),
                    FamilyPayment.created_at.desc(),
                ),
            )
            .label("row_number")
        )
        ranked_payments = (
            select(FamilyPayment.id.label("payment_id"), row_number)
            .where(FamilyPayment.member_id.in_(membership_ids))
            .subquery()
        )
        payments = list(
            db.scalars(
                select(FamilyPayment)
                .join(ranked_payments, FamilyPayment.id == ranked_payments.c.payment_id)
                .where(ranked_payments.c.row_number <= payment_limit_per_family)
                .order_by(
                    FamilyPayment.member_id.asc(),
                    FamilyPayment.due_at.desc(),
                    FamilyPayment.created_at.desc(),
                )
            ).all()
        )
        for payment in payments:
            payments_by_member_id[payment.member_id].append(payment)

    owner_family_ids = [
        membership.family_id for membership in memberships if membership.role == "owner"
    ]
    pending_requests_by_family_id: dict[UUID, int] = {}
    if owner_family_ids:
        rows = db.execute(
            select(FamilyRequest.family_id, func.count(FamilyRequest.id))
            .where(FamilyRequest.family_id.in_(owner_family_ids))
            .where(FamilyRequest.status == ACTIVE_REQUEST_STATUS)
            .group_by(FamilyRequest.family_id)
        ).all()
        pending_requests_by_family_id = {
            family_id: int(count) for family_id, count in rows
        }

    result: list[MyFamilyOut] = []
    for membership in memberships:
        payments = payments_by_member_id.get(membership.id, [])
        pending_requests_count = pending_requests_by_family_id.get(
            membership.family_id, 0
        )
        result.append(
            MyFamilyOut(
                family=to_family_out(membership.family),
                membership=to_member_out(membership),
                payments=[to_payment_out(payment) for payment in payments],
                pending_requests_count=pending_requests_count,
            )
        )
    return result


def list_my_families_page(
    db: Session,
    user: User,
    *,
    limit: int = 50,
    cursor: str | None = None,
    payment_limit_per_family: int = 20,
) -> tuple[list[MyFamilyOut], str | None]:
    stmt = (
        select(FamilyMember)
        .options(
            joinedload(FamilyMember.user),
            joinedload(FamilyMember.family).joinedload(Family.service),
            joinedload(FamilyMember.family).joinedload(Family.owner),
        )
        .where(FamilyMember.user_id == user.id)
        .where(FamilyMember.status.in_(ACTIVE_MEMBER_STATUSES))
        .order_by(FamilyMember.joined_at.desc(), FamilyMember.id.desc())
        .limit(limit + 1)
    )
    if cursor:
        payload = decode_cursor(cursor)
        joined_at = cursor_datetime(payload, "joined_at")
        member_id = cursor_uuid(payload, "id")
        stmt = stmt.where(
            or_(
                FamilyMember.joined_at < joined_at,
                and_(FamilyMember.joined_at == joined_at, FamilyMember.id < member_id),
            )
        )
    memberships = list(db.scalars(stmt).all())
    page_memberships, next_cursor = _trim_page(
        memberships,
        limit,
        lambda membership: encode_cursor(
            {"joined_at": membership.joined_at, "id": membership.id}
        ),
    )
    return (
        _my_family_out_from_memberships(
            db,
            page_memberships,
            payment_limit_per_family=payment_limit_per_family,
        ),
        next_cursor,
    )


def list_my_payments(
    db: Session, user: User, *, limit: int = 50, offset: int = 0
) -> list[FamilyPayment]:
    return list(
        db.scalars(
            select(FamilyPayment)
            .join(FamilyMember, FamilyMember.id == FamilyPayment.member_id)
            .where(FamilyMember.user_id == user.id)
            .order_by(FamilyPayment.due_at.desc(), FamilyPayment.created_at.desc())
            .offset(offset)
            .limit(limit)
        ).all()
    )


def list_my_payments_page(
    db: Session,
    user: User,
    *,
    limit: int = 50,
    cursor: str | None = None,
) -> tuple[list[FamilyPayment], str | None]:
    stmt = (
        select(FamilyPayment)
        .join(FamilyMember, FamilyMember.id == FamilyPayment.member_id)
        .where(FamilyMember.user_id == user.id)
        .order_by(
            FamilyPayment.due_at.desc(),
            FamilyPayment.created_at.desc(),
            FamilyPayment.id.desc(),
        )
        .limit(limit + 1)
    )
    if cursor:
        payload = decode_cursor(cursor)
        due_at = cursor_datetime(payload, "due_at")
        created_at = cursor_datetime(payload, "created_at")
        payment_id = cursor_uuid(payload, "id")
        stmt = stmt.where(
            or_(
                FamilyPayment.due_at < due_at,
                and_(
                    FamilyPayment.due_at == due_at,
                    FamilyPayment.created_at < created_at,
                ),
                and_(
                    FamilyPayment.due_at == due_at,
                    FamilyPayment.created_at == created_at,
                    FamilyPayment.id < payment_id,
                ),
            )
        )
    items = list(db.scalars(stmt).all())
    return _trim_page(
        items,
        limit,
        lambda payment: encode_cursor(
            {
                "due_at": payment.due_at,
                "created_at": payment.created_at,
                "id": payment.id,
            }
        ),
    )


def get_family_view(db: Session, user: User, family_id: UUID) -> FamilyViewOut:
    family = get_family_by_id(db, family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")

    membership = db.scalar(
        select(FamilyMember)
        .options(joinedload(FamilyMember.user))
        .where(FamilyMember.family_id == family_id)
        .where(FamilyMember.user_id == user.id)
        .where(FamilyMember.status.in_(ACTIVE_MEMBER_STATUSES))
        .order_by(FamilyMember.created_at.desc())
    )
    request = db.scalar(
        select(FamilyRequest)
        .options(joinedload(FamilyRequest.family).joinedload(Family.service))
        .where(FamilyRequest.family_id == family_id)
        .where(FamilyRequest.user_id == user.id)
        .order_by(FamilyRequest.created_at.desc())
    )
    can_request = (
        family.owner_user_id != user.id
        and membership is None
        and family.status == "active"
        and family.active_members_count < family.max_members
        and (
            request is None
            or request.status not in {ACTIVE_REQUEST_STATUS, "rejected"}
        )
    )

    return FamilyViewOut(
        family=to_family_out(family),
        owner_username=(
            family.owner.username
            if membership is not None
            or (request is not None and request.status in {"pending", "approved"})
            else None
        ),
        my_membership=to_member_out(membership) if membership else None,
        my_request=to_family_request_out(request) if request else None,
        my_payments=(
            [
                to_payment_out(payment)
                for payment in list_member_payments(db, user, membership.id)
            ]
            if membership
            else []
        ),
        can_request=can_request,
    )


def list_family_audit_logs(
    db: Session,
    user: User,
    family_id: UUID,
    *,
    limit: int = 50,
    offset: int = 0,
) -> list[FamilyAuditLog]:
    family = db.get(Family, family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")

    is_owner = family.owner_user_id == user.id
    membership = db.scalar(
        select(FamilyMember)
        .where(FamilyMember.family_id == family_id)
        .where(FamilyMember.user_id == user.id)
    )
    if not is_owner and membership is None:
        raise HTTPException(status_code=403, detail="FAMILY_AUDIT_FORBIDDEN")

    return list(
        db.scalars(
            select(FamilyAuditLog)
            .where(FamilyAuditLog.family_id == family_id)
            .order_by(FamilyAuditLog.created_at.desc())
            .offset(offset)
            .limit(limit)
        ).all()
    )


def list_family_audit_logs_page(
    db: Session,
    user: User,
    family_id: UUID,
    *,
    limit: int = 50,
    cursor: str | None = None,
) -> tuple[list[FamilyAuditLog], str | None]:
    family = db.get(Family, family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")

    is_owner = family.owner_user_id == user.id
    membership = db.scalar(
        select(FamilyMember)
        .where(FamilyMember.family_id == family_id)
        .where(FamilyMember.user_id == user.id)
    )
    if not is_owner and membership is None:
        raise HTTPException(status_code=403, detail="FAMILY_AUDIT_FORBIDDEN")

    stmt = (
        select(FamilyAuditLog)
        .where(FamilyAuditLog.family_id == family_id)
        .order_by(FamilyAuditLog.created_at.desc(), FamilyAuditLog.id.desc())
        .limit(limit + 1)
    )
    if cursor:
        stmt = stmt.where(_desc_datetime_uuid_condition(FamilyAuditLog, cursor))
    items = list(db.scalars(stmt).all())
    return _trim_page(
        items,
        limit,
        lambda log: encode_cursor({"created_at": log.created_at, "id": log.id}),
    )


def _get_joinable_family(db: Session, family_id: UUID) -> Family:
    family = db.scalar(
        select(Family).where(Family.id == family_id).with_for_update()
    )
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.status != "active" or family.active_members_count >= family.max_members:
        raise HTTPException(status_code=409, detail="FAMILY_NOT_JOINABLE")
    return family


def _get_owned_family_for_update(db: Session, user: User, family_id: UUID) -> Family:
    family = db.scalar(select(Family).where(Family.id == family_id).with_for_update())
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_CHANGE_FAMILY")
    return family


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


def create_join_request(
    db: Session,
    user: User,
    family_id: UUID,
    *,
    idempotency_key: str | None = None,
) -> FamilyRequest:
    user_id = user.id
    claim = claim_idempotency(
        db,
        user_id=user_id,
        operation="family_request.create",
        idempotency_key=idempotency_key,
        payload={"family_id": str(family_id)},
        resource_type="family_request",
    )
    if claim.is_replay:
        request = db.get(FamilyRequest, claim.resource_id)
        if request is None:
            raise RuntimeError("Idempotent family request was not found")
        return request

    locked_user = db.scalar(
        select(User).where(User.id == user_id).with_for_update()
    )
    if locked_user is None:
        raise RuntimeError("Family candidate disappeared during request creation")

    family = _get_joinable_family(db, family_id)
    if family.owner_user_id == user_id:
        raise HTTPException(status_code=400, detail="OWNER_CANNOT_REQUEST_OWN_FAMILY")

    existing_member = db.scalar(
        select(FamilyMember)
        .where(FamilyMember.family_id == family.id)
        .where(FamilyMember.user_id == user_id)
        .where(FamilyMember.status.in_(ACTIVE_MEMBER_STATUSES))
    )
    if existing_member:
        raise HTTPException(status_code=409, detail="ALREADY_IN_FAMILY")

    restriction = db.get(
        FamilyRequestRestriction,
        {"family_id": family.id, "user_id": user_id},
    )
    if restriction:
        raise HTTPException(status_code=409, detail="FAMILY_REQUEST_FORBIDDEN")

    pending_for_family = db.scalar(
        select(FamilyRequest)
        .where(FamilyRequest.family_id == family.id)
        .where(FamilyRequest.user_id == user_id)
        .where(FamilyRequest.status == ACTIVE_REQUEST_STATUS)
    )
    if pending_for_family:
        raise HTTPException(status_code=409, detail="FAMILY_REQUEST_ALREADY_PENDING")

    self_cancel_count = (
        db.scalar(
            select(func.count(FamilyRequest.id))
            .where(FamilyRequest.family_id == family.id)
            .where(FamilyRequest.user_id == user_id)
            .where(FamilyRequest.status == "cancelled")
            .where(FamilyRequest.cancel_reason == "user_cancelled")
        )
        or 0
    )
    if self_cancel_count >= 2:
        raise HTTPException(status_code=409, detail="SELF_CANCEL_LIMIT_REACHED")

    active_for_service = _active_request_count_for_service(
        db, user_id=user_id, service_id=family.service_id
    )
    if active_for_service >= 3:
        raise HTTPException(
            status_code=409,
            detail=f"У вас уже 3 активные заявки на {family.service.name}. "
            "Дождитесь ответа или отмените одну заявку.",
        )

    now = utcnow()
    request = FamilyRequest(
        family_id=family.id,
        user_id=user_id,
        status=ACTIVE_REQUEST_STATUS,
        expires_at=now + timedelta(hours=24),
    )
    db.add(request)
    db.flush()
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_request_created",
        actor_user_id=user_id,
        target_user_id=user_id,
        target_request_id=request.id,
        new_status=request.status,
    )
    enqueue_notification(
        db,
        recipient_user_id=family.owner_user_id,
        event_type="family_request_created_owner",
        payload={
            "family_id": str(family.id),
            "request_id": str(request.id),
            "message": (
                f"Новая заявка в семью {family.service.name}. "
                f"Кандидат: @{user.username}."
            ),
        },
    )
    complete_idempotency(
        claim,
        resource_type="family_request",
        resource_id=request.id,
    )
    db.commit()
    db.refresh(request)
    return request


def cancel_join_request(
    db: Session, user: User, request_id: UUID, *, reason: str = "user_cancelled"
) -> FamilyRequest:
    request = db.scalar(
        select(FamilyRequest)
        .where(FamilyRequest.id == request_id)
        .where(FamilyRequest.user_id == user.id)
        .with_for_update()
    )
    if request is None:
        raise HTTPException(status_code=404, detail="FAMILY_REQUEST_NOT_FOUND")
    if request.status != ACTIVE_REQUEST_STATUS:
        raise HTTPException(status_code=409, detail="FAMILY_REQUEST_NOT_PENDING")

    old_status = request.status
    request.status = "cancelled"
    request.cancel_reason = reason
    request.cancelled_at = utcnow()
    family = db.get(Family, request.family_id)
    if family is not None:
        record_family_audit_event(
            db,
            family_id=family.id,
            action="family_request_cancelled",
            actor_user_id=user.id,
            target_user_id=request.user_id,
            target_request_id=request.id,
            old_status=old_status,
            new_status=request.status,
            details={"reason": reason},
        )
        enqueue_notification(
            db,
            recipient_user_id=family.owner_user_id,
            event_type="family_request_cancelled_owner",
            payload={
                "family_id": str(request.family_id),
                "request_id": str(request.id),
                "message": f"{user.first_name} отменил заявку.",
            },
        )
    db.commit()
    db.refresh(request)
    return request


def list_my_join_requests(
    db: Session, user: User, *, limit: int = 50, offset: int = 0
) -> list[FamilyRequest]:
    return list(
        db.scalars(
            select(FamilyRequest)
            .options(
                joinedload(FamilyRequest.family).joinedload(Family.service),
                joinedload(FamilyRequest.family).joinedload(Family.owner),
            )
            .where(FamilyRequest.user_id == user.id)
            .order_by(FamilyRequest.created_at.desc())
            .offset(offset)
            .limit(limit)
        ).all()
    )


def list_my_join_requests_page(
    db: Session,
    user: User,
    *,
    limit: int = 50,
    cursor: str | None = None,
) -> tuple[list[FamilyRequest], str | None]:
    stmt = (
        select(FamilyRequest)
        .options(
            joinedload(FamilyRequest.family).joinedload(Family.service),
            joinedload(FamilyRequest.family).joinedload(Family.owner),
        )
        .where(FamilyRequest.user_id == user.id)
        .order_by(FamilyRequest.created_at.desc(), FamilyRequest.id.desc())
        .limit(limit + 1)
    )
    if cursor:
        stmt = stmt.where(_desc_datetime_uuid_condition(FamilyRequest, cursor))
    items = list(db.scalars(stmt).all())
    return _trim_page(
        items,
        limit,
        lambda request: encode_cursor(
            {"created_at": request.created_at, "id": request.id}
        ),
    )


def list_owner_family_requests(
    db: Session,
    user: User,
    family_id: UUID,
    *,
    limit: int = 50,
    offset: int = 0,
) -> list[FamilyRequest]:
    family = db.get(Family, family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_VIEW_REQUESTS")

    return list(
        db.scalars(
            select(FamilyRequest)
            .options(
                joinedload(FamilyRequest.user),
                joinedload(FamilyRequest.family).joinedload(Family.service),
            )
            .where(FamilyRequest.family_id == family_id)
            .where(FamilyRequest.status == ACTIVE_REQUEST_STATUS)
            .order_by(FamilyRequest.created_at.asc())
            .offset(offset)
            .limit(limit)
        ).all()
    )


def list_owner_family_requests_page(
    db: Session,
    user: User,
    family_id: UUID,
    *,
    limit: int = 50,
    cursor: str | None = None,
) -> tuple[list[FamilyRequest], str | None]:
    family = db.get(Family, family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_VIEW_REQUESTS")

    stmt = (
        select(FamilyRequest)
        .options(
            joinedload(FamilyRequest.user),
            joinedload(FamilyRequest.family).joinedload(Family.service),
        )
        .where(FamilyRequest.family_id == family_id)
        .where(FamilyRequest.status == ACTIVE_REQUEST_STATUS)
        .order_by(FamilyRequest.created_at.asc(), FamilyRequest.id.asc())
        .limit(limit + 1)
    )
    if cursor:
        stmt = stmt.where(
            _asc_datetime_uuid_condition(FamilyRequest, cursor, "created_at")
        )
    items = list(db.scalars(stmt).all())
    return _trim_page(
        items,
        limit,
        lambda request: encode_cursor(
            {"created_at": request.created_at, "id": request.id}
        ),
    )


def reject_join_request(db: Session, user: User, request_id: UUID) -> FamilyRequest:
    request = db.scalar(
        select(FamilyRequest)
        .where(FamilyRequest.id == request_id)
        .with_for_update()
    )
    if request is None:
        raise HTTPException(status_code=404, detail="FAMILY_REQUEST_NOT_FOUND")

    family = db.get(Family, request.family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_REJECT_REQUEST")
    if request.status != ACTIVE_REQUEST_STATUS:
        raise HTTPException(status_code=409, detail="FAMILY_REQUEST_NOT_PENDING")

    old_status = request.status
    request.status = "rejected"
    request.decided_at = utcnow()
    db.add(
        FamilyRequestRestriction(
            family_id=request.family_id,
            user_id=request.user_id,
            reason="rejected",
        )
    )
    enqueue_notification(
        db,
        recipient_user_id=request.user_id,
        event_type="family_request_rejected_candidate",
        payload={
            "family_id": str(request.family_id),
            "request_id": str(request.id),
            "message": "Заявка отклонена. Вы можете отправить заявку в другую семью.",
        },
    )
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_request_rejected",
        actor_user_id=user.id,
        target_user_id=request.user_id,
        target_request_id=request.id,
        old_status=old_status,
        new_status=request.status,
        details={"restriction_created": True},
    )
    db.commit()
    db.refresh(request)
    return request


def approve_join_request(db: Session, user: User, request_id: UUID) -> FamilyRequest:
    family_id = db.scalar(
        select(FamilyRequest.family_id).where(FamilyRequest.id == request_id)
    )
    if family_id is None:
        raise HTTPException(status_code=404, detail="FAMILY_REQUEST_NOT_FOUND")
    family = db.scalar(
        select(Family)
        .where(Family.id == family_id)
        .with_for_update()
    )
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    request = db.scalar(
        select(FamilyRequest)
        .where(FamilyRequest.id == request_id)
        .with_for_update()
    )
    if request is None:
        raise HTTPException(status_code=404, detail="FAMILY_REQUEST_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_APPROVE_REQUEST")
    if request.status != ACTIVE_REQUEST_STATUS:
        raise HTTPException(status_code=409, detail="FAMILY_REQUEST_NOT_PENDING")
    if family.status != "active" or family.active_members_count >= family.max_members:
        raise HTTPException(status_code=409, detail="FAMILY_NOT_JOINABLE")

    old_request_status = request.status
    old_family_status = family.status
    request.status = "approved"
    request.decided_at = utcnow()
    member = FamilyMember(
        family_id=family.id,
        user_id=request.user_id,
        role="member",
        status="awaiting_access",
    )
    db.add(member)
    family.active_members_count += 1
    db.flush()
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_request_approved",
        actor_user_id=user.id,
        target_user_id=request.user_id,
        target_member_id=member.id,
        target_request_id=request.id,
        old_status=old_request_status,
        new_status=request.status,
        details={"member_status": member.status},
    )
    enqueue_notification(
        db,
        recipient_user_id=request.user_id,
        event_type="family_request_approved_candidate",
        payload={
            "family_id": str(family.id),
            "request_id": str(request.id),
            "member_id": str(member.id),
            "message": (
                "Заявка принята. Договоритесь с владельцем, "
                "получите доступ и потом оплатите."
            ),
        },
    )
    if family.active_members_count >= family.max_members:
        family.status = "full"
        family.has_been_full = True
        record_family_audit_event(
            db,
            family_id=family.id,
            action="family_became_full",
            old_status=old_family_status,
            new_status=family.status,
            details={
                "active_members_count": family.active_members_count,
                "max_members": family.max_members,
            },
        )
        _cancel_pending_requests_for_full_family(
            db, family.id, exclude_user_id=request.user_id
        )
    db.commit()
    db.refresh(request)
    return request


def _cancel_pending_requests_for_full_family(
    db: Session, family_id: UUID, *, exclude_user_id: UUID
) -> None:
    pending_requests = db.scalars(
        select(FamilyRequest)
        .where(FamilyRequest.family_id == family_id)
        .where(FamilyRequest.status == ACTIVE_REQUEST_STATUS)
        .where(FamilyRequest.user_id != exclude_user_id)
    ).all()
    now = utcnow()
    for request in pending_requests:
        old_status = request.status
        request.status = "cancelled"
        request.cancel_reason = "family_full"
        request.cancelled_at = now
        record_family_audit_event(
            db,
            family_id=family_id,
            action="family_request_cancelled_family_full",
            target_user_id=request.user_id,
            target_request_id=request.id,
            old_status=old_status,
            new_status=request.status,
            details={"reason": "family_full"},
        )
        enqueue_notification(
            db,
            recipient_user_id=request.user_id,
            event_type="family_request_cancelled_family_full",
            payload={
                "family_id": str(family_id),
                "request_id": str(request.id),
                "message": (
                    "Заявка закрыта: семья уже заполнена. "
                    "Это не считается отказом."
                ),
            },
        )


def _cancel_pending_requests_for_closing_family(
    db: Session,
    family_id: UUID,
) -> None:
    pending_requests = db.scalars(
        select(FamilyRequest)
        .where(FamilyRequest.family_id == family_id)
        .where(FamilyRequest.status == ACTIVE_REQUEST_STATUS)
        .with_for_update()
    ).all()
    now = utcnow()
    for request in pending_requests:
        old_status = request.status
        request.status = "cancelled"
        request.cancel_reason = "family_closing"
        request.cancelled_at = now
        record_family_audit_event(
            db,
            family_id=family_id,
            action="family_request_cancelled_family_closing",
            target_user_id=request.user_id,
            target_request_id=request.id,
            old_status=old_status,
            new_status=request.status,
            details={"reason": "family_closing"},
        )
        enqueue_notification(
            db,
            recipient_user_id=request.user_id,
            event_type="family_request_cancelled_family_closing",
            payload={
                "family_id": str(family_id),
                "request_id": str(request.id),
                "message": (
                    "Семья закрывается, поэтому заявка отменена. "
                    "Вы можете выбрать другую семью."
                ),
            },
        )


def list_family_members(
    db: Session,
    user: User,
    family_id: UUID,
    *,
    limit: int = 50,
    offset: int = 0,
) -> list[FamilyMember]:
    family = db.get(Family, family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_VIEW_MEMBERS")

    return list(
        db.scalars(
            select(FamilyMember)
            .options(joinedload(FamilyMember.user))
            .where(FamilyMember.family_id == family_id)
            .order_by(FamilyMember.joined_at.asc())
            .offset(offset)
            .limit(limit)
        ).all()
    )


def list_family_members_page(
    db: Session,
    user: User,
    family_id: UUID,
    *,
    limit: int = 50,
    cursor: str | None = None,
) -> tuple[list[FamilyMember], str | None]:
    family = db.get(Family, family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_VIEW_MEMBERS")

    stmt = (
        select(FamilyMember)
        .options(joinedload(FamilyMember.user))
        .where(FamilyMember.family_id == family_id)
        .order_by(FamilyMember.joined_at.asc(), FamilyMember.id.asc())
        .limit(limit + 1)
    )
    if cursor:
        payload = decode_cursor(cursor)
        joined_at = cursor_datetime(payload, "joined_at")
        member_id = cursor_uuid(payload, "id")
        stmt = stmt.where(
            or_(
                FamilyMember.joined_at > joined_at,
                and_(FamilyMember.joined_at == joined_at, FamilyMember.id > member_id),
            )
        )
    items = list(db.scalars(stmt).all())
    return _trim_page(
        items,
        limit,
        lambda member: encode_cursor({"joined_at": member.joined_at, "id": member.id}),
    )


def cancel_member_before_access(
    db: Session, user: User, member_id: UUID
) -> FamilyMember:
    member = _get_member_for_update(db, member_id)
    family = db.scalar(
        select(Family).where(Family.id == member.family_id).with_for_update()
    )
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.status in {"closing", "closed"}:
        raise HTTPException(status_code=409, detail="FAMILY_NOT_MUTABLE")
    if user.id not in {member.user_id, family.owner_user_id}:
        raise HTTPException(status_code=403, detail="MEMBER_CANCEL_FORBIDDEN")
    if member.role == "owner":
        raise HTTPException(status_code=400, detail="OWNER_CANNOT_CANCEL_MEMBERSHIP")
    if member.status != "awaiting_access":
        raise HTTPException(status_code=409, detail="MEMBER_NOT_AWAITING_ACCESS")

    now = utcnow()
    old_status = member.status
    member.status = "cancelled_before_access"
    member.cancelled_at = now
    _release_family_slot(family)
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_member_cancelled_before_access",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        old_status=old_status,
        new_status=member.status,
        details={"cancelled_by_owner": user.id == family.owner_user_id},
    )
    if user.id == family.owner_user_id:
        enqueue_notification(
            db,
            recipient_user_id=member.user_id,
            event_type="family_member_cancelled_before_access",
            payload={
                "family_id": str(family.id),
                "member_id": str(member.id),
                "message": "Владелец отменил вступление до выдачи доступа.",
            },
        )
    else:
        enqueue_notification(
            db,
            recipient_user_id=family.owner_user_id,
            event_type="family_member_cancelled_by_candidate",
            payload={
                "family_id": str(family.id),
                "member_id": str(member.id),
                "message": f"{user.first_name} отменил вступление до выдачи доступа.",
            },
        )
    db.commit()
    db.refresh(member)
    member.user = db.get(User, member.user_id)
    return member


def leave_family(db: Session, user: User, member_id: UUID) -> FamilyMember:
    member = _get_member_for_update(db, member_id)
    if member.user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_MEMBER_CAN_LEAVE")
    if member.role == "owner":
        raise HTTPException(status_code=400, detail="OWNER_MUST_CLOSE_FAMILY")
    if member.status not in ACTIVE_MEMBER_STATUSES:
        raise HTTPException(status_code=409, detail="MEMBER_NOT_ACTIVE")

    family = db.scalar(
        select(Family).where(Family.id == member.family_id).with_for_update()
    )
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    old_status = member.status
    member.status = "left"
    member.left_at = utcnow()
    _release_family_slot(family)
    cancel_scheduled_payments(
        db,
        family_id=family.id,
        member_id=member.id,
        reason="member_left",
        actor_user_id=user.id,
    )
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_member_left",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        old_status=old_status,
        new_status=member.status,
    )
    enqueue_notification(
        db,
        recipient_user_id=family.owner_user_id,
        event_type="family_member_left",
        payload={
            "family_id": str(family.id),
            "member_id": str(member.id),
            "message": f"{user.first_name} вышел из семьи.",
        },
    )
    db.commit()
    db.refresh(member)
    member.user = db.get(User, member.user_id)
    return member


def remove_member(
    db: Session,
    user: User,
    member_id: UUID,
    *,
    reason: str,
    idempotency_key: str | None = None,
) -> FamilyMember:
    if reason not in MEMBER_REMOVAL_REASONS:
        raise HTTPException(status_code=422, detail="INVALID_MEMBER_REMOVAL_REASON")

    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation="family_member.remove",
        idempotency_key=idempotency_key,
        payload={"member_id": str(member_id), "reason": reason},
        resource_type="family_member",
    )
    if claim.is_replay:
        replayed_member = db.get(FamilyMember, claim.resource_id)
        if replayed_member is None:
            raise RuntimeError("Idempotent family member was not found")
        return replayed_member

    member = _get_member_for_update(db, member_id)
    family = db.scalar(
        select(Family).where(Family.id == member.family_id).with_for_update()
    )
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_REMOVE_MEMBER")
    if member.role == "owner":
        raise HTTPException(status_code=400, detail="OWNER_CANNOT_REMOVE_SELF")
    if family.status not in {"active", "full"}:
        raise HTTPException(status_code=409, detail="FAMILY_NOT_MUTABLE")
    if member.status not in {"payment_due", "active", "awaiting_confirmation"}:
        raise HTTPException(status_code=409, detail="MEMBER_NOT_REMOVABLE")

    now = utcnow()
    old_status = member.status
    member.status = "removed"
    member.removed_at = now
    member.removal_reason = reason
    member.removal_scheduled_at = None
    member.removal_acknowledged_at = None
    member.removal_cancel_requested_at = None
    cancel_scheduled_payments(
        db,
        family_id=family.id,
        member_id=member.id,
        reason="member_removed",
        actor_user_id=user.id,
    )
    _release_family_slot(family)
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_member_removed_by_owner",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        old_status=old_status,
        new_status=member.status,
        details={
            "removed_at": member.removed_at.isoformat(),
            "reason": reason,
        },
    )
    enqueue_notification(
        db,
        recipient_user_id=member.user_id,
        event_type="family_member_removed",
        payload={
            "family_id": str(family.id),
            "member_id": str(member.id),
            "reason": reason,
            "message": "Владелец удалил вас из семьи. Причина записана в истории.",
        },
    )
    complete_idempotency(
        claim,
        resource_type="family_member",
        resource_id=member.id,
    )
    db.commit()
    db.refresh(member)
    member.user = db.get(User, member.user_id)
    return member


def revoke_member_removal(db: Session, user: User, member_id: UUID) -> FamilyMember:
    member = _get_member_for_update(db, member_id)
    family = db.get(Family, member.family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_REVOKE_REMOVAL")
    if member.status != "removal_pending":
        raise HTTPException(status_code=409, detail="MEMBER_REMOVAL_NOT_PENDING")

    old_status = member.status
    member.status = _restored_member_status(db, member)
    member.removal_scheduled_at = None
    member.removal_acknowledged_at = None
    member.removal_cancel_requested_at = None
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_member_removal_revoked",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        old_status=old_status,
        new_status=member.status,
    )
    enqueue_notification(
        db,
        recipient_user_id=member.user_id,
        event_type="family_member_removal_revoked",
        payload={
            "family_id": str(family.id),
            "member_id": str(member.id),
            "message": "Владелец отменил удаление из семьи.",
        },
    )
    db.commit()
    db.refresh(member)
    member.user = db.get(User, member.user_id)
    return member


def acknowledge_member_removal(
    db: Session, user: User, member_id: UUID
) -> FamilyMember:
    member = _get_member_for_update(db, member_id)
    if member.user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_MEMBER_CAN_ACK_REMOVAL")
    if member.status != "removal_pending":
        raise HTTPException(status_code=409, detail="MEMBER_REMOVAL_NOT_PENDING")
    family = db.get(Family, member.family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")

    if member.removal_acknowledged_at is not None:
        member.user = db.get(User, member.user_id)
        return member

    member.removal_acknowledged_at = utcnow()
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_member_removal_acknowledged",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        old_status=member.status,
        new_status=member.status,
        details={
            "removal_acknowledged_at": member.removal_acknowledged_at.isoformat(),
            "removal_scheduled_at": member.removal_scheduled_at.isoformat()
            if member.removal_scheduled_at
            else None,
        },
    )
    enqueue_notification(
        db,
        recipient_user_id=family.owner_user_id,
        event_type="family_member_removal_acknowledged",
        payload={
            "family_id": str(family.id),
            "member_id": str(member.id),
            "message": f"{user.first_name} подтвердил уведомление об удалении.",
        },
    )
    db.commit()
    db.refresh(member)
    member.user = db.get(User, member.user_id)
    return member


def request_member_removal_cancellation(
    db: Session, user: User, member_id: UUID
) -> FamilyMember:
    member = _get_member_for_update(db, member_id)
    if member.user_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="ONLY_MEMBER_CAN_REQUEST_REMOVAL_CANCELLATION",
        )
    if member.status != "removal_pending":
        raise HTTPException(status_code=409, detail="MEMBER_REMOVAL_NOT_PENDING")
    family = db.get(Family, member.family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if member.removal_cancel_requested_at is not None:
        member.user = db.get(User, member.user_id)
        return member

    member.removal_cancel_requested_at = utcnow()
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_member_removal_cancellation_requested",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        old_status=member.status,
        new_status=member.status,
        details={
            "removal_cancel_requested_at": (
                member.removal_cancel_requested_at.isoformat()
            ),
            "removal_scheduled_at": member.removal_scheduled_at.isoformat()
            if member.removal_scheduled_at
            else None,
        },
    )
    enqueue_notification(
        db,
        recipient_user_id=family.owner_user_id,
        event_type="family_member_removal_cancellation_requested",
        payload={
            "family_id": str(family.id),
            "member_id": str(member.id),
            "message": (
                f"{user.first_name} просит отменить удаление из семьи. "
                "Решение остаётся за владельцем."
            ),
        },
    )
    db.commit()
    db.refresh(member)
    member.user = db.get(User, member.user_id)
    return member


def close_family(
    db: Session,
    user: User,
    family_id: UUID,
    *,
    closes_on: date,
    idempotency_key: str | None = None,
) -> Family:
    if closes_on < utcnow().astimezone(KAZAKHSTAN_TIMEZONE).date():
        raise HTTPException(status_code=422, detail="FAMILY_CLOSE_DATE_IN_PAST")

    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation="family.close",
        idempotency_key=idempotency_key,
        payload={"family_id": str(family_id), "closes_on": closes_on.isoformat()},
        resource_type="family",
    )
    if claim.is_replay:
        replayed_family = get_family_by_id(db, claim.resource_id)
        if replayed_family is None:
            raise RuntimeError("Idempotent family was not found")
        return replayed_family

    family = _get_owned_family_for_update(db, user, family_id)
    if family.status == "closed":
        raise HTTPException(status_code=409, detail="FAMILY_ALREADY_CLOSED")
    if family.status != "closing":
        now = utcnow()
        old_status = family.status
        family.status = "closing"
        family.is_search_visible = False
        family.closing_started_at = now
        family.closes_at = datetime.combine(
            closes_on,
            time.max,
            tzinfo=KAZAKHSTAN_TIMEZONE,
        ).astimezone(UTC)
        _revoke_active_family_invite(
            db,
            family.id,
            reason="family_closing",
        )
        cancel_scheduled_payments(
            db,
            family_id=family.id,
            reason="family_closing",
            actor_user_id=user.id,
        )
        _cancel_pending_requests_for_closing_family(db, family.id)
        record_family_audit_event(
            db,
            family_id=family.id,
            action="family_closing_started",
            actor_user_id=user.id,
            old_status=old_status,
            new_status=family.status,
            details={
                "closes_on": closes_on.isoformat(),
                "closes_at": family.closes_at.isoformat(),
            },
        )
        _enqueue_family_members_notification(
            db,
            family,
            event_type="family_closing_started",
            message=(
                f"Семья закрывается {closes_on.isoformat()}. "
                "Подтвердите, что увидели уведомление."
            ),
        )
    complete_idempotency(
        claim,
        resource_type="family",
        resource_id=family.id,
    )
    db.commit()
    loaded = get_family_by_id(db, family.id)
    if loaded is None:
        raise RuntimeError("Closed family was not found")
    return loaded


def acknowledge_family_closing(
    db: Session, user: User, family_id: UUID
) -> FamilyMember:
    member = db.scalar(
        select(FamilyMember)
        .where(FamilyMember.family_id == family_id)
        .where(FamilyMember.user_id == user.id)
        .where(FamilyMember.status.in_(ACTIVE_MEMBER_STATUSES))
        .with_for_update()
    )
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")
    family = db.get(Family, family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.status != "closing":
        raise HTTPException(status_code=409, detail="FAMILY_NOT_CLOSING")

    member.closing_acknowledged_at = utcnow()
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_closing_acknowledged",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        details={
            "closing_acknowledged_at": member.closing_acknowledged_at.isoformat(),
        },
    )
    db.commit()
    db.refresh(member)
    member.user = db.get(User, member.user_id)
    return member


def mark_access_provided(
    db: Session,
    user: User,
    member_id: UUID,
    *,
    idempotency_key: str | None = None,
) -> FamilyMember:
    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation="family_member.provide_access",
        idempotency_key=idempotency_key,
        payload={"member_id": str(member_id)},
        resource_type="family_member",
    )
    if claim.is_replay:
        replayed_member = db.get(FamilyMember, claim.resource_id)
        if replayed_member is None:
            raise RuntimeError("Idempotent family member was not found")
        return replayed_member

    member = db.scalar(
        select(FamilyMember).where(FamilyMember.id == member_id).with_for_update()
    )
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")
    family = db.scalar(
        select(Family).where(Family.id == member.family_id).with_for_update()
    )
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_PROVIDE_ACCESS")
    if member.role == "owner":
        raise HTTPException(status_code=400, detail="OWNER_ACCESS_ALREADY_ACTIVE")
    if family.status not in {"active", "full"}:
        raise HTTPException(status_code=409, detail="FAMILY_NOT_MUTABLE")
    if member.status != "awaiting_access":
        raise HTTPException(status_code=409, detail="MEMBER_NOT_AWAITING_ACCESS")

    now = utcnow()
    old_status = member.status
    member.status = "awaiting_confirmation"
    member.access_provided_at = now
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_access_provided",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        old_status=old_status,
        new_status=member.status,
        details={"access_provided_at": member.access_provided_at.isoformat()},
    )
    enqueue_notification(
        db,
        recipient_user_id=member.user_id,
        event_type="family_access_provided_member",
        payload={
            "family_id": str(member.family_id),
            "member_id": str(member.id),
            "message": (
                "Владелец отметил, что доступ выдан. "
                "Проверьте доступ и подтвердите получение."
            ),
        },
    )
    complete_idempotency(
        claim,
        resource_type="family_member",
        resource_id=member.id,
    )
    db.commit()
    db.refresh(member)
    return member


def remind_access_confirmation(
    db: Session, user: User, member_id: UUID
) -> FamilyMember:
    member = db.scalar(
        select(FamilyMember).where(FamilyMember.id == member_id).with_for_update()
    )
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")
    family = db.scalar(
        select(Family).where(Family.id == member.family_id).with_for_update()
    )
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="ONLY_OWNER_CAN_REMIND_ACCESS_CONFIRMATION",
        )
    if family.status not in {"active", "full"}:
        raise HTTPException(status_code=409, detail="FAMILY_NOT_MUTABLE")
    if member.role == "owner" or member.status != "awaiting_confirmation":
        raise HTTPException(
            status_code=409,
            detail="MEMBER_NOT_AWAITING_CONFIRMATION",
        )

    now = utcnow()
    recent_jobs = list(
        db.scalars(
            select(NotificationJob)
            .where(NotificationJob.recipient_user_id == member.user_id)
            .where(
                NotificationJob.event_type
                == "family_access_confirmation_reminder_member"
            )
            .where(
                NotificationJob.created_at
                >= now - timedelta(seconds=settings.access_reminder_cooldown_seconds)
            )
        ).all()
    )
    if any(job.payload.get("member_id") == str(member.id) for job in recent_jobs):
        raise HTTPException(status_code=429, detail="ACCESS_REMINDER_COOLDOWN")

    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_access_confirmation_reminded",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        details={"reminded_at": now.isoformat()},
    )
    enqueue_notification(
        db,
        recipient_user_id=member.user_id,
        event_type="family_access_confirmation_reminder_member",
        payload={
            "family_id": str(member.family_id),
            "member_id": str(member.id),
            "message": (
                "Владелец напоминает: проверьте доступ и подтвердите его получение "
                "в SubsMarket."
            ),
        },
    )
    db.commit()
    db.refresh(member)
    return member


def confirm_access_received(
    db: Session,
    user: User,
    member_id: UUID,
    *,
    idempotency_key: str | None = None,
) -> AccessConfirmationResult:
    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation="family_member.confirm_access",
        idempotency_key=idempotency_key,
        payload={"member_id": str(member_id)},
        resource_type="family_payment",
    )
    if claim.is_replay:
        replayed_payment = db.get(FamilyPayment, claim.resource_id)
        if replayed_payment is None:
            raise RuntimeError("Idempotent family payment was not found")
        return _access_confirmation_result(db, replayed_payment)

    member = db.scalar(
        select(FamilyMember).where(FamilyMember.id == member_id).with_for_update()
    )
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")
    if member.user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_MEMBER_CAN_CONFIRM_ACCESS")
    if member.status != "awaiting_confirmation":
        raise HTTPException(status_code=409, detail="MEMBER_NOT_AWAITING_CONFIRMATION")

    family = db.scalar(
        select(Family).where(Family.id == member.family_id).with_for_update()
    )
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.status not in {"active", "full"}:
        raise HTTPException(status_code=409, detail="FAMILY_NOT_MUTABLE")
    requisite = db.scalar(
        select(FamilyPaymentRequisite).where(
            FamilyPaymentRequisite.family_id == family.id
        )
    )
    if requisite is None:
        raise HTTPException(status_code=500, detail="PAYMENT_REQUISITE_NOT_FOUND")

    now = utcnow()
    today = date.today()
    period_end = family.next_payment_date
    if period_end <= today:
        period_end = today + timedelta(days=30 if family.period == "monthly" else 365)

    old_member_status = member.status
    member.status = "payment_due"
    member.access_confirmed_at = now
    payment = FamilyPayment(
        family_id=family.id,
        member_id=member.id,
        kind="first",
        status="due",
        amount_kzt=family.member_share_kzt,
        period=family.period,
        period_start=today,
        period_end=period_end,
        due_at=now + timedelta(minutes=30),
        requisites_opened_at=now,
    )
    db.add(payment)
    db.flush()
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_access_confirmed",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        target_payment_id=payment.id,
        old_status=old_member_status,
        new_status=member.status,
        details={
            "access_confirmed_at": member.access_confirmed_at.isoformat(),
            "payment_kind": payment.kind,
            "payment_status": payment.status,
            "amount_kzt": payment.amount_kzt,
            "period_start": payment.period_start.isoformat(),
            "period_end": payment.period_end.isoformat(),
        },
    )
    enqueue_notification(
        db,
        recipient_user_id=family.owner_user_id,
        event_type="family_access_confirmed_owner",
        payload={
            "family_id": str(family.id),
            "member_id": str(member.id),
            "payment_id": str(payment.id),
            "message": (
                f"{user.first_name} подтвердил доступ. "
                "Теперь ожидается первый платеж."
            ),
        },
    )
    complete_idempotency(
        claim,
        resource_type="family_payment",
        resource_id=payment.id,
    )
    db.commit()
    db.refresh(member)
    db.refresh(payment)

    return _access_confirmation_result(db, payment)


def _access_confirmation_result(
    db: Session,
    payment: FamilyPayment,
) -> AccessConfirmationResult:
    member = db.get(FamilyMember, payment.member_id)
    if member is None:
        raise RuntimeError("Family member for access confirmation was not found")
    requisite = db.scalar(
        select(FamilyPaymentRequisite).where(
            FamilyPaymentRequisite.family_id == payment.family_id
        )
    )
    if requisite is None:
        raise RuntimeError("Payment requisite for access confirmation was not found")
    member.user = db.get(User, member.user_id)
    return AccessConfirmationResult(
        member=to_member_out(member),
        payment=to_payment_out(payment),
        payment_requisite=PaymentRequisiteOut(
            bank=requisite.bank,
            phone=decrypt_payment_requisite(requisite.encrypted_phone),
        ),
    )


def get_open_payment_requisite(
    db: Session, user: User, member_id: UUID
) -> PaymentRequisiteOut:
    member = db.scalar(select(FamilyMember).where(FamilyMember.id == member_id))
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")
    family = db.get(Family, member.family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")

    can_view = user.id in {member.user_id, family.owner_user_id}
    if not can_view:
        raise HTTPException(status_code=403, detail="PAYMENT_REQUISITE_FORBIDDEN")
    if member.access_confirmed_at is None:
        raise HTTPException(status_code=409, detail="ACCESS_NOT_CONFIRMED")

    requisite = db.scalar(
        select(FamilyPaymentRequisite).where(
            FamilyPaymentRequisite.family_id == family.id
        )
    )
    if requisite is None:
        raise HTTPException(status_code=500, detail="PAYMENT_REQUISITE_NOT_FOUND")
    return PaymentRequisiteOut(
        bank=requisite.bank,
        phone=decrypt_payment_requisite(requisite.encrypted_phone),
    )


def list_member_payments(
    db: Session,
    user: User,
    member_id: UUID,
    *,
    limit: int = 50,
    offset: int = 0,
) -> list[FamilyPayment]:
    member = db.get(FamilyMember, member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")
    family = db.get(Family, member.family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if user.id not in {member.user_id, family.owner_user_id}:
        raise HTTPException(status_code=403, detail="FAMILY_PAYMENTS_FORBIDDEN")

    return list(
        db.scalars(
            select(FamilyPayment)
            .where(FamilyPayment.member_id == member_id)
            .order_by(FamilyPayment.created_at.desc())
            .offset(offset)
            .limit(limit)
        ).all()
    )


def list_member_payments_page(
    db: Session,
    user: User,
    member_id: UUID,
    *,
    limit: int = 50,
    cursor: str | None = None,
) -> tuple[list[FamilyPayment], str | None]:
    member = db.get(FamilyMember, member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")
    family = db.get(Family, member.family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if user.id not in {member.user_id, family.owner_user_id}:
        raise HTTPException(status_code=403, detail="FAMILY_PAYMENTS_FORBIDDEN")

    stmt = (
        select(FamilyPayment)
        .where(FamilyPayment.member_id == member_id)
        .order_by(FamilyPayment.created_at.desc(), FamilyPayment.id.desc())
        .limit(limit + 1)
    )
    if cursor:
        stmt = stmt.where(_desc_datetime_uuid_condition(FamilyPayment, cursor))
    items = list(db.scalars(stmt).all())
    return _trim_page(
        items,
        limit,
        lambda payment: encode_cursor(
            {"created_at": payment.created_at, "id": payment.id}
        ),
    )


def list_family_member_payments(
    db: Session,
    user: User,
    family_id: UUID,
    *,
    limit_per_member: int = 20,
    member_limit: int = 50,
    member_offset: int = 0,
) -> list[tuple[UUID, list[FamilyPayment]]]:
    family = db.get(Family, family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_VIEW_PAYMENTS")

    member_ids = list(
        db.scalars(
            select(FamilyMember.id)
            .where(FamilyMember.family_id == family_id)
            .order_by(FamilyMember.joined_at.asc())
            .offset(member_offset)
            .limit(member_limit)
        ).all()
    )
    if not member_ids:
        return []

    row_number = (
        func.row_number()
        .over(
            partition_by=FamilyPayment.member_id,
            order_by=FamilyPayment.created_at.desc(),
        )
        .label("row_number")
    )
    ranked_payments = (
        select(FamilyPayment.id.label("payment_id"), row_number)
        .where(FamilyPayment.member_id.in_(member_ids))
        .subquery()
    )
    payments = list(
        db.scalars(
            select(FamilyPayment)
            .join(ranked_payments, FamilyPayment.id == ranked_payments.c.payment_id)
            .where(ranked_payments.c.row_number <= limit_per_member)
            .order_by(FamilyPayment.member_id.asc(), FamilyPayment.created_at.desc())
        ).all()
    )
    payments_by_member_id: dict[UUID, list[FamilyPayment]] = {
        member_id: [] for member_id in member_ids
    }
    for payment in payments:
        payments_by_member_id[payment.member_id].append(payment)
    return [
        (member_id, payments_by_member_id.get(member_id, []))
        for member_id in member_ids
    ]


def create_member_prepayment(
    db: Session, user: User, member_id: UUID
) -> FamilyPayment:
    member = _get_member_for_update(db, member_id)
    if member.user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_MEMBER_CAN_PREPAY")
    if member.role == "owner" or member.status != "active":
        raise HTTPException(
            status_code=409,
            detail="MEMBER_NOT_ELIGIBLE_FOR_PREPAYMENT",
        )

    family = db.get(Family, member.family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.status not in {"active", "full"}:
        raise HTTPException(
            status_code=409,
            detail="FAMILY_NOT_ELIGIBLE_FOR_PREPAYMENT",
        )

    period_start = family.next_payment_date
    period_end = add_payment_period(period_start, family.period)
    if _payment_period_exists(db, member.id, period_start, period_end):
        raise HTTPException(status_code=409, detail="MEMBER_PREPAYMENT_LIMIT_REACHED")

    now = utcnow()
    payment = FamilyPayment(
        family_id=family.id,
        member_id=member.id,
        kind="prepaid",
        status="due",
        amount_kzt=family.member_share_kzt,
        period=family.period,
        period_start=period_start,
        period_end=period_end,
        due_at=payment_due_at(period_start),
        requisites_opened_at=now,
    )
    db.add(payment)
    db.flush()
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_prepayment_created",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        target_payment_id=payment.id,
        new_status=payment.status,
        details={
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "amount_kzt": payment.amount_kzt,
        },
    )
    db.commit()
    db.refresh(payment)
    return payment


def record_owner_prepaid_periods(
    db: Session,
    user: User,
    member_id: UUID,
    data: PrepaymentPeriodsCreate,
) -> list[FamilyPayment]:
    member = _get_member_for_update(db, member_id)
    family = db.get(Family, member.family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_RECORD_PREPAYMENT")
    if member.role == "owner" or member.status != "active":
        raise HTTPException(
            status_code=409,
            detail="MEMBER_NOT_ELIGIBLE_FOR_PREPAYMENT",
        )
    if family.status not in {"active", "full"}:
        raise HTTPException(
            status_code=409,
            detail="FAMILY_NOT_ELIGIBLE_FOR_PREPAYMENT",
        )
    if family.period == "yearly" and data.periods > 3:
        raise HTTPException(status_code=409, detail="YEARLY_PREPAYMENT_LIMIT_REACHED")

    now = utcnow()
    created: list[FamilyPayment] = []
    period_start = family.next_payment_date
    while len(created) < data.periods:
        period_end = add_payment_period(period_start, family.period)
        if not _payment_period_exists(db, member.id, period_start, period_end):
            payment = FamilyPayment(
                family_id=family.id,
                member_id=member.id,
                kind="prepaid",
                status="paid",
                amount_kzt=family.member_share_kzt,
                period=family.period,
                period_start=period_start,
                period_end=period_end,
                due_at=payment_due_at(period_start),
                requisites_opened_at=now,
                reported_paid_at=now,
                confirmed_paid_at=now,
            )
            db.add(payment)
            db.flush()
            record_family_audit_event(
                db,
                family_id=family.id,
                action="family_prepayment_recorded_by_owner",
                actor_user_id=user.id,
                target_user_id=member.user_id,
                target_member_id=member.id,
                target_payment_id=payment.id,
                new_status=payment.status,
                details={
                    "period_start": period_start.isoformat(),
                    "period_end": period_end.isoformat(),
                    "amount_kzt": payment.amount_kzt,
                },
            )
            created.append(payment)
        period_start = period_end

    enqueue_notification(
        db,
        recipient_user_id=member.user_id,
        event_type="family_prepayment_recorded_member",
        payload={
            "family_id": str(family.id),
            "member_id": str(member.id),
            "payment_ids": [str(payment.id) for payment in created],
            "message": (
                f"Владелец отметил предоплату: {len(created)} "
                f"{_period_count_label(len(created), family.period)}."
            ),
        },
    )
    db.commit()
    for payment in created:
        db.refresh(payment)
    return created


def report_payment_paid(
    db: Session,
    user: User,
    payment_id: UUID,
    *,
    idempotency_key: str | None = None,
) -> FamilyPayment:
    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation="family_payment.report_paid",
        idempotency_key=idempotency_key,
        payload={"payment_id": str(payment_id)},
        resource_type="family_payment",
    )
    if claim.is_replay:
        replayed_payment = db.get(FamilyPayment, claim.resource_id)
        if replayed_payment is None:
            raise RuntimeError("Idempotent family payment was not found")
        return replayed_payment

    payment = _get_payment_for_update(db, payment_id)
    member = db.get(FamilyMember, payment.member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")
    if member.user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_MEMBER_CAN_REPORT_PAYMENT")
    if payment.status not in {"due", "overdue"}:
        raise HTTPException(status_code=409, detail="PAYMENT_NOT_REPORTABLE")

    family = db.get(Family, payment.family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")

    old_status = payment.status
    cancel_pending_payment_notifications(db, payment)
    payment.status = "payment_reported"
    payment.reported_paid_at = utcnow()
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_payment_reported",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        target_payment_id=payment.id,
        old_status=old_status,
        new_status=payment.status,
        details={
            "payment_kind": payment.kind,
            "amount_kzt": payment.amount_kzt,
            "reported_paid_at": payment.reported_paid_at.isoformat(),
        },
    )
    enqueue_notification(
        db,
        recipient_user_id=family.owner_user_id,
        event_type="family_payment_reported_owner",
        payload={
            "family_id": str(payment.family_id),
            "member_id": str(member.id),
            "payment_id": str(payment.id),
            "message": (
                f"{user.first_name} отметил оплату. "
                "Проверьте перевод и подтвердите."
            ),
        },
    )
    complete_idempotency(
        claim,
        resource_type="family_payment",
        resource_id=payment.id,
    )
    db.commit()
    db.refresh(payment)
    return payment


def cancel_payment_report(db: Session, user: User, payment_id: UUID) -> FamilyPayment:
    payment = _get_payment_for_update(db, payment_id)
    member = db.get(FamilyMember, payment.member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")
    if member.user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_MEMBER_CAN_CANCEL_REPORT")
    if payment.status != "payment_reported":
        raise HTTPException(status_code=409, detail="PAYMENT_REPORT_NOT_ACTIVE")

    family = db.get(Family, payment.family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")

    old_status = payment.status
    cancel_pending_payment_notifications(db, payment)
    payment.status = "overdue" if payment.overdue_at is not None else "due"
    payment.reported_paid_at = None
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_payment_report_cancelled",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        target_payment_id=payment.id,
        old_status=old_status,
        new_status=payment.status,
        details={"payment_kind": payment.kind},
    )
    enqueue_notification(
        db,
        recipient_user_id=family.owner_user_id,
        event_type="family_payment_report_cancelled_owner",
        payload={
            "family_id": str(payment.family_id),
            "member_id": str(member.id),
            "payment_id": str(payment.id),
            "message": f"{user.first_name} отменил отметку оплаты.",
        },
    )
    db.commit()
    db.refresh(payment)
    return payment


def confirm_payment_received(
    db: Session,
    user: User,
    payment_id: UUID,
    *,
    idempotency_key: str | None = None,
) -> PaymentConfirmationResult:
    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation="family_payment.confirm_received",
        idempotency_key=idempotency_key,
        payload={"payment_id": str(payment_id)},
        resource_type="family_payment",
    )
    if claim.is_replay:
        replayed_payment = db.get(FamilyPayment, claim.resource_id)
        if replayed_payment is None:
            raise RuntimeError("Idempotent family payment was not found")
        return _payment_confirmation_result(db, replayed_payment)

    payment = _get_payment_for_update(db, payment_id)
    member = db.scalar(
        select(FamilyMember)
        .where(FamilyMember.id == payment.member_id)
        .with_for_update()
    )
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")
    family = db.get(Family, payment.family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_CONFIRM_PAYMENT")
    if payment.status != "payment_reported":
        raise HTTPException(status_code=409, detail="PAYMENT_NOT_REPORTED")

    old_payment_status = payment.status
    old_member_status = member.status
    cancel_pending_payment_notifications(db, payment)
    payment.status = "paid"
    payment.confirmed_paid_at = utcnow()
    if member.status == "payment_due" and not _has_other_open_payment(
        db, member.id, exclude_payment_id=payment.id
    ):
        member.status = "active"
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_payment_confirmed",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        target_payment_id=payment.id,
        old_status=old_payment_status,
        new_status=payment.status,
        details={
            "payment_kind": payment.kind,
            "amount_kzt": payment.amount_kzt,
            "confirmed_paid_at": payment.confirmed_paid_at.isoformat(),
            "old_member_status": old_member_status,
            "new_member_status": member.status,
        },
    )
    enqueue_notification(
        db,
        recipient_user_id=member.user_id,
        event_type="family_payment_confirmed_member",
        payload={
            "family_id": str(payment.family_id),
            "member_id": str(member.id),
            "payment_id": str(payment.id),
            "message": "Владелец подтвердил оплату.",
        },
    )
    complete_idempotency(
        claim,
        resource_type="family_payment",
        resource_id=payment.id,
    )
    db.commit()
    db.refresh(payment)
    db.refresh(member)
    return _payment_confirmation_result(db, payment)


def _payment_confirmation_result(
    db: Session,
    payment: FamilyPayment,
) -> PaymentConfirmationResult:
    member = db.get(FamilyMember, payment.member_id)
    if member is None:
        raise RuntimeError("Family member for payment confirmation was not found")
    member.user = db.get(User, member.user_id)
    return PaymentConfirmationResult(
        member=to_member_out(member), payment=to_payment_out(payment)
    )


def mark_payment_not_received(
    db: Session, user: User, payment_id: UUID
) -> FamilyPayment:
    payment = _get_payment_for_update(db, payment_id)
    family = db.get(Family, payment.family_id)
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="ONLY_OWNER_CAN_MARK_NOT_RECEIVED")
    if payment.status != "payment_reported":
        raise HTTPException(status_code=409, detail="PAYMENT_NOT_REPORTED")
    member = db.get(FamilyMember, payment.member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")

    old_status = payment.status
    cancel_pending_payment_notifications(db, payment)
    payment.status = "overdue" if payment.overdue_at is not None else "due"
    payment.reported_paid_at = None
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_payment_not_received",
        actor_user_id=user.id,
        target_user_id=member.user_id,
        target_member_id=member.id,
        target_payment_id=payment.id,
        old_status=old_status,
        new_status=payment.status,
        details={"payment_kind": payment.kind},
    )
    enqueue_notification(
        db,
        recipient_user_id=member.user_id,
        event_type="family_payment_not_received_member",
        payload={
            "family_id": str(payment.family_id),
            "member_id": str(member.id),
            "payment_id": str(payment.id),
            "message": (
                "Владелец отметил, что оплату не получил. "
                "Проверьте перевод и свяжитесь с владельцем."
            ),
        },
    )
    db.commit()
    db.refresh(payment)
    return payment


def _get_member_for_update(db: Session, member_id: UUID) -> FamilyMember:
    member = db.scalar(
        select(FamilyMember).where(FamilyMember.id == member_id).with_for_update()
    )
    if member is None:
        raise HTTPException(status_code=404, detail="FAMILY_MEMBER_NOT_FOUND")
    return member


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


def _get_payment_for_update(db: Session, payment_id: UUID) -> FamilyPayment:
    payment = db.scalar(
        select(FamilyPayment).where(FamilyPayment.id == payment_id).with_for_update()
    )
    if payment is None:
        raise HTTPException(status_code=404, detail="FAMILY_PAYMENT_NOT_FOUND")
    return payment


def _has_other_open_payment(
    db: Session, member_id: UUID, *, exclude_payment_id: UUID
) -> bool:
    payment = db.scalar(
        select(FamilyPayment.id)
        .where(FamilyPayment.member_id == member_id)
        .where(FamilyPayment.id != exclude_payment_id)
        .where(FamilyPayment.status.in_({"due", "overdue", "payment_reported"}))
    )
    return payment is not None


def cancel_pending_payment_notifications(
    db: Session, payment: FamilyPayment
) -> int:
    family = db.get(Family, payment.family_id)
    member = db.get(FamilyMember, payment.member_id)
    if family is None or member is None:
        return 0

    jobs = list(
        db.scalars(
            select(NotificationJob)
            .where(NotificationJob.status == "pending")
            .where(
                NotificationJob.recipient_user_id.in_(
                    {family.owner_user_id, member.user_id}
                )
            )
        ).all()
    )
    cancelled = 0
    for job in jobs:
        if job.payload.get("payment_id") != str(payment.id):
            continue
        job.status = "cancelled"
        cancelled += 1
    return cancelled


def cancel_scheduled_payments(
    db: Session,
    *,
    family_id: UUID,
    reason: str,
    actor_user_id: UUID | None = None,
    member_id: UUID | None = None,
) -> int:
    stmt = (
        select(FamilyPayment)
        .where(FamilyPayment.family_id == family_id)
        .where(FamilyPayment.status == "scheduled")
    )
    if member_id is not None:
        stmt = stmt.where(FamilyPayment.member_id == member_id)

    payments = list(db.scalars(stmt).all())
    now = utcnow()
    for payment in payments:
        old_status = payment.status
        payment.status = "cancelled"
        payment.cancelled_at = now
        payment.cancel_reason = reason
        cancel_pending_payment_notifications(db, payment)
        member = db.get(FamilyMember, payment.member_id)
        record_family_audit_event(
            db,
            family_id=family_id,
            action="family_payment_cancelled",
            actor_user_id=actor_user_id,
            target_user_id=member.user_id if member else None,
            target_member_id=payment.member_id,
            target_payment_id=payment.id,
            old_status=old_status,
            new_status=payment.status,
            details={
                "reason": reason,
                "cancelled_at": payment.cancelled_at.isoformat(),
            },
        )
    return len(payments)


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
