from __future__ import annotations

from datetime import timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from subsmarket.core.database import utcnow
from subsmarket.core.idempotency import claim_idempotency, complete_idempotency
from subsmarket.families._internal import (
    ACTIVE_MEMBER_STATUSES,
    ACTIVE_REQUEST_STATUS,
    _active_request_count_for_service,
    record_owner_request_cancelled_by_candidate,
    record_owner_request_decision,
    record_owner_request_received,
)
from subsmarket.families.audit import record_family_audit_event
from subsmarket.families.models import (
    Family,
    FamilyMember,
    FamilyRequest,
    FamilyRequestRestriction,
)
from subsmarket.identity.models import User
from subsmarket.notifications.service import enqueue_notification


def _get_joinable_family(db: Session, family_id: UUID) -> Family:
    family = db.scalar(
        select(Family).where(Family.id == family_id).with_for_update()
    )
    if family is None:
        raise HTTPException(status_code=404, detail="FAMILY_NOT_FOUND")
    if family.status != "active" or family.active_members_count >= family.max_members:
        raise HTTPException(status_code=409, detail="FAMILY_NOT_JOINABLE")
    return family


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
    record_owner_request_received(
        db,
        owner_user_id=family.owner_user_id,
        received_at=request.created_at,
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
    db.flush()
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
        if reason == "user_cancelled":
            record_owner_request_cancelled_by_candidate(
                db,
                owner_user_id=family.owner_user_id,
            )
    db.flush()
    db.refresh(request)
    return request


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
    record_owner_request_decision(
        db,
        owner_user_id=family.owner_user_id,
        request=request,
        decision="rejected",
    )
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
    db.flush()
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
    record_owner_request_decision(
        db,
        owner_user_id=family.owner_user_id,
        request=request,
        decision="approved",
    )
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
    db.flush()
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
        .with_for_update()
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
