from __future__ import annotations

from datetime import timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from subsmarket.core.config import settings
from subsmarket.core.database import utcnow
from subsmarket.core.idempotency import claim_idempotency, complete_idempotency
from subsmarket.identity.models import User
from subsmarket.marketplace.account_models import (
    MarketplaceAccountListing,
    MarketplaceAccountRequest,
)
from subsmarket.marketplace.account_queries import to_account_request_out
from subsmarket.marketplace.account_schemas import AccountRequestOut
from subsmarket.marketplace.time import as_utc
from subsmarket.notifications.service import enqueue_notification


def create_account_request(
    db: Session,
    user: User,
    listing_id: UUID,
    *,
    idempotency_key: str | None = None,
) -> AccountRequestOut:
    _require_username(user)
    claim = claim_idempotency(
        db, user_id=user.id, operation="account_request.create",
        idempotency_key=idempotency_key, payload={"listing_id": str(listing_id)},
        resource_type="account_request",
    )
    if claim.is_replay:
        return to_account_request_out(_get_request(db, claim.resource_id), user)
    listing = db.scalar(
        select(MarketplaceAccountListing)
        .options(
            selectinload(MarketplaceAccountListing.service),
            selectinload(MarketplaceAccountListing.seller),
        )
        .where(MarketplaceAccountListing.id == listing_id)
        .with_for_update()
    )
    if listing is None or listing.status == "archived":
        raise HTTPException(status_code=404, detail="ACCOUNT_LISTING_NOT_FOUND")
    if listing.seller_user_id == user.id:
        raise HTTPException(status_code=409, detail="ACCOUNT_SELF_REQUEST_FORBIDDEN")
    if (
        listing.status != "active"
        or as_utc(listing.expires_at) <= utcnow()
        or not listing.service.is_active
    ):
        raise HTTPException(status_code=409, detail="ACCOUNT_LISTING_UNAVAILABLE")
    existing = db.scalar(
        select(MarketplaceAccountRequest.id)
        .where(MarketplaceAccountRequest.listing_id == listing.id)
        .where(MarketplaceAccountRequest.buyer_user_id == user.id)
        .where(MarketplaceAccountRequest.status.in_({"pending", "accepted"}))
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="ACCOUNT_ACTIVE_REQUEST_EXISTS")
    request = MarketplaceAccountRequest(
        listing_id=listing.id,
        buyer_user_id=user.id,
        status="pending",
        service_slug_snapshot=listing.service.slug,
        service_name_snapshot=listing.service.name,
        title_snapshot=listing.title,
        price_kzt_snapshot=listing.price_kzt,
    )
    request.listing = listing
    request.buyer = user
    try:
        with db.begin_nested():
            db.add(request)
            db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=409, detail="ACCOUNT_ACTIVE_REQUEST_EXISTS"
        ) from exc
    enqueue_notification(
        db, recipient_user_id=listing.seller_user_id,
        event_type="account_request_created",
        payload={
            "listing_id": str(listing.id), "request_id": str(request.id),
            "message": f"Новая заявка на покупку {listing.title}.",
        },
    )
    complete_idempotency(
        claim, resource_type="account_request", resource_id=request.id
    )
    db.flush()
    return to_account_request_out(request, user)


def accept_account_request(
    db: Session, user: User, request_id: UUID, *, idempotency_key: str | None = None
) -> AccountRequestOut:
    return _decide_request(
        db, user, request_id, target_status="accepted", reason=None,
        idempotency_key=idempotency_key,
    )


def reject_account_request(
    db: Session, user: User, request_id: UUID, *, reason: str | None,
    idempotency_key: str | None = None,
) -> AccountRequestOut:
    return _decide_request(
        db, user, request_id, target_status="rejected",
        reason=_normalize_reason(reason), idempotency_key=idempotency_key,
    )


def cancel_account_request(
    db: Session, user: User, request_id: UUID, *, reason: str | None,
    idempotency_key: str | None = None,
) -> AccountRequestOut:
    claim = _claim_request_action(
        db, user, "cancel", request_id, idempotency_key, reason=reason
    )
    if claim.is_replay:
        return to_account_request_out(_get_request(db, claim.resource_id), user)
    _listing, request = _get_listing_and_request_for_update(db, request_id)
    if request.buyer_user_id != user.id:
        raise HTTPException(status_code=403, detail="ACCOUNT_REQUEST_BUYER_REQUIRED")
    if request.status not in {"pending", "accepted"}:
        raise HTTPException(status_code=409, detail="ACCOUNT_REQUEST_STATUS_CONFLICT")
    was_accepted = request.status == "accepted"
    request.status = "cancelled"
    request.reason = _normalize_reason(reason)
    request.cancelled_at = utcnow()
    enqueue_notification(
        db, recipient_user_id=request.listing.seller_user_id,
        event_type="account_request_cancelled",
        payload={
            "listing_id": str(request.listing_id), "request_id": str(request.id),
            "message": (
                "Покупатель отменил принятую заявку на аккаунт."
                if was_accepted else "Покупатель отменил заявку на аккаунт."
            ),
        },
    )
    complete_idempotency(claim, resource_type="account_request", resource_id=request.id)
    db.flush()
    return to_account_request_out(request, user)


def close_account_request(
    db: Session, user: User, request_id: UUID, *, outcome: str, reason: str | None,
    idempotency_key: str | None = None,
) -> AccountRequestOut:
    claim = _claim_request_action(
        db, user, "close", request_id, idempotency_key,
        outcome=outcome, reason=reason,
    )
    if claim.is_replay:
        return to_account_request_out(_get_request(db, claim.resource_id), user)
    listing, request = _get_listing_and_request_for_update(db, request_id)
    if listing.seller_user_id != user.id:
        raise HTTPException(status_code=403, detail="ACCOUNT_REQUEST_SELLER_REQUIRED")
    if request.status != "accepted":
        raise HTTPException(status_code=409, detail="ACCOUNT_REQUEST_STATUS_CONFLICT")
    if outcome not in {"sold", "not_sold"}:
        raise HTTPException(status_code=422, detail="ACCOUNT_OUTCOME_REQUIRED")
    request.status = "closed"
    request.outcome = outcome
    request.reason = _normalize_reason(reason)
    request.closed_at = utcnow()
    enqueue_notification(
        db, recipient_user_id=request.buyer_user_id,
        event_type="account_request_closed",
        payload={
            "listing_id": str(request.listing_id), "request_id": str(request.id),
            "outcome": outcome, "message": "Заявка на аккаунт убрана из активных.",
        },
    )
    complete_idempotency(claim, resource_type="account_request", resource_id=request.id)
    db.flush()
    return to_account_request_out(request, user)


def remind_account_request(
    db: Session, user: User, request_id: UUID, *, idempotency_key: str | None = None
) -> AccountRequestOut:
    claim = _claim_request_action(db, user, "remind", request_id, idempotency_key)
    if claim.is_replay:
        return to_account_request_out(_get_request(db, claim.resource_id), user)
    _listing, request = _get_listing_and_request_for_update(db, request_id)
    if request.buyer_user_id != user.id:
        raise HTTPException(status_code=403, detail="ACCOUNT_REQUEST_BUYER_REQUIRED")
    if request.status != "pending":
        raise HTTPException(status_code=409, detail="ACCOUNT_REQUEST_STATUS_CONFLICT")
    now = utcnow()
    available_at = as_utc(request.created_at) + timedelta(
        seconds=settings.marketplace_request_reminder_delay_seconds
    )
    if now < available_at:
        raise HTTPException(status_code=409, detail="ACCOUNT_REMINDER_TOO_EARLY")
    if request.last_reminded_at is not None:
        next_at = as_utc(request.last_reminded_at) + timedelta(
            seconds=settings.marketplace_request_reminder_cooldown_seconds
        )
        if now < next_at:
            raise HTTPException(status_code=409, detail="ACCOUNT_REMINDER_COOLDOWN")
    request.last_reminded_at = now
    request.reminder_count += 1
    enqueue_notification(
        db, recipient_user_id=request.listing.seller_user_id,
        event_type="account_request_reminder",
        payload={
            "listing_id": str(request.listing_id), "request_id": str(request.id),
            "reminder_count": request.reminder_count,
            "message": "Покупатель напоминает о заявке на аккаунт.",
        },
    )
    complete_idempotency(claim, resource_type="account_request", resource_id=request.id)
    db.flush()
    return to_account_request_out(request, user)


def _decide_request(
    db: Session, user: User, request_id: UUID, *, target_status: str,
    reason: str | None, idempotency_key: str | None,
) -> AccountRequestOut:
    claim = _claim_request_action(
        db, user, target_status, request_id, idempotency_key, reason=reason
    )
    if claim.is_replay:
        return to_account_request_out(_get_request(db, claim.resource_id), user)
    listing, request = _get_listing_and_request_for_update(db, request_id)
    if listing.seller_user_id != user.id:
        raise HTTPException(status_code=403, detail="ACCOUNT_REQUEST_SELLER_REQUIRED")
    if request.status != "pending":
        raise HTTPException(status_code=409, detail="ACCOUNT_REQUEST_STATUS_CONFLICT")
    if target_status == "accepted" and (
        listing.status not in {"active", "paused"}
        or as_utc(listing.expires_at) <= utcnow()
    ):
        raise HTTPException(status_code=409, detail="ACCOUNT_LISTING_UNAVAILABLE")
    request.status = target_status
    request.reason = reason
    request.decided_at = utcnow()
    enqueue_notification(
        db, recipient_user_id=request.buyer_user_id,
        event_type=f"account_request_{target_status}",
        payload={
            "listing_id": str(request.listing_id), "request_id": str(request.id),
            "message": (
                "Продавец принял вашу заявку. Ожидайте сообщение в Telegram."
                if target_status == "accepted"
                else "Продавец отклонил вашу заявку на аккаунт."
            ),
        },
    )
    complete_idempotency(claim, resource_type="account_request", resource_id=request.id)
    db.flush()
    return to_account_request_out(request, user)


def _claim_request_action(
    db: Session, user: User, action: str, request_id: UUID,
    idempotency_key: str | None, **payload,
):
    return claim_idempotency(
        db, user_id=user.id, operation=f"account_request.{action}",
        idempotency_key=idempotency_key,
        payload={"request_id": str(request_id), **payload},
        resource_type="account_request",
    )


def _get_request(db: Session, request_id: UUID | None) -> MarketplaceAccountRequest:
    if request_id is None:
        raise RuntimeError("Account request id is missing")
    request = db.scalar(
        select(MarketplaceAccountRequest)
        .options(
            joinedload(MarketplaceAccountRequest.listing).joinedload(
                MarketplaceAccountListing.seller
            ),
            joinedload(MarketplaceAccountRequest.buyer),
        )
        .where(MarketplaceAccountRequest.id == request_id)
    )
    if request is None:
        raise HTTPException(status_code=404, detail="ACCOUNT_REQUEST_NOT_FOUND")
    return request


def _get_listing_and_request_for_update(
    db: Session, request_id: UUID
) -> tuple[MarketplaceAccountListing, MarketplaceAccountRequest]:
    reference = db.get(MarketplaceAccountRequest, request_id)
    if reference is None:
        raise HTTPException(status_code=404, detail="ACCOUNT_REQUEST_NOT_FOUND")
    listing = db.scalar(
        select(MarketplaceAccountListing)
        .where(MarketplaceAccountListing.id == reference.listing_id)
        .with_for_update()
    )
    request = db.scalar(
        select(MarketplaceAccountRequest)
        .where(MarketplaceAccountRequest.id == request_id)
        .with_for_update()
    )
    if listing is None or request is None:
        raise HTTPException(status_code=404, detail="ACCOUNT_REQUEST_NOT_FOUND")
    listing.seller = db.get(User, listing.seller_user_id)
    request.buyer = db.get(User, request.buyer_user_id)
    request.listing = listing
    return listing, request


def _normalize_reason(value: str | None) -> str | None:
    if value is None:
        return None
    return value.strip() or None


def _require_username(user: User) -> None:
    if not user.username:
        raise HTTPException(status_code=409, detail="TELEGRAM_USERNAME_REQUIRED")


__all__ = [
    "accept_account_request",
    "cancel_account_request",
    "close_account_request",
    "create_account_request",
    "reject_account_request",
    "remind_account_request",
]
