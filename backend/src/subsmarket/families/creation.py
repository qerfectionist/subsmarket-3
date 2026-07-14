from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from subsmarket.catalog.models import FamilyService
from subsmarket.core.database import utcnow
from subsmarket.core.idempotency import claim_idempotency, complete_idempotency
from subsmarket.families._internal import (
    ACTIVE_OWNER_FAMILY_STATUSES,
    ALLOWED_PERIODS,
    FAMILY_AVAILABILITY_TTL,
    _enqueue_family_members_notification,
    _get_owned_family_for_update,
    calculate_member_share,
    normalize_payment_phone,
)
from subsmarket.families.audit import record_family_audit_event
from subsmarket.families.crypto import encrypt_payment_requisite
from subsmarket.families.models import (
    Family,
    FamilyMember,
    FamilyPaymentRequisite,
)
from subsmarket.families.queries import get_family_by_id
from subsmarket.families.schemas import (
    FamilyCreate,
    FamilyDescriptionUpdate,
    FamilyPaymentDayUpdate,
    FamilyPriceUpdate,
    FamilyVisibilityUpdate,
)
from subsmarket.identity.models import User


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

    plan_name = " ".join(data.plan_name.split()) if data.plan_name else None
    if service.family_type == "tariff" and not plan_name:
        raise HTTPException(status_code=400, detail="TARIFF_PLAN_NAME_REQUIRED")
    if service.family_type != "tariff" and plan_name:
        raise HTTPException(status_code=400, detail="PLAN_NAME_ONLY_FOR_TARIFF")

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

    now = utcnow()
    family = Family(
        service_id=service.id,
        owner_user_id=user_id,
        family_type=service.family_type,
        plan_name=plan_name,
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
        availability_confirmed_at=now,
        availability_expires_at=now + FAMILY_AVAILABILITY_TTL,
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
            "plan_name": family.plan_name,
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
    db.flush()

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
    db.flush()
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
    db.flush()
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
    db.flush()
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
    db.flush()
    loaded = get_family_by_id(db, family.id)
    if loaded is None:
        raise RuntimeError("Updated family was not found")
    return loaded


def confirm_family_availability(
    db: Session,
    user: User,
    family_id: UUID,
) -> Family:
    family = _get_owned_family_for_update(db, user, family_id)
    if family.status not in {"active", "full"}:
        raise HTTPException(status_code=409, detail="FAMILY_AVAILABILITY_NOT_EDITABLE")

    now = utcnow()
    old_confirmed_at = family.availability_confirmed_at
    old_expires_at = family.availability_expires_at
    family.availability_confirmed_at = now
    family.availability_expires_at = now + FAMILY_AVAILABILITY_TTL
    record_family_audit_event(
        db,
        family_id=family.id,
        action="family_availability_confirmed",
        actor_user_id=user.id,
        details={
            "old_availability_confirmed_at": (
                old_confirmed_at.isoformat() if old_confirmed_at else None
            ),
            "new_availability_confirmed_at": (
                family.availability_confirmed_at.isoformat()
            ),
            "old_availability_expires_at": (
                old_expires_at.isoformat() if old_expires_at else None
            ),
            "new_availability_expires_at": family.availability_expires_at.isoformat(),
            "ttl_days": FAMILY_AVAILABILITY_TTL.days,
        },
    )
    db.flush()
    loaded = get_family_by_id(db, family.id)
    if loaded is None:
        raise RuntimeError("Updated family was not found")
    return loaded
