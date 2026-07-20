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
from subsmarket.marketplace.models import (
    MarketplaceListing,
    MarketplaceListingRequest,
    MarketplaceOperator,
)
from subsmarket.marketplace.queries import to_listing_out
from subsmarket.marketplace.schemas import (
    MarketplaceListingCreate,
    MarketplaceListingOut,
    MarketplaceListingUpdate,
)
from subsmarket.marketplace.time import as_utc
from subsmarket.notifications.service import enqueue_notification


def create_marketplace_listing(
    db: Session,
    user: User,
    data: MarketplaceListingCreate,
    *,
    idempotency_key: str | None = None,
) -> MarketplaceListingOut:
    _require_username(user)
    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation="marketplace_listing.create",
        idempotency_key=idempotency_key,
        payload=data.model_dump(mode="json"),
        resource_type="marketplace_listing",
    )
    if claim.is_replay:
        replayed = _get_listing(db, claim.resource_id)
        return to_listing_out(replayed, user.id)

    operator = _get_active_operator(db, data.operator_slug)
    _ensure_no_managed_listing(db, user.id, operator.id)
    now = utcnow()
    listing = MarketplaceListing(
        seller_user_id=user.id,
        listing_type="mobile_data",
        operator_id=operator.id,
        price_per_gb_kzt=data.price_per_gb_kzt,
        description=_normalize_description(data.description),
        status="active",
        expires_at=now + timedelta(days=settings.marketplace_listing_days),
        published_at=now,
    )
    listing.operator = operator
    try:
        with db.begin_nested():
            db.add(listing)
            db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=409, detail="MARKETPLACE_OPERATOR_LISTING_EXISTS"
        ) from exc
    complete_idempotency(
        claim,
        resource_type="marketplace_listing",
        resource_id=listing.id,
    )
    return to_listing_out(listing, user.id)


def update_marketplace_listing(
    db: Session,
    user: User,
    listing_id: UUID,
    data: MarketplaceListingUpdate,
    *,
    idempotency_key: str | None = None,
) -> MarketplaceListingOut:
    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation="marketplace_listing.update",
        idempotency_key=idempotency_key,
        payload={
            "listing_id": str(listing_id),
            **data.model_dump(mode="json", exclude_unset=True),
        },
        resource_type="marketplace_listing",
    )
    if claim.is_replay:
        return to_listing_out(_get_listing(db, claim.resource_id), user.id)

    listing = _get_owned_listing_for_update(db, user.id, listing_id)
    if listing.status not in {"active", "paused", "expired"}:
        raise HTTPException(status_code=409, detail="MARKETPLACE_LISTING_NOT_EDITABLE")

    if "operator_slug" in data.model_fields_set:
        if data.operator_slug is None:
            raise HTTPException(status_code=422, detail="MARKETPLACE_OPERATOR_REQUIRED")
        operator = _get_active_operator(db, data.operator_slug)
        if operator.id != listing.operator_id:
            raise HTTPException(
                status_code=409,
                detail="MARKETPLACE_LISTING_OPERATOR_IMMUTABLE",
            )
    else:
        operator = listing.operator

    if "price_per_gb_kzt" in data.model_fields_set:
        if data.price_per_gb_kzt is None:
            raise HTTPException(status_code=422, detail="MARKETPLACE_PRICE_REQUIRED")
    try:
        with db.begin_nested():
            listing.operator_id = operator.id
            listing.operator = operator
            if "price_per_gb_kzt" in data.model_fields_set:
                listing.price_per_gb_kzt = data.price_per_gb_kzt
            if "description" in data.model_fields_set:
                listing.description = _normalize_description(data.description)
            now = utcnow()
            listing.updated_at = now
            db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=409, detail="MARKETPLACE_OPERATOR_LISTING_EXISTS"
        ) from exc
    complete_idempotency(
        claim,
        resource_type="marketplace_listing",
        resource_id=listing.id,
    )
    return to_listing_out(listing, user.id)


def pause_marketplace_listing(
    db: Session,
    user: User,
    listing_id: UUID,
    *,
    idempotency_key: str | None = None,
) -> MarketplaceListingOut:
    return _set_listing_status(
        db,
        user,
        listing_id,
        operation="marketplace_listing.pause",
        allowed={"active"},
        target="paused",
        idempotency_key=idempotency_key,
    )


def resume_marketplace_listing(
    db: Session,
    user: User,
    listing_id: UUID,
    *,
    idempotency_key: str | None = None,
) -> MarketplaceListingOut:
    return _set_listing_status(
        db,
        user,
        listing_id,
        operation="marketplace_listing.resume",
        allowed={"paused"},
        target="active",
        idempotency_key=idempotency_key,
        require_unexpired=True,
    )


def renew_marketplace_listing(
    db: Session,
    user: User,
    listing_id: UUID,
    *,
    idempotency_key: str | None = None,
) -> MarketplaceListingOut:
    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation="marketplace_listing.renew",
        idempotency_key=idempotency_key,
        payload={"listing_id": str(listing_id)},
        resource_type="marketplace_listing",
    )
    if claim.is_replay:
        return to_listing_out(_get_listing(db, claim.resource_id), user.id)

    listing = _get_owned_listing_for_update(db, user.id, listing_id)
    if listing.status == "archived":
        raise HTTPException(status_code=409, detail="MARKETPLACE_LISTING_ARCHIVED")
    now = utcnow()
    if not listing.operator.is_active:
        raise HTTPException(status_code=409, detail="MARKETPLACE_OPERATOR_UNAVAILABLE")
    renew_available_at = as_utc(listing.expires_at) - timedelta(
        days=settings.marketplace_listing_expiry_reminder_days
    )
    if listing.status != "expired" and now < renew_available_at:
        raise HTTPException(
            status_code=409,
            detail="MARKETPLACE_LISTING_RENEW_TOO_EARLY",
        )
    listing.expires_at = now + timedelta(days=settings.marketplace_listing_days)
    listing.published_at = now
    listing.expiry_reminder_sent_at = None
    if listing.status == "expired":
        listing.status = "active"
    listing.updated_at = now
    complete_idempotency(
        claim,
        resource_type="marketplace_listing",
        resource_id=listing.id,
    )
    db.flush()
    return to_listing_out(listing, user.id)


def archive_marketplace_listing(
    db: Session,
    user: User,
    listing_id: UUID,
    *,
    idempotency_key: str | None = None,
) -> MarketplaceListingOut:
    result = _set_listing_status(
        db,
        user,
        listing_id,
        operation="marketplace_listing.archive",
        allowed={"active", "paused", "expired"},
        target="archived",
        idempotency_key=idempotency_key,
    )
    _expire_pending_requests(db, listing_id, message="Объявление больше неактуально.")
    db.flush()
    return result


def _set_listing_status(
    db: Session,
    user: User,
    listing_id: UUID,
    *,
    operation: str,
    allowed: set[str],
    target: str,
    idempotency_key: str | None,
    require_unexpired: bool = False,
) -> MarketplaceListingOut:
    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation=operation,
        idempotency_key=idempotency_key,
        payload={"listing_id": str(listing_id)},
        resource_type="marketplace_listing",
    )
    if claim.is_replay:
        return to_listing_out(_get_listing(db, claim.resource_id), user.id)

    listing = _get_owned_listing_for_update(db, user.id, listing_id)
    if target == "active" and not listing.operator.is_active:
        raise HTTPException(status_code=409, detail="MARKETPLACE_OPERATOR_UNAVAILABLE")
    if require_unexpired and as_utc(listing.expires_at) <= utcnow():
        listing.status = "expired"
        db.flush()
        raise HTTPException(
            status_code=409, detail="MARKETPLACE_LISTING_RENEW_REQUIRED"
        )
    if listing.status == target:
        complete_idempotency(
            claim,
            resource_type="marketplace_listing",
            resource_id=listing.id,
        )
        return to_listing_out(listing, user.id)
    if listing.status not in allowed:
        raise HTTPException(
            status_code=409, detail="MARKETPLACE_LISTING_STATUS_CONFLICT"
        )
    listing.status = target
    now = utcnow()
    listing.updated_at = now
    complete_idempotency(
        claim,
        resource_type="marketplace_listing",
        resource_id=listing.id,
    )
    db.flush()
    return to_listing_out(listing, user.id)


def _get_listing(db: Session, listing_id: UUID | None) -> MarketplaceListing:
    if listing_id is None:
        raise RuntimeError("Marketplace listing id is missing")
    listing = db.scalar(
        select(MarketplaceListing)
        .options(joinedload(MarketplaceListing.operator))
        .where(MarketplaceListing.id == listing_id)
    )
    if listing is None:
        raise HTTPException(status_code=404, detail="MARKETPLACE_LISTING_NOT_FOUND")
    return listing


def _get_owned_listing_for_update(
    db: Session,
    user_id: UUID,
    listing_id: UUID,
) -> MarketplaceListing:
    listing = db.scalar(
        select(MarketplaceListing)
        .options(selectinload(MarketplaceListing.operator))
        .where(MarketplaceListing.id == listing_id)
        .with_for_update()
    )
    if listing is None:
        raise HTTPException(status_code=404, detail="MARKETPLACE_LISTING_NOT_FOUND")
    if listing.seller_user_id != user_id:
        raise HTTPException(
            status_code=403, detail="MARKETPLACE_LISTING_OWNER_REQUIRED"
        )
    return listing


def _get_active_operator(db: Session, slug: str) -> MarketplaceOperator:
    operator = db.scalar(
        select(MarketplaceOperator)
        .where(MarketplaceOperator.slug == slug)
        .where(MarketplaceOperator.is_active.is_(True))
    )
    if operator is None:
        raise HTTPException(status_code=422, detail="MARKETPLACE_OPERATOR_UNAVAILABLE")
    return operator


def _ensure_no_managed_listing(
    db: Session,
    seller_user_id: UUID,
    operator_id: UUID,
) -> None:
    stmt = (
        select(MarketplaceListing.id)
        .where(MarketplaceListing.seller_user_id == seller_user_id)
        .where(MarketplaceListing.operator_id == operator_id)
        .where(MarketplaceListing.status.in_({"active", "paused", "expired"}))
    )
    if db.scalar(stmt) is not None:
        raise HTTPException(
            status_code=409, detail="MARKETPLACE_OPERATOR_LISTING_EXISTS"
        )


def _normalize_description(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _require_username(user: User) -> None:
    if not user.username:
        raise HTTPException(status_code=409, detail="TELEGRAM_USERNAME_REQUIRED")


def _expire_pending_requests(db: Session, listing_id: UUID, *, message: str) -> int:
    now = utcnow()
    pending = list(
        db.scalars(
            select(MarketplaceListingRequest)
            .where(MarketplaceListingRequest.listing_id == listing_id)
            .where(MarketplaceListingRequest.status == "pending")
            .with_for_update()
        ).all()
    )
    for request in pending:
        request.status = "expired"
        request.decided_at = now
        enqueue_notification(
            db,
            recipient_user_id=request.buyer_user_id,
            event_type="marketplace_request_expired",
            payload={
                "listing_id": str(listing_id),
                "request_id": str(request.id),
                "message": message,
            },
        )
    return len(pending)


__all__ = [
    "archive_marketplace_listing",
    "create_marketplace_listing",
    "pause_marketplace_listing",
    "renew_marketplace_listing",
    "resume_marketplace_listing",
    "update_marketplace_listing",
]
