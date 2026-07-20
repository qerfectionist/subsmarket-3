from __future__ import annotations

from datetime import timedelta
from typing import Literal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session, joinedload

from subsmarket.core.config import settings
from subsmarket.core.database import utcnow
from subsmarket.identity.models import User
from subsmarket.marketplace.account_models import (
    MarketplaceAccountListing,
    MarketplaceAccountRequest,
    MarketplaceAccountService,
)
from subsmarket.marketplace.account_schemas import (
    AccountListingOut,
    AccountRequestOut,
    AccountServiceOut,
)
from subsmarket.marketplace.pagination import (
    cursor_datetime,
    cursor_int,
    cursor_uuid,
    decode_cursor,
    encode_cursor,
)
from subsmarket.marketplace.time import as_utc

AccountListingSort = Literal["recent", "price_asc", "price_desc"]
AccountRequestRole = Literal["buyer", "seller"]


def list_active_account_services(db: Session) -> list[AccountServiceOut]:
    rows = db.scalars(
        select(MarketplaceAccountService)
        .where(MarketplaceAccountService.is_active.is_(True))
        .order_by(MarketplaceAccountService.name.asc())
    ).all()
    return [AccountServiceOut.model_validate(row) for row in rows]


def get_account_listing_view(
    db: Session, user: User, listing_id: UUID
) -> AccountListingOut:
    listing = db.scalar(
        select(MarketplaceAccountListing)
        .options(joinedload(MarketplaceAccountListing.service))
        .where(MarketplaceAccountListing.id == listing_id)
    )
    if listing is None or (
        listing.seller_user_id != user.id
        and (
            listing.status != "active" or as_utc(listing.expires_at) <= utcnow()
        )
    ):
        raise HTTPException(status_code=404, detail="ACCOUNT_LISTING_NOT_FOUND")
    return to_account_listing_out(listing, user.id)


def list_account_listings_page(
    db: Session,
    user: User,
    *,
    service_slug: str | None,
    sort: AccountListingSort,
    limit: int,
    cursor: str | None,
) -> tuple[list[AccountListingOut], str | None]:
    stmt = (
        select(MarketplaceAccountListing)
        .join(MarketplaceAccountService)
        .options(joinedload(MarketplaceAccountListing.service))
        .where(MarketplaceAccountListing.status == "active")
        .where(MarketplaceAccountListing.expires_at > utcnow())
        .where(MarketplaceAccountService.is_active.is_(True))
    )
    if service_slug:
        stmt = stmt.where(MarketplaceAccountService.slug == service_slug)
    stmt = _apply_listing_cursor(stmt, sort, cursor)
    rows = list(
        db.scalars(_apply_listing_order(stmt, sort).limit(limit + 1)).unique().all()
    )
    has_more = len(rows) > limit
    rows = rows[:limit]
    next_cursor = _listing_cursor(rows[-1], sort) if has_more and rows else None
    return [to_account_listing_out(row, user.id) for row in rows], next_cursor


def list_my_account_listings(
    db: Session, user: User, *, limit: int, cursor: str | None
) -> tuple[list[AccountListingOut], str | None]:
    stmt = (
        select(MarketplaceAccountListing)
        .options(joinedload(MarketplaceAccountListing.service))
        .where(MarketplaceAccountListing.seller_user_id == user.id)
    )
    if cursor:
        payload = decode_cursor(cursor)
        updated_at = cursor_datetime(payload, "updated_at")
        listing_id = cursor_uuid(payload)
        stmt = stmt.where(
            or_(
                MarketplaceAccountListing.updated_at < updated_at,
                and_(
                    MarketplaceAccountListing.updated_at == updated_at,
                    MarketplaceAccountListing.id < listing_id,
                ),
            )
        )
    rows = list(
        db.scalars(
            stmt.order_by(
                MarketplaceAccountListing.updated_at.desc(),
                MarketplaceAccountListing.id.desc(),
            ).limit(limit + 1)
        )
        .unique()
        .all()
    )
    has_more = len(rows) > limit
    rows = rows[:limit]
    next_cursor = None
    if has_more and rows:
        last = rows[-1]
        next_cursor = encode_cursor(
            {"updated_at": last.updated_at.isoformat(), "id": str(last.id)}
        )
    return [to_account_listing_out(row, user.id) for row in rows], next_cursor


def list_my_account_requests_page(
    db: Session,
    user: User,
    *,
    role: AccountRequestRole,
    limit: int,
    cursor: str | None,
) -> tuple[list[AccountRequestOut], str | None]:
    stmt = (
        select(MarketplaceAccountRequest)
        .join(MarketplaceAccountListing)
        .options(
            joinedload(MarketplaceAccountRequest.listing).joinedload(
                MarketplaceAccountListing.seller
            ),
            joinedload(MarketplaceAccountRequest.buyer),
        )
    )
    if role == "buyer":
        stmt = stmt.where(MarketplaceAccountRequest.buyer_user_id == user.id)
    else:
        stmt = stmt.where(MarketplaceAccountListing.seller_user_id == user.id)
    if cursor:
        payload = decode_cursor(cursor)
        created_at = cursor_datetime(payload, "created_at")
        request_id = cursor_uuid(payload)
        stmt = stmt.where(
            or_(
                MarketplaceAccountRequest.created_at < created_at,
                and_(
                    MarketplaceAccountRequest.created_at == created_at,
                    MarketplaceAccountRequest.id < request_id,
                ),
            )
        )
    rows = list(
        db.scalars(
            stmt.order_by(
                MarketplaceAccountRequest.created_at.desc(),
                MarketplaceAccountRequest.id.desc(),
            ).limit(limit + 1)
        )
        .unique()
        .all()
    )
    has_more = len(rows) > limit
    rows = rows[:limit]
    next_cursor = None
    if has_more and rows:
        last = rows[-1]
        next_cursor = encode_cursor(
            {"created_at": last.created_at.isoformat(), "id": str(last.id)}
        )
    return [to_account_request_out(row, user) for row in rows], next_cursor


def to_account_listing_out(
    listing: MarketplaceAccountListing, user_id: UUID
) -> AccountListingOut:
    renew_available_at = None
    can_renew = False
    if listing.status != "archived":
        renew_available_at = as_utc(listing.expires_at) - timedelta(
            days=settings.marketplace_listing_expiry_reminder_days
        )
        can_renew = listing.service.is_active and (
            listing.status == "expired" or utcnow() >= renew_available_at
        )
    return AccountListingOut(
        id=listing.id,
        service=AccountServiceOut.model_validate(listing.service),
        title=listing.title,
        price_kzt=listing.price_kzt,
        description=listing.description,
        status=listing.status,
        is_owner=listing.seller_user_id == user_id,
        can_renew=can_renew,
        renew_available_at=renew_available_at,
        expires_at=listing.expires_at,
        published_at=listing.published_at,
        created_at=listing.created_at,
        updated_at=listing.updated_at,
    )


def to_account_request_out(
    request: MarketplaceAccountRequest, user: User
) -> AccountRequestOut:
    listing = request.listing
    is_seller = listing.seller_user_id == user.id
    counterparty = request.buyer if is_seller else listing.seller
    expose_contact = request.status in {"accepted", "closed"}
    username = counterparty.username if expose_contact else None
    telegram_url = (
        f"https://t.me/{username}"
        if username and request.status == "accepted"
        else None
    )
    telegram_draft = None
    if is_seller and username and request.status == "accepted":
        telegram_draft = (
            "Здравствуйте! Вы оставили заявку на покупку "
            f"{request.title_snapshot} в SubsMarket."
        )
    reminder_available_at = None
    can_remind = False
    if request.status == "pending" and not is_seller:
        reminder_available_at = as_utc(request.created_at) + timedelta(
            seconds=settings.marketplace_request_reminder_delay_seconds
        )
        cooldown_at = (
            as_utc(request.last_reminded_at)
            + timedelta(seconds=settings.marketplace_request_reminder_cooldown_seconds)
            if request.last_reminded_at
            else reminder_available_at
        )
        can_remind = utcnow() >= max(reminder_available_at, cooldown_at)
    return AccountRequestOut(
        id=request.id,
        listing_id=request.listing_id,
        role="seller" if is_seller else "buyer",
        status=request.status,
        service_slug=request.service_slug_snapshot,
        service_name=request.service_name_snapshot,
        title=request.title_snapshot,
        price_kzt=request.price_kzt_snapshot,
        outcome=request.outcome,
        reason=request.reason,
        counterparty_username=username,
        telegram_url=telegram_url,
        telegram_draft=telegram_draft,
        can_remind=can_remind,
        reminder_available_at=reminder_available_at,
        created_at=request.created_at,
        decided_at=request.decided_at,
        cancelled_at=request.cancelled_at,
        closed_at=request.closed_at,
    )


def _apply_listing_cursor(stmt, sort: AccountListingSort, cursor: str | None):
    if not cursor:
        return stmt
    payload = decode_cursor(cursor)
    if payload.get("sort") != sort:
        raise HTTPException(status_code=400, detail="CURSOR_SORT_MISMATCH")
    listing_id = cursor_uuid(payload)
    if sort == "recent":
        value = cursor_datetime(payload, "value")
        return stmt.where(
            or_(
                MarketplaceAccountListing.published_at < value,
                and_(
                    MarketplaceAccountListing.published_at == value,
                    MarketplaceAccountListing.id < listing_id,
                ),
            )
        )
    value = cursor_int(payload, "value")
    comparator = (
        MarketplaceAccountListing.price_kzt > value
        if sort == "price_asc"
        else MarketplaceAccountListing.price_kzt < value
    )
    published_at = cursor_datetime(payload, "published_at")
    return stmt.where(
        or_(
            comparator,
            and_(
                MarketplaceAccountListing.price_kzt == value,
                or_(
                    MarketplaceAccountListing.published_at < published_at,
                    and_(
                        MarketplaceAccountListing.published_at == published_at,
                        MarketplaceAccountListing.id < listing_id,
                    ),
                ),
            ),
        )
    )


def _apply_listing_order(stmt, sort: AccountListingSort):
    if sort == "recent":
        return stmt.order_by(
            MarketplaceAccountListing.published_at.desc(),
            MarketplaceAccountListing.id.desc(),
        )
    price_order = (
        MarketplaceAccountListing.price_kzt.asc()
        if sort == "price_asc"
        else MarketplaceAccountListing.price_kzt.desc()
    )
    return stmt.order_by(
        price_order,
        MarketplaceAccountListing.published_at.desc(),
        MarketplaceAccountListing.id.desc(),
    )


def _listing_cursor(
    listing: MarketplaceAccountListing, sort: AccountListingSort
) -> str:
    payload: dict[str, object] = {
        "sort": sort,
        "value": (
            listing.published_at.isoformat()
            if sort == "recent"
            else listing.price_kzt
        ),
        "id": str(listing.id),
    }
    if sort != "recent":
        payload["published_at"] = listing.published_at.isoformat()
    return encode_cursor(payload)


__all__ = [
    "get_account_listing_view",
    "list_account_listings_page",
    "list_active_account_services",
    "list_my_account_listings",
    "list_my_account_requests_page",
    "to_account_listing_out",
    "to_account_request_out",
]
