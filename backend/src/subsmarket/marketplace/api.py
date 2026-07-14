from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from subsmarket.core.config import settings
from subsmarket.core.database import get_db
from subsmarket.identity.dependencies import get_current_user
from subsmarket.marketplace.schemas import (
    MarketplaceListingCreate,
    MarketplaceListingOut,
    MarketplaceListingPageOut,
    MarketplaceListingRequestOut,
    MarketplaceListingRequestPageOut,
    MarketplaceListingUpdate,
    MarketplaceOperatorOut,
    MarketplacePriceInsightOut,
    MarketplaceRequestAction,
    MarketplaceRequestClose,
    MarketplaceRequestCreate,
)
from subsmarket.marketplace.service import (
    accept_marketplace_request,
    archive_marketplace_listing,
    cancel_marketplace_request,
    close_marketplace_request,
    create_marketplace_listing,
    create_marketplace_request,
    get_listing_view,
    get_marketplace_price_insight,
    list_active_operators,
    list_marketplace_listings_page,
    list_my_marketplace_listings,
    list_my_marketplace_requests_page,
    pause_marketplace_listing,
    reject_marketplace_request,
    remind_marketplace_request,
    renew_marketplace_listing,
    resume_marketplace_listing,
    update_marketplace_listing,
)


def require_marketplace_enabled() -> None:
    if not settings.is_development and not settings.marketplace_gb_enabled:
        raise HTTPException(status_code=404, detail="MARKETPLACE_GB_DISABLED")


router = APIRouter(
    prefix="/api/marketplace",
    tags=["marketplace"],
    dependencies=[Depends(require_marketplace_enabled)],
)


@router.get("/operators", response_model=list[MarketplaceOperatorOut])
def get_marketplace_operators(
    db: Session = Depends(get_db),
) -> list[MarketplaceOperatorOut]:
    return list_active_operators(db)


@router.get("/price-insight", response_model=MarketplacePriceInsightOut)
def get_marketplace_listing_price_insight(
    operator: str = Query(min_length=1, max_length=40),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> MarketplacePriceInsightOut:
    return get_marketplace_price_insight(db, user, operator_slug=operator)


@router.get("/listings", response_model=MarketplaceListingPageOut)
def get_marketplace_listings(
    operator: str | None = Query(default=None, max_length=40),
    sort: Literal["recent", "price_asc", "price_desc"] = Query(default="recent"),
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None, max_length=512),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> MarketplaceListingPageOut:
    items, next_cursor = list_marketplace_listings_page(
        db,
        user,
        operator_slug=operator,
        sort=sort,
        limit=limit,
        cursor=cursor,
    )
    return MarketplaceListingPageOut(items=items, next_cursor=next_cursor)


@router.get("/listings/me", response_model=MarketplaceListingPageOut)
def get_my_marketplace_listings(
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None, max_length=512),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> MarketplaceListingPageOut:
    items, next_cursor = list_my_marketplace_listings(
        db,
        user,
        limit=limit,
        cursor=cursor,
    )
    return MarketplaceListingPageOut(items=items, next_cursor=next_cursor)


@router.post("/listings", response_model=MarketplaceListingOut, status_code=201)
def post_marketplace_listing(
    data: MarketplaceListingCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> MarketplaceListingOut:
    return create_marketplace_listing(
        db,
        user,
        data,
        idempotency_key=idempotency_key,
    )


@router.get("/listings/{listing_id}", response_model=MarketplaceListingOut)
def get_marketplace_listing(
    listing_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> MarketplaceListingOut:
    return get_listing_view(db, user, listing_id)


@router.patch("/listings/{listing_id}", response_model=MarketplaceListingOut)
def patch_marketplace_listing(
    listing_id: UUID,
    data: MarketplaceListingUpdate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> MarketplaceListingOut:
    return update_marketplace_listing(
        db,
        user,
        listing_id,
        data,
        idempotency_key=idempotency_key,
    )


@router.post("/listings/{listing_id}/pause", response_model=MarketplaceListingOut)
def post_marketplace_listing_pause(
    listing_id: UUID,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> MarketplaceListingOut:
    return pause_marketplace_listing(
        db,
        user,
        listing_id,
        idempotency_key=idempotency_key,
    )


@router.post("/listings/{listing_id}/resume", response_model=MarketplaceListingOut)
def post_marketplace_listing_resume(
    listing_id: UUID,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> MarketplaceListingOut:
    return resume_marketplace_listing(
        db,
        user,
        listing_id,
        idempotency_key=idempotency_key,
    )


@router.post("/listings/{listing_id}/renew", response_model=MarketplaceListingOut)
def post_marketplace_listing_renew(
    listing_id: UUID,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> MarketplaceListingOut:
    return renew_marketplace_listing(
        db,
        user,
        listing_id,
        idempotency_key=idempotency_key,
    )


@router.post("/listings/{listing_id}/archive", response_model=MarketplaceListingOut)
def post_marketplace_listing_archive(
    listing_id: UUID,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> MarketplaceListingOut:
    return archive_marketplace_listing(
        db,
        user,
        listing_id,
        idempotency_key=idempotency_key,
    )


@router.post(
    "/listings/{listing_id}/requests",
    response_model=MarketplaceListingRequestOut,
    status_code=201,
)
def post_marketplace_request(
    listing_id: UUID,
    data: MarketplaceRequestCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> MarketplaceListingRequestOut:
    return create_marketplace_request(
        db,
        user,
        listing_id,
        data,
        idempotency_key=idempotency_key,
    )


@router.get("/requests/me", response_model=MarketplaceListingRequestPageOut)
def get_my_marketplace_requests(
    role: Literal["buyer", "seller"] = Query(default="buyer"),
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None, max_length=512),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> MarketplaceListingRequestPageOut:
    items, next_cursor = list_my_marketplace_requests_page(
        db,
        user,
        role=role,
        limit=limit,
        cursor=cursor,
    )
    return MarketplaceListingRequestPageOut(items=items, next_cursor=next_cursor)


@router.post(
    "/requests/{request_id}/accept", response_model=MarketplaceListingRequestOut
)
def post_marketplace_request_accept(
    request_id: UUID,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> MarketplaceListingRequestOut:
    return accept_marketplace_request(
        db,
        user,
        request_id,
        idempotency_key=idempotency_key,
    )


@router.post(
    "/requests/{request_id}/reject", response_model=MarketplaceListingRequestOut
)
def post_marketplace_request_reject(
    request_id: UUID,
    data: MarketplaceRequestAction,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> MarketplaceListingRequestOut:
    return reject_marketplace_request(
        db,
        user,
        request_id,
        reason=data.reason,
        idempotency_key=idempotency_key,
    )


@router.post(
    "/requests/{request_id}/cancel", response_model=MarketplaceListingRequestOut
)
def post_marketplace_request_cancel(
    request_id: UUID,
    data: MarketplaceRequestAction,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> MarketplaceListingRequestOut:
    return cancel_marketplace_request(
        db,
        user,
        request_id,
        reason=data.reason,
        idempotency_key=idempotency_key,
    )


@router.post(
    "/requests/{request_id}/close", response_model=MarketplaceListingRequestOut
)
def post_marketplace_request_close(
    request_id: UUID,
    data: MarketplaceRequestClose,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> MarketplaceListingRequestOut:
    return close_marketplace_request(
        db,
        user,
        request_id,
        outcome=data.outcome,
        reason=data.reason,
        idempotency_key=idempotency_key,
    )


@router.post(
    "/requests/{request_id}/remind", response_model=MarketplaceListingRequestOut
)
def post_marketplace_request_remind(
    request_id: UUID,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> MarketplaceListingRequestOut:
    return remind_marketplace_request(
        db,
        user,
        request_id,
        idempotency_key=idempotency_key,
    )
