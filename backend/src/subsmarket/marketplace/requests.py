from __future__ import annotations

from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from subsmarket.core.config import settings
from subsmarket.core.database import utcnow
from subsmarket.core.idempotency import claim_idempotency, complete_idempotency
from subsmarket.identity.models import User
from subsmarket.marketplace.models import MarketplaceListing, MarketplaceListingRequest
from subsmarket.marketplace.queries import to_request_out
from subsmarket.marketplace.rules import MINIMUM_GB_ORDER, is_whole_gb
from subsmarket.marketplace.schemas import (
    MarketplaceListingRequestOut,
    MarketplaceRequestCreate,
)
from subsmarket.marketplace.time import as_utc
from subsmarket.notifications.service import enqueue_notification


def create_marketplace_request(
    db: Session,
    user: User,
    listing_id: UUID,
    data: MarketplaceRequestCreate,
    *,
    idempotency_key: str | None = None,
) -> MarketplaceListingRequestOut:
    _require_username(user)
    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation="marketplace_request.create",
        idempotency_key=idempotency_key,
        payload={
            "listing_id": str(listing_id),
            "amount_gb": str(data.amount_gb),
        },
        resource_type="marketplace_request",
    )
    if claim.is_replay:
        return to_request_out(_get_request(db, claim.resource_id), user)

    listing = db.scalar(
        select(MarketplaceListing)
        .options(
            selectinload(MarketplaceListing.operator),
            selectinload(MarketplaceListing.seller),
        )
        .where(MarketplaceListing.id == listing_id)
        .with_for_update()
    )
    if listing is None or listing.status == "archived":
        raise HTTPException(status_code=404, detail="MARKETPLACE_LISTING_NOT_FOUND")
    if listing.seller_user_id == user.id:
        raise HTTPException(
            status_code=409, detail="MARKETPLACE_SELF_REQUEST_FORBIDDEN"
        )
    now = utcnow()
    if (
        listing.status != "active"
        or as_utc(listing.expires_at) <= now
    ):
        raise HTTPException(status_code=409, detail="MARKETPLACE_LISTING_UNAVAILABLE")
    if not listing.operator.is_active:
        raise HTTPException(status_code=409, detail="MARKETPLACE_OPERATOR_UNAVAILABLE")

    amount = _validate_requested_amount(listing, data.amount_gb)

    existing = db.scalar(
        select(MarketplaceListingRequest.id)
        .where(MarketplaceListingRequest.listing_id == listing.id)
        .where(MarketplaceListingRequest.buyer_user_id == user.id)
        .where(MarketplaceListingRequest.status.in_({"pending", "accepted"}))
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="MARKETPLACE_ACTIVE_REQUEST_EXISTS")

    request = MarketplaceListingRequest(
        listing_id=listing.id,
        buyer_user_id=user.id,
        status="pending",
        operator_slug_snapshot=listing.operator.slug,
        operator_name_snapshot=listing.operator.name,
        amount_gb_snapshot=amount,
        price_per_gb_kzt_snapshot=listing.price_per_gb_kzt,
        total_price_kzt_snapshot=_calculate_total_price(
            amount,
            listing.price_per_gb_kzt,
        ),
    )
    request.listing = listing
    request.buyer = user
    try:
        with db.begin_nested():
            db.add(request)
            db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=409, detail="MARKETPLACE_ACTIVE_REQUEST_EXISTS"
        ) from exc

    enqueue_notification(
        db,
        recipient_user_id=listing.seller_user_id,
        event_type="marketplace_request_created",
        payload={
            "listing_id": str(listing.id),
            "request_id": str(request.id),
            "message": (
                f"Новая заявка на {request.amount_gb_snapshot:g} ГБ "
                f"{request.operator_name_snapshot}."
            ),
        },
    )
    complete_idempotency(
        claim,
        resource_type="marketplace_request",
        resource_id=request.id,
    )
    db.flush()
    return to_request_out(request, user)


def accept_marketplace_request(
    db: Session,
    user: User,
    request_id: UUID,
    *,
    idempotency_key: str | None = None,
) -> MarketplaceListingRequestOut:
    return _decide_request(
        db,
        user,
        request_id,
        target_status="accepted",
        reason=None,
        idempotency_key=idempotency_key,
    )


def reject_marketplace_request(
    db: Session,
    user: User,
    request_id: UUID,
    *,
    reason: str | None,
    idempotency_key: str | None = None,
) -> MarketplaceListingRequestOut:
    return _decide_request(
        db,
        user,
        request_id,
        target_status="rejected",
        reason=_normalize_reason(reason),
        idempotency_key=idempotency_key,
    )


def cancel_marketplace_request(
    db: Session,
    user: User,
    request_id: UUID,
    *,
    reason: str | None,
    idempotency_key: str | None = None,
) -> MarketplaceListingRequestOut:
    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation="marketplace_request.cancel",
        idempotency_key=idempotency_key,
        payload={"request_id": str(request_id), "reason": reason},
        resource_type="marketplace_request",
    )
    if claim.is_replay:
        return to_request_out(_get_request(db, claim.resource_id), user)

    request = _get_request_for_update(db, request_id)
    if request.buyer_user_id != user.id:
        raise HTTPException(
            status_code=403, detail="MARKETPLACE_REQUEST_BUYER_REQUIRED"
        )
    if request.status != "pending":
        raise HTTPException(
            status_code=409, detail="MARKETPLACE_REQUEST_STATUS_CONFLICT"
        )
    request.status = "cancelled"
    request.reason = _normalize_reason(reason)
    request.cancelled_at = utcnow()
    enqueue_notification(
        db,
        recipient_user_id=request.listing.seller_user_id,
        event_type="marketplace_request_cancelled",
        payload={
            "listing_id": str(request.listing_id),
            "request_id": str(request.id),
            "message": "Покупатель отменил заявку на гигабайты.",
        },
    )
    complete_idempotency(
        claim,
        resource_type="marketplace_request",
        resource_id=request.id,
    )
    db.flush()
    return to_request_out(request, user)


def close_marketplace_request(
    db: Session,
    user: User,
    request_id: UUID,
    *,
    outcome: str,
    reason: str | None,
    idempotency_key: str | None = None,
) -> MarketplaceListingRequestOut:
    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation="marketplace_request.close",
        idempotency_key=idempotency_key,
        payload={
            "request_id": str(request_id),
            "outcome": outcome,
            "reason": reason,
        },
        resource_type="marketplace_request",
    )
    if claim.is_replay:
        return to_request_out(_get_request(db, claim.resource_id), user)

    listing, request = _get_listing_and_request_for_update(db, request_id)
    if listing.seller_user_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="MARKETPLACE_REQUEST_SELLER_REQUIRED",
        )
    if request.status != "accepted":
        raise HTTPException(
            status_code=409, detail="MARKETPLACE_REQUEST_STATUS_CONFLICT"
        )
    if outcome not in {"sold", "not_sold"}:
        raise HTTPException(status_code=422, detail="MARKETPLACE_OUTCOME_REQUIRED")
    request.status = "closed"
    request.outcome = outcome
    request.reason = _normalize_reason(reason)
    request.closed_at = utcnow()
    enqueue_notification(
        db,
        recipient_user_id=request.buyer_user_id,
        event_type="marketplace_request_closed",
        payload={
            "listing_id": str(request.listing_id),
            "request_id": str(request.id),
            "outcome": outcome,
            "message": "Заявка на гигабайты убрана из активных.",
        },
    )
    complete_idempotency(
        claim,
        resource_type="marketplace_request",
        resource_id=request.id,
    )
    db.flush()
    return to_request_out(request, user)


def remind_marketplace_request(
    db: Session,
    user: User,
    request_id: UUID,
    *,
    idempotency_key: str | None = None,
) -> MarketplaceListingRequestOut:
    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation="marketplace_request.remind",
        idempotency_key=idempotency_key,
        payload={"request_id": str(request_id)},
        resource_type="marketplace_request",
    )
    if claim.is_replay:
        return to_request_out(_get_request(db, claim.resource_id), user)

    request = _get_request_for_update(db, request_id)
    if request.buyer_user_id != user.id:
        raise HTTPException(
            status_code=403, detail="MARKETPLACE_REQUEST_BUYER_REQUIRED"
        )
    if request.status != "pending":
        raise HTTPException(
            status_code=409, detail="MARKETPLACE_REQUEST_STATUS_CONFLICT"
        )
    now = utcnow()
    available_at = as_utc(request.created_at) + timedelta(
        seconds=settings.marketplace_request_reminder_delay_seconds
    )
    if now < available_at:
        raise HTTPException(status_code=409, detail="MARKETPLACE_REMINDER_TOO_EARLY")
    if request.last_reminded_at is not None:
        next_at = as_utc(request.last_reminded_at) + timedelta(
            seconds=settings.marketplace_request_reminder_cooldown_seconds
        )
        if now < next_at:
            raise HTTPException(status_code=409, detail="MARKETPLACE_REMINDER_COOLDOWN")

    request.last_reminded_at = now
    request.reminder_count += 1
    enqueue_notification(
        db,
        recipient_user_id=request.listing.seller_user_id,
        event_type="marketplace_request_reminder",
        payload={
            "listing_id": str(request.listing_id),
            "request_id": str(request.id),
            "reminder_count": request.reminder_count,
            "message": "Покупатель напоминает о заявке на гигабайты.",
        },
    )
    complete_idempotency(
        claim,
        resource_type="marketplace_request",
        resource_id=request.id,
    )
    db.flush()
    return to_request_out(request, user)


def _decide_request(
    db: Session,
    user: User,
    request_id: UUID,
    *,
    target_status: str,
    reason: str | None,
    idempotency_key: str | None,
) -> MarketplaceListingRequestOut:
    operation = f"marketplace_request.{target_status}"
    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation=operation,
        idempotency_key=idempotency_key,
        payload={"request_id": str(request_id), "reason": reason},
        resource_type="marketplace_request",
    )
    if claim.is_replay:
        return to_request_out(_get_request(db, claim.resource_id), user)

    listing, request = _get_listing_and_request_for_update(db, request_id)
    if listing.seller_user_id != user.id:
        raise HTTPException(
            status_code=403, detail="MARKETPLACE_REQUEST_SELLER_REQUIRED"
        )
    if request.status != "pending":
        raise HTTPException(
            status_code=409, detail="MARKETPLACE_REQUEST_STATUS_CONFLICT"
        )
    now = utcnow()
    if target_status == "accepted" and (
        listing.status != "active"
        or as_utc(listing.expires_at) <= now
    ):
        raise HTTPException(status_code=409, detail="MARKETPLACE_LISTING_UNAVAILABLE")

    request.status = target_status
    request.reason = reason
    request.decided_at = utcnow()
    message = (
        "Продавец принял вашу заявку. Ожидайте сообщение в Telegram."
        if target_status == "accepted"
        else "Продавец отклонил вашу заявку на гигабайты."
    )
    enqueue_notification(
        db,
        recipient_user_id=request.buyer_user_id,
        event_type=f"marketplace_request_{target_status}",
        payload={
            "listing_id": str(request.listing_id),
            "request_id": str(request.id),
            "message": message,
        },
    )
    complete_idempotency(
        claim,
        resource_type="marketplace_request",
        resource_id=request.id,
    )
    db.flush()
    return to_request_out(request, user)


def _get_request(
    db: Session,
    request_id: UUID | None,
) -> MarketplaceListingRequest:
    if request_id is None:
        raise RuntimeError("Marketplace request id is missing")
    request = db.scalar(
        select(MarketplaceListingRequest)
        .options(
            joinedload(MarketplaceListingRequest.listing).joinedload(
                MarketplaceListing.seller
            ),
            joinedload(MarketplaceListingRequest.buyer),
        )
        .where(MarketplaceListingRequest.id == request_id)
    )
    if request is None:
        raise HTTPException(status_code=404, detail="MARKETPLACE_REQUEST_NOT_FOUND")
    return request


def _get_request_for_update(db: Session, request_id: UUID) -> MarketplaceListingRequest:
    request = db.scalar(
        select(MarketplaceListingRequest)
        .where(MarketplaceListingRequest.id == request_id)
        .with_for_update()
    )
    if request is None:
        raise HTTPException(status_code=404, detail="MARKETPLACE_REQUEST_NOT_FOUND")
    request.listing = db.scalar(
        select(MarketplaceListing)
        .options(joinedload(MarketplaceListing.seller))
        .where(MarketplaceListing.id == request.listing_id)
    )
    request.buyer = db.get(User, request.buyer_user_id)
    if request.listing is None or request.buyer is None:
        raise RuntimeError("Marketplace request relations are missing")
    return request


def _get_listing_and_request_for_update(
    db: Session,
    request_id: UUID,
) -> tuple[MarketplaceListing, MarketplaceListingRequest]:
    listing_id = db.scalar(
        select(MarketplaceListingRequest.listing_id).where(
            MarketplaceListingRequest.id == request_id
        )
    )
    if listing_id is None:
        raise HTTPException(status_code=404, detail="MARKETPLACE_REQUEST_NOT_FOUND")
    listing = db.scalar(
        select(MarketplaceListing)
        .where(MarketplaceListing.id == listing_id)
        .with_for_update()
    )
    request = db.scalar(
        select(MarketplaceListingRequest)
        .where(MarketplaceListingRequest.id == request_id)
        .with_for_update()
    )
    if listing is None or request is None:
        raise HTTPException(status_code=404, detail="MARKETPLACE_REQUEST_NOT_FOUND")
    listing.seller = db.get(User, listing.seller_user_id)
    request.listing = listing
    request.buyer = db.get(User, request.buyer_user_id)
    if listing.seller is None or request.buyer is None:
        raise RuntimeError("Marketplace request users are missing")
    return listing, request


def _validate_requested_amount(
    listing: MarketplaceListing,
    amount: Decimal,
) -> Decimal:
    normalized = amount.quantize(Decimal("0.01"))
    operator = listing.operator
    if normalized < MINIMUM_GB_ORDER:
        raise HTTPException(status_code=422, detail="MARKETPLACE_AMOUNT_BELOW_MINIMUM")
    if not is_whole_gb(normalized):
        raise HTTPException(status_code=422, detail="MARKETPLACE_AMOUNT_INVALID_STEP")
    if operator.min_lot_gb is not None and normalized < operator.min_lot_gb:
        raise HTTPException(status_code=422, detail="MARKETPLACE_AMOUNT_BELOW_MINIMUM")
    if operator.max_lot_gb is not None and normalized > operator.max_lot_gb:
        raise HTTPException(status_code=422, detail="MARKETPLACE_AMOUNT_ABOVE_MAXIMUM")
    if (
        operator.amount_step_gb is not None
        and normalized % operator.amount_step_gb != 0
    ):
        raise HTTPException(status_code=422, detail="MARKETPLACE_AMOUNT_INVALID_STEP")
    return normalized


def _calculate_total_price(amount: Decimal, price_per_gb_kzt: int) -> int:
    total = (amount * price_per_gb_kzt).quantize(
        Decimal("1"),
        rounding=ROUND_HALF_UP,
    )
    return max(1, int(total))


def _normalize_reason(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _require_username(user: User) -> None:
    if not user.username:
        raise HTTPException(status_code=409, detail="TELEGRAM_USERNAME_REQUIRED")


__all__ = [
    "accept_marketplace_request",
    "cancel_marketplace_request",
    "close_marketplace_request",
    "create_marketplace_request",
    "reject_marketplace_request",
    "remind_marketplace_request",
]
