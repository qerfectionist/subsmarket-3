from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from statistics import median
from typing import Literal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload

from subsmarket.core.config import settings
from subsmarket.core.database import utcnow
from subsmarket.identity.models import User
from subsmarket.marketplace.models import (
    MarketplaceListing,
    MarketplaceListingRequest,
    MarketplaceOperator,
)
from subsmarket.marketplace.pagination import (
    cursor_datetime,
    cursor_int,
    cursor_uuid,
    decode_cursor,
    encode_cursor,
)
from subsmarket.marketplace.schemas import (
    MarketplaceListingOut,
    MarketplaceListingRequestOut,
    MarketplaceOperatorOut,
    MarketplacePriceInsightOut,
)
from subsmarket.marketplace.time import as_utc

ListingSort = Literal["recent", "price_asc", "price_desc"]
RequestRole = Literal["buyer", "seller"]


def list_active_operators(db: Session) -> list[MarketplaceOperatorOut]:
    operators = db.scalars(
        select(MarketplaceOperator)
        .where(MarketplaceOperator.is_active.is_(True))
        .order_by(MarketplaceOperator.name.asc())
    ).all()
    return [MarketplaceOperatorOut.model_validate(item) for item in operators]


def get_listing_view(
    db: Session, user: User, listing_id: UUID
) -> MarketplaceListingOut:
    listing = db.scalar(
        select(MarketplaceListing)
        .options(joinedload(MarketplaceListing.operator))
        .where(MarketplaceListing.id == listing_id)
    )
    now = utcnow()
    if listing is None or (
        listing.seller_user_id != user.id
        and (
            listing.status != "active"
            or as_utc(listing.expires_at) <= now
        )
    ):
        raise HTTPException(status_code=404, detail="MARKETPLACE_LISTING_NOT_FOUND")
    return to_listing_out(listing, user.id)


def list_marketplace_listings_page(
    db: Session,
    user: User,
    *,
    operator_slug: str | None,
    sort: ListingSort,
    limit: int,
    cursor: str | None,
) -> tuple[list[MarketplaceListingOut], str | None]:
    now = utcnow()
    stmt = (
        select(MarketplaceListing)
        .join(MarketplaceOperator)
        .options(joinedload(MarketplaceListing.operator))
        .where(MarketplaceListing.listing_type == "mobile_data")
        .where(MarketplaceListing.status == "active")
        .where(MarketplaceListing.expires_at > now)
        .where(MarketplaceOperator.is_active.is_(True))
    )
    if operator_slug:
        stmt = stmt.where(MarketplaceOperator.slug == operator_slug)
    stmt = _apply_listing_cursor(stmt, sort, cursor)
    stmt = _apply_listing_order(stmt, sort).limit(limit + 1)
    rows = list(db.scalars(stmt).unique().all())
    has_more = len(rows) > limit
    rows = rows[:limit]
    next_cursor = _listing_cursor(rows[-1], sort) if has_more and rows else None
    return [to_listing_out(item, user.id) for item in rows], next_cursor


def get_marketplace_price_insight(
    db: Session,
    user: User,
    *,
    operator_slug: str,
) -> MarketplacePriceInsightOut:
    now = utcnow()
    prices_stmt = (
        select(MarketplaceListing.price_per_gb_kzt.label("price"))
        .join(MarketplaceOperator)
        .where(MarketplaceListing.listing_type == "mobile_data")
        .where(MarketplaceListing.status == "active")
        .where(MarketplaceListing.expires_at > now)
        .where(MarketplaceOperator.slug == operator_slug)
        .where(MarketplaceOperator.is_active.is_(True))
        .where(MarketplaceListing.seller_user_id != user.id)
    )
    if db.get_bind().dialect.name == "postgresql":
        prices = prices_stmt.subquery()
        sample_size, median_price, minimum_price, maximum_price = db.execute(
            select(
                func.count(prices.c.price),
                func.percentile_cont(0.5).within_group(prices.c.price.asc()),
                func.percentile_disc(0.25).within_group(prices.c.price.asc()),
                func.percentile_disc(0.75).within_group(prices.c.price.asc()),
            ).select_from(prices)
        ).one()
        if sample_size < 5:
            return MarketplacePriceInsightOut(
                operator_slug=operator_slug,
                sample_size=sample_size,
            )
        return MarketplacePriceInsightOut(
            operator_slug=operator_slug,
            sample_size=sample_size,
            median_price_per_gb_kzt=round(median_price),
            typical_min_price_per_gb_kzt=minimum_price,
            typical_max_price_per_gb_kzt=maximum_price,
        )

    prices = list(db.scalars(prices_stmt.order_by("price")).all())
    sample_size = len(prices)
    if sample_size < 5:
        return MarketplacePriceInsightOut(
            operator_slug=operator_slug,
            sample_size=sample_size,
        )
    return MarketplacePriceInsightOut(
        operator_slug=operator_slug,
        sample_size=sample_size,
        median_price_per_gb_kzt=round(median(prices)),
        typical_min_price_per_gb_kzt=prices[(sample_size - 1) // 4],
        typical_max_price_per_gb_kzt=prices[(3 * (sample_size - 1)) // 4],
    )


def list_my_marketplace_listings(
    db: Session,
    user: User,
    *,
    limit: int,
    cursor: str | None,
) -> tuple[list[MarketplaceListingOut], str | None]:
    stmt = (
        select(MarketplaceListing)
        .options(joinedload(MarketplaceListing.operator))
        .where(MarketplaceListing.seller_user_id == user.id)
    )
    if cursor:
        payload = decode_cursor(cursor)
        updated_at = cursor_datetime(payload, "updated_at")
        listing_id = cursor_uuid(payload)
        stmt = stmt.where(
            or_(
                MarketplaceListing.updated_at < updated_at,
                and_(
                    MarketplaceListing.updated_at == updated_at,
                    MarketplaceListing.id < listing_id,
                ),
            )
        )
    rows = list(
        db.scalars(
            stmt.order_by(
                MarketplaceListing.updated_at.desc(),
                MarketplaceListing.id.desc(),
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
    return [to_listing_out(item, user.id) for item in rows], next_cursor


def list_my_marketplace_requests_page(
    db: Session,
    user: User,
    *,
    role: RequestRole,
    limit: int,
    cursor: str | None,
) -> tuple[list[MarketplaceListingRequestOut], str | None]:
    stmt = (
        select(MarketplaceListingRequest)
        .join(MarketplaceListing)
        .options(
            joinedload(MarketplaceListingRequest.listing).joinedload(
                MarketplaceListing.seller
            ),
            joinedload(MarketplaceListingRequest.buyer),
        )
    )
    if role == "buyer":
        stmt = stmt.where(MarketplaceListingRequest.buyer_user_id == user.id)
    else:
        stmt = stmt.where(MarketplaceListing.seller_user_id == user.id)
    if cursor:
        payload = decode_cursor(cursor)
        created_at = cursor_datetime(payload, "created_at")
        request_id = cursor_uuid(payload)
        stmt = stmt.where(
            or_(
                MarketplaceListingRequest.created_at < created_at,
                and_(
                    MarketplaceListingRequest.created_at == created_at,
                    MarketplaceListingRequest.id < request_id,
                ),
            )
        )
    rows = list(
        db.scalars(
            stmt.order_by(
                MarketplaceListingRequest.created_at.desc(),
                MarketplaceListingRequest.id.desc(),
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
    return [to_request_out(item, user) for item in rows], next_cursor


def to_listing_out(listing: MarketplaceListing, user_id: UUID) -> MarketplaceListingOut:
    return MarketplaceListingOut(
        id=listing.id,
        listing_type="mobile_data",
        operator=MarketplaceOperatorOut.model_validate(listing.operator),
        price_per_gb_kzt=listing.price_per_gb_kzt,
        description=listing.description,
        status=listing.status,
        is_owner=listing.seller_user_id == user_id,
        expires_at=listing.expires_at,
        published_at=listing.published_at,
        created_at=listing.created_at,
        updated_at=listing.updated_at,
    )


def to_request_out(
    request: MarketplaceListingRequest,
    user: User,
) -> MarketplaceListingRequestOut:
    listing = request.listing
    is_seller = listing.seller_user_id == user.id
    role: RequestRole = "seller" if is_seller else "buyer"
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
        amount = _format_amount(request.amount_gb_snapshot)
        telegram_draft = (
            f"Здравствуйте! Вы оставили заявку на покупку {amount} ГБ "
            f"{request.operator_name_snapshot} в SubsMarket."
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

    return MarketplaceListingRequestOut(
        id=request.id,
        listing_id=request.listing_id,
        role=role,
        status=request.status,
        operator_slug=request.operator_slug_snapshot,
        operator_name=request.operator_name_snapshot,
        amount_gb=request.amount_gb_snapshot,
        price_per_gb_kzt=request.price_per_gb_kzt_snapshot,
        total_price_kzt=request.total_price_kzt_snapshot,
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


def _apply_listing_cursor(stmt, sort: ListingSort, cursor: str | None):
    if not cursor:
        return stmt
    payload = decode_cursor(cursor)
    if payload.get("sort") != sort:
        raise HTTPException(status_code=400, detail="CURSOR_SORT_MISMATCH")
    listing_id = cursor_uuid(payload)
    if sort == "recent":
        value = cursor_datetime(payload, "value")
        column = MarketplaceListing.published_at
        return stmt.where(
            or_(
                column < value,
                and_(column == value, MarketplaceListing.id < listing_id),
            )
        )
    if sort.startswith("price_"):
        value = cursor_int(payload, "value")
        column = MarketplaceListing.price_per_gb_kzt
    ascending = sort.endswith("_asc")
    comparator = column > value if ascending else column < value
    published_at = cursor_datetime(payload, "published_at")
    return stmt.where(
        or_(
            comparator,
            and_(
                column == value,
                or_(
                    MarketplaceListing.published_at < published_at,
                    and_(
                        MarketplaceListing.published_at == published_at,
                        MarketplaceListing.id < listing_id,
                    ),
                ),
            ),
        )
    )


def _apply_listing_order(stmt, sort: ListingSort):
    if sort == "recent":
        return stmt.order_by(
            MarketplaceListing.published_at.desc(),
            MarketplaceListing.id.desc(),
        )
    if sort == "price_asc":
        return stmt.order_by(
            MarketplaceListing.price_per_gb_kzt.asc(),
            MarketplaceListing.published_at.desc(),
            MarketplaceListing.id.desc(),
        )
    if sort == "price_desc":
        return stmt.order_by(
            MarketplaceListing.price_per_gb_kzt.desc(),
            MarketplaceListing.published_at.desc(),
            MarketplaceListing.id.desc(),
        )
    raise ValueError(f"Unsupported marketplace sort: {sort}")


def _listing_cursor(listing: MarketplaceListing, sort: ListingSort) -> str:
    if sort == "recent":
        value: object = listing.published_at.isoformat()
    else:
        value = listing.price_per_gb_kzt
    payload: dict[str, object] = {
        "sort": sort,
        "value": value,
        "id": str(listing.id),
    }
    if sort != "recent":
        payload["published_at"] = listing.published_at.isoformat()
    return encode_cursor(payload)


def _format_amount(value: Decimal) -> str:
    return format(value.normalize(), "f")
