from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload

from subsmarket.families._internal import (
    ACTIVE_MEMBER_STATUSES,
    ACTIVE_REQUEST_STATUS,
    _asc_datetime_uuid_condition,
    _desc_availability_datetime_uuid_condition,
    _desc_datetime_uuid_condition,
    _desc_due_created_uuid_condition,
    _trim_page,
)
from subsmarket.families.models import (
    Family,
    FamilyAuditLog,
    FamilyMember,
    FamilyPayment,
    FamilyRequest,
    FamilyRequestRestriction,
)
from subsmarket.families.pagination import (
    decode_cursor,
    encode_cursor,
)
from subsmarket.families.schemas import (
    FamilyAuditLogOut,
    FamilyMemberOut,
    FamilyOut,
    FamilyPaymentOut,
    FamilyRequestOut,
    FamilyViewOut,
    MyFamilyOut,
    OwnerFamilyRequestOut,
    PublicOwner,
    RequestUserOut,
)
from subsmarket.identity.models import User


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
        availability_confirmed_at=family.availability_confirmed_at,
        availability_expires_at=family.availability_expires_at,
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
        .order_by(
            Family.availability_confirmed_at.desc().nullslast(),
            Family.created_at.desc(),
            Family.id.desc(),
        )
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
        .order_by(
            Family.availability_confirmed_at.desc().nullslast(),
            Family.created_at.desc(),
            Family.id.desc(),
        )
        .limit(limit + 1)
    )
    if family_type:
        stmt = stmt.where(Family.family_type == family_type)
    if cursor:
        stmt = stmt.where(_desc_availability_datetime_uuid_condition(cursor))
    items = list(db.scalars(stmt).all())
    return _trim_page(
        items,
        limit,
        lambda family: encode_cursor(
            {
                "has_availability": family.availability_confirmed_at is not None,
                "availability_confirmed_at": (
                    family.availability_confirmed_at or family.created_at
                ),
                "created_at": family.created_at,
                "id": family.id,
            }
        ),
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
        joined_at = payload.get("joined_at")
        member_id = payload.get("id")
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
        stmt = stmt.where(_desc_due_created_uuid_condition(FamilyPayment, cursor))
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
        .where(FamilyMember.status.in_(ACTIVE_MEMBER_STATUSES))
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
        .where(FamilyMember.status.in_(ACTIVE_MEMBER_STATUSES))
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
            .where(FamilyMember.status.in_(ACTIVE_MEMBER_STATUSES))
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
        .where(FamilyMember.status.in_(ACTIVE_MEMBER_STATUSES))
        .order_by(FamilyMember.joined_at.asc(), FamilyMember.id.asc())
        .limit(limit + 1)
    )
    if cursor:
        payload = decode_cursor(cursor)
        joined_at = payload.get("joined_at")
        member_id = payload.get("id")
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
