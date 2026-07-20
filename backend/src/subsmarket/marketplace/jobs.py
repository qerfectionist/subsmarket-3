from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from subsmarket.core.config import settings
from subsmarket.core.database import utcnow
from subsmarket.marketplace.account_models import (
    MarketplaceAccountListing,
    MarketplaceAccountRequest,
)
from subsmarket.marketplace.models import (
    MarketplaceListing,
    MarketplaceListingRequest,
)
from subsmarket.notifications.service import enqueue_notification


def send_marketplace_listing_expiry_reminders(db: Session) -> int:
    now = utcnow()
    reminder_deadline = now + timedelta(
        days=settings.marketplace_listing_expiry_reminder_days
    )
    listings = list(
        db.scalars(
            select(MarketplaceListing)
            .where(MarketplaceListing.status.in_({"active", "paused"}))
            .where(MarketplaceListing.expires_at > now)
            .where(MarketplaceListing.expires_at <= reminder_deadline)
            .where(MarketplaceListing.expiry_reminder_sent_at.is_(None))
            .order_by(MarketplaceListing.expires_at.asc())
            .limit(settings.job_batch_size)
            .with_for_update(skip_locked=True)
        ).all()
    )
    created = 0
    for listing in listings:
        enqueue_notification(
            db,
            recipient_user_id=listing.seller_user_id,
            event_type="marketplace_listing_expiry_reminder",
            payload={
                "listing_id": str(listing.id),
                "expires_at": listing.expires_at.isoformat(),
                "message": (
                    "Срок объявления о продаже гигабайтов скоро закончится. "
                    "Продлите его, если предложение ещё актуально."
                ),
            },
        )
        listing.expiry_reminder_sent_at = now
        created += 1
    account_listings = list(
        db.scalars(
            select(MarketplaceAccountListing)
            .where(MarketplaceAccountListing.status.in_({"active", "paused"}))
            .where(MarketplaceAccountListing.expires_at > now)
            .where(MarketplaceAccountListing.expires_at <= reminder_deadline)
            .where(MarketplaceAccountListing.expiry_reminder_sent_at.is_(None))
            .order_by(MarketplaceAccountListing.expires_at.asc())
            .limit(settings.job_batch_size)
            .with_for_update(skip_locked=True)
        ).all()
    )
    for listing in account_listings:
        enqueue_notification(
            db,
            recipient_user_id=listing.seller_user_id,
            event_type="account_listing_expiry_reminder",
            payload={
                "listing_id": str(listing.id),
                "expires_at": listing.expires_at.isoformat(),
                "message": (
                    "Срок объявления об аккаунте скоро закончится. "
                    "Продлите его, если предложение ещё актуально."
                ),
            },
        )
        listing.expiry_reminder_sent_at = now
        created += 1
    if created:
        db.flush()
    return created


def expire_marketplace_listings(db: Session) -> tuple[int, int]:
    now = utcnow()
    listings = list(
        db.scalars(
            select(MarketplaceListing)
            .where(MarketplaceListing.status.in_({"active", "paused"}))
            .where(MarketplaceListing.expires_at <= now)
            .order_by(MarketplaceListing.expires_at.asc())
            .limit(settings.job_batch_size)
            .with_for_update(skip_locked=True)
        ).all()
    )
    notification_count = 0
    for listing in listings:
        listing.status = "expired"
        listing.updated_at = now
        pending_requests = list(
            db.scalars(
                select(MarketplaceListingRequest)
                .options(selectinload(MarketplaceListingRequest.buyer))
                .where(MarketplaceListingRequest.listing_id == listing.id)
                .where(MarketplaceListingRequest.status == "pending")
                .with_for_update()
            ).all()
        )
        for request in pending_requests:
            request.status = "expired"
            request.decided_at = now
            enqueue_notification(
                db,
                recipient_user_id=request.buyer_user_id,
                event_type="marketplace_request_expired",
                payload={
                    "listing_id": str(listing.id),
                    "request_id": str(request.id),
                    "message": "Срок объявления закончился. Заявка закрыта.",
                },
            )
            notification_count += 1
        enqueue_notification(
            db,
            recipient_user_id=listing.seller_user_id,
            event_type="marketplace_listing_expired",
            payload={
                "listing_id": str(listing.id),
                "message": (
                    "Срок объявления о продаже гигабайтов закончился. "
                    "Его можно продлить без создания нового объявления."
                ),
            },
        )
        notification_count += 1
    account_listings = list(
        db.scalars(
            select(MarketplaceAccountListing)
            .where(MarketplaceAccountListing.status.in_({"active", "paused"}))
            .where(MarketplaceAccountListing.expires_at <= now)
            .order_by(MarketplaceAccountListing.expires_at.asc())
            .limit(settings.job_batch_size)
            .with_for_update(skip_locked=True)
        ).all()
    )
    for listing in account_listings:
        listing.status = "expired"
        listing.updated_at = now
        pending_requests = list(
            db.scalars(
                select(MarketplaceAccountRequest)
                .where(MarketplaceAccountRequest.listing_id == listing.id)
                .where(MarketplaceAccountRequest.status == "pending")
                .with_for_update()
            ).all()
        )
        for request in pending_requests:
            request.status = "expired"
            request.decided_at = now
            enqueue_notification(
                db,
                recipient_user_id=request.buyer_user_id,
                event_type="account_request_expired",
                payload={
                    "listing_id": str(listing.id),
                    "request_id": str(request.id),
                    "message": "Срок объявления закончился. Заявка закрыта.",
                },
            )
            notification_count += 1
        enqueue_notification(
            db,
            recipient_user_id=listing.seller_user_id,
            event_type="account_listing_expired",
            payload={
                "listing_id": str(listing.id),
                "message": (
                    "Срок объявления об аккаунте закончился. "
                    "Его можно продлить без создания нового объявления."
                ),
            },
        )
        notification_count += 1
    if listings or account_listings:
        db.flush()
    return len(listings) + len(account_listings), notification_count


__all__ = [
    "expire_marketplace_listings",
    "send_marketplace_listing_expiry_reminders",
]
