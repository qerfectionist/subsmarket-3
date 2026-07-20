from __future__ import annotations

from datetime import timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from subsmarket.core.config import settings
from subsmarket.core.database import utcnow
from subsmarket.core.idempotency import claim_idempotency, complete_idempotency
from subsmarket.identity.models import User
from subsmarket.marketplace.account_models import (
    MarketplaceAccountListing,
    MarketplaceAccountRequest,
    MarketplaceAccountService,
)
from subsmarket.marketplace.account_queries import to_account_listing_out
from subsmarket.marketplace.account_schemas import (
    AccountListingCreate,
    AccountListingOut,
    AccountListingUpdate,
)
from subsmarket.marketplace.time import as_utc
from subsmarket.notifications.service import enqueue_notification


def create_account_listing(
    db: Session,
    user: User,
    data: AccountListingCreate,
    *,
    idempotency_key: str | None = None,
) -> AccountListingOut:
    _require_username(user)
    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation="account_listing.create",
        idempotency_key=idempotency_key,
        payload=data.model_dump(mode="json"),
        resource_type="account_listing",
    )
    if claim.is_replay:
        return to_account_listing_out(_get_listing(db, claim.resource_id), user.id)
    service = _get_active_service(db, data.service_slug)
    now = utcnow()
    listing = MarketplaceAccountListing(
        seller_user_id=user.id,
        service_id=service.id,
        title=_normalize_title(data.title),
        price_kzt=data.price_kzt,
        description=_normalize_optional(data.description),
        status="active",
        expires_at=now + timedelta(days=settings.marketplace_account_listing_days),
        published_at=now,
    )
    listing.service = service
    db.add(listing)
    db.flush()
    complete_idempotency(
        claim, resource_type="account_listing", resource_id=listing.id
    )
    return to_account_listing_out(listing, user.id)


def update_account_listing(
    db: Session,
    user: User,
    listing_id: UUID,
    data: AccountListingUpdate,
    *,
    idempotency_key: str | None = None,
) -> AccountListingOut:
    claim = claim_idempotency(
        db,
        user_id=user.id,
        operation="account_listing.update",
        idempotency_key=idempotency_key,
        payload={
            "listing_id": str(listing_id),
            **data.model_dump(mode="json", exclude_unset=True),
        },
        resource_type="account_listing",
    )
    if claim.is_replay:
        return to_account_listing_out(_get_listing(db, claim.resource_id), user.id)
    listing = _get_owned_listing_for_update(db, user.id, listing_id)
    if listing.status not in {"active", "paused", "expired"}:
        raise HTTPException(status_code=409, detail="ACCOUNT_LISTING_NOT_EDITABLE")
    if "title" in data.model_fields_set:
        if data.title is None:
            raise HTTPException(status_code=422, detail="ACCOUNT_TITLE_REQUIRED")
        listing.title = _normalize_title(data.title)
    if "price_kzt" in data.model_fields_set:
        if data.price_kzt is None:
            raise HTTPException(status_code=422, detail="ACCOUNT_PRICE_REQUIRED")
        listing.price_kzt = data.price_kzt
    if "description" in data.model_fields_set:
        listing.description = _normalize_optional(data.description)
    listing.updated_at = utcnow()
    complete_idempotency(
        claim, resource_type="account_listing", resource_id=listing.id
    )
    db.flush()
    return to_account_listing_out(listing, user.id)


def pause_account_listing(
    db: Session, user: User, listing_id: UUID, *, idempotency_key: str | None = None
) -> AccountListingOut:
    return _set_status(
        db, user, listing_id, operation="account_listing.pause",
        allowed={"active"}, target="paused", idempotency_key=idempotency_key
    )


def resume_account_listing(
    db: Session, user: User, listing_id: UUID, *, idempotency_key: str | None = None
) -> AccountListingOut:
    return _set_status(
        db, user, listing_id, operation="account_listing.resume",
        allowed={"paused"}, target="active", idempotency_key=idempotency_key,
        require_unexpired=True,
    )


def renew_account_listing(
    db: Session, user: User, listing_id: UUID, *, idempotency_key: str | None = None
) -> AccountListingOut:
    claim = claim_idempotency(
        db, user_id=user.id, operation="account_listing.renew",
        idempotency_key=idempotency_key, payload={"listing_id": str(listing_id)},
        resource_type="account_listing",
    )
    if claim.is_replay:
        return to_account_listing_out(_get_listing(db, claim.resource_id), user.id)
    listing = _get_owned_listing_for_update(db, user.id, listing_id)
    if listing.status == "archived":
        raise HTTPException(status_code=409, detail="ACCOUNT_LISTING_ARCHIVED")
    if not listing.service.is_active:
        raise HTTPException(status_code=409, detail="ACCOUNT_SERVICE_UNAVAILABLE")
    now = utcnow()
    renew_available_at = as_utc(listing.expires_at) - timedelta(
        days=settings.marketplace_listing_expiry_reminder_days
    )
    if listing.status != "expired" and now < renew_available_at:
        raise HTTPException(status_code=409, detail="ACCOUNT_LISTING_RENEW_TOO_EARLY")
    listing.expires_at = now + timedelta(
        days=settings.marketplace_account_listing_days
    )
    listing.published_at = now
    listing.expiry_reminder_sent_at = None
    if listing.status == "expired":
        listing.status = "active"
    listing.updated_at = now
    complete_idempotency(
        claim, resource_type="account_listing", resource_id=listing.id
    )
    db.flush()
    return to_account_listing_out(listing, user.id)


def archive_account_listing(
    db: Session, user: User, listing_id: UUID, *, idempotency_key: str | None = None
) -> AccountListingOut:
    result = _set_status(
        db, user, listing_id, operation="account_listing.archive",
        allowed={"active", "paused", "expired"}, target="archived",
        idempotency_key=idempotency_key,
    )
    _expire_pending_requests(db, listing_id, message="Объявление больше неактуально.")
    db.flush()
    return result


def _set_status(
    db: Session,
    user: User,
    listing_id: UUID,
    *,
    operation: str,
    allowed: set[str],
    target: str,
    idempotency_key: str | None,
    require_unexpired: bool = False,
) -> AccountListingOut:
    claim = claim_idempotency(
        db, user_id=user.id, operation=operation, idempotency_key=idempotency_key,
        payload={"listing_id": str(listing_id)}, resource_type="account_listing",
    )
    if claim.is_replay:
        return to_account_listing_out(_get_listing(db, claim.resource_id), user.id)
    listing = _get_owned_listing_for_update(db, user.id, listing_id)
    if target == "active" and not listing.service.is_active:
        raise HTTPException(status_code=409, detail="ACCOUNT_SERVICE_UNAVAILABLE")
    if require_unexpired and as_utc(listing.expires_at) <= utcnow():
        listing.status = "expired"
        db.flush()
        raise HTTPException(status_code=409, detail="ACCOUNT_LISTING_RENEW_REQUIRED")
    if listing.status == target:
        complete_idempotency(
            claim, resource_type="account_listing", resource_id=listing.id
        )
        return to_account_listing_out(listing, user.id)
    if listing.status not in allowed:
        raise HTTPException(status_code=409, detail="ACCOUNT_LISTING_STATUS_CONFLICT")
    listing.status = target
    listing.updated_at = utcnow()
    complete_idempotency(
        claim, resource_type="account_listing", resource_id=listing.id
    )
    db.flush()
    return to_account_listing_out(listing, user.id)


def _get_listing(db: Session, listing_id: UUID | None) -> MarketplaceAccountListing:
    if listing_id is None:
        raise RuntimeError("Account listing id is missing")
    listing = db.scalar(
        select(MarketplaceAccountListing)
        .options(joinedload(MarketplaceAccountListing.service))
        .where(MarketplaceAccountListing.id == listing_id)
    )
    if listing is None:
        raise HTTPException(status_code=404, detail="ACCOUNT_LISTING_NOT_FOUND")
    return listing


def _get_owned_listing_for_update(
    db: Session, user_id: UUID, listing_id: UUID
) -> MarketplaceAccountListing:
    listing = db.scalar(
        select(MarketplaceAccountListing)
        .options(selectinload(MarketplaceAccountListing.service))
        .where(MarketplaceAccountListing.id == listing_id)
        .with_for_update()
    )
    if listing is None:
        raise HTTPException(status_code=404, detail="ACCOUNT_LISTING_NOT_FOUND")
    if listing.seller_user_id != user_id:
        raise HTTPException(status_code=403, detail="ACCOUNT_LISTING_OWNER_REQUIRED")
    return listing


def _get_active_service(db: Session, slug: str) -> MarketplaceAccountService:
    service = db.scalar(
        select(MarketplaceAccountService)
        .where(MarketplaceAccountService.slug == slug)
        .where(MarketplaceAccountService.is_active.is_(True))
    )
    if service is None:
        raise HTTPException(status_code=422, detail="ACCOUNT_SERVICE_UNAVAILABLE")
    return service


def _normalize_title(value: str) -> str:
    normalized = " ".join(value.split())
    if len(normalized) < 2:
        raise HTTPException(status_code=422, detail="ACCOUNT_TITLE_REQUIRED")
    return normalized


def _normalize_optional(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _require_username(user: User) -> None:
    if not user.username:
        raise HTTPException(status_code=409, detail="TELEGRAM_USERNAME_REQUIRED")


def _expire_pending_requests(db: Session, listing_id: UUID, *, message: str) -> int:
    now = utcnow()
    requests = list(
        db.scalars(
            select(MarketplaceAccountRequest)
            .where(MarketplaceAccountRequest.listing_id == listing_id)
            .where(MarketplaceAccountRequest.status == "pending")
            .with_for_update()
        ).all()
    )
    for request in requests:
        request.status = "expired"
        request.decided_at = now
        enqueue_notification(
            db, recipient_user_id=request.buyer_user_id,
            event_type="account_request_expired",
            payload={
                "listing_id": str(listing_id),
                "request_id": str(request.id),
                "message": message,
            },
        )
    return len(requests)


__all__ = [
    "archive_account_listing",
    "create_account_listing",
    "pause_account_listing",
    "renew_account_listing",
    "resume_account_listing",
    "update_account_listing",
]
