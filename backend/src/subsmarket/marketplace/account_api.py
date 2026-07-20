from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from subsmarket.core.config import settings
from subsmarket.core.database import get_db
from subsmarket.identity.dependencies import get_current_user
from subsmarket.marketplace.account_schemas import (
    AccountListingCreate,
    AccountListingOut,
    AccountListingPageOut,
    AccountListingUpdate,
    AccountRequestAction,
    AccountRequestClose,
    AccountRequestOut,
    AccountRequestPageOut,
    AccountServiceOut,
)
from subsmarket.marketplace.account_service import (
    accept_account_request,
    archive_account_listing,
    cancel_account_request,
    close_account_request,
    create_account_listing,
    create_account_request,
    get_account_listing_view,
    list_account_listings_page,
    list_active_account_services,
    list_my_account_listings,
    list_my_account_requests_page,
    pause_account_listing,
    reject_account_request,
    remind_account_request,
    renew_account_listing,
    resume_account_listing,
    update_account_listing,
)


def require_accounts_enabled() -> None:
    if not settings.is_development and not settings.marketplace_accounts_enabled:
        raise HTTPException(status_code=404, detail="MARKETPLACE_ACCOUNTS_DISABLED")


router = APIRouter(
    prefix="/api/marketplace/accounts",
    tags=["marketplace-accounts"],
    dependencies=[Depends(require_accounts_enabled)],
)


@router.get("/services", response_model=list[AccountServiceOut])
def get_account_services(db: Session = Depends(get_db)) -> list[AccountServiceOut]:
    return list_active_account_services(db)


@router.get("/listings", response_model=AccountListingPageOut)
def get_account_listings(
    service: str | None = Query(default=None, max_length=40),
    sort: Literal["recent", "price_asc", "price_desc"] = Query(default="recent"),
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None, max_length=512),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> AccountListingPageOut:
    items, next_cursor = list_account_listings_page(
        db, user, service_slug=service, sort=sort, limit=limit, cursor=cursor
    )
    return AccountListingPageOut(items=items, next_cursor=next_cursor)


@router.get("/listings/me", response_model=AccountListingPageOut)
def get_my_account_listings(
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None, max_length=512),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> AccountListingPageOut:
    items, next_cursor = list_my_account_listings(
        db, user, limit=limit, cursor=cursor
    )
    return AccountListingPageOut(items=items, next_cursor=next_cursor)


@router.post("/listings", response_model=AccountListingOut, status_code=201)
def post_account_listing(
    data: AccountListingCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> AccountListingOut:
    return create_account_listing(
        db, user, data, idempotency_key=idempotency_key
    )


@router.get("/listings/{listing_id}", response_model=AccountListingOut)
def get_account_listing(
    listing_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> AccountListingOut:
    return get_account_listing_view(db, user, listing_id)


@router.patch("/listings/{listing_id}", response_model=AccountListingOut)
def patch_account_listing(
    listing_id: UUID,
    data: AccountListingUpdate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> AccountListingOut:
    return update_account_listing(
        db, user, listing_id, data, idempotency_key=idempotency_key
    )


def _listing_action(operation):
    def endpoint(
        listing_id: UUID,
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
        db: Session = Depends(get_db),
        user=Depends(get_current_user),
    ) -> AccountListingOut:
        return operation(
            db, user, listing_id, idempotency_key=idempotency_key
        )

    endpoint.__name__ = f"post_{operation.__name__}"
    return endpoint


router.post("/listings/{listing_id}/pause", response_model=AccountListingOut)(
    _listing_action(pause_account_listing)
)
router.post("/listings/{listing_id}/resume", response_model=AccountListingOut)(
    _listing_action(resume_account_listing)
)
router.post("/listings/{listing_id}/renew", response_model=AccountListingOut)(
    _listing_action(renew_account_listing)
)
router.post("/listings/{listing_id}/archive", response_model=AccountListingOut)(
    _listing_action(archive_account_listing)
)


@router.post(
    "/listings/{listing_id}/requests", response_model=AccountRequestOut,
    status_code=201,
)
def post_account_request(
    listing_id: UUID,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> AccountRequestOut:
    return create_account_request(
        db, user, listing_id, idempotency_key=idempotency_key
    )


@router.get("/requests/me", response_model=AccountRequestPageOut)
def get_my_account_requests(
    role: Literal["buyer", "seller"] = Query(default="buyer"),
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None, max_length=512),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> AccountRequestPageOut:
    items, next_cursor = list_my_account_requests_page(
        db, user, role=role, limit=limit, cursor=cursor
    )
    return AccountRequestPageOut(items=items, next_cursor=next_cursor)


@router.post("/requests/{request_id}/accept", response_model=AccountRequestOut)
def post_account_request_accept(
    request_id: UUID,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> AccountRequestOut:
    return accept_account_request(
        db, user, request_id, idempotency_key=idempotency_key
    )


@router.post("/requests/{request_id}/reject", response_model=AccountRequestOut)
def post_account_request_reject(
    request_id: UUID,
    data: AccountRequestAction,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> AccountRequestOut:
    return reject_account_request(
        db, user, request_id, reason=data.reason, idempotency_key=idempotency_key
    )


@router.post("/requests/{request_id}/cancel", response_model=AccountRequestOut)
def post_account_request_cancel(
    request_id: UUID,
    data: AccountRequestAction,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> AccountRequestOut:
    return cancel_account_request(
        db, user, request_id, reason=data.reason, idempotency_key=idempotency_key
    )


@router.post("/requests/{request_id}/close", response_model=AccountRequestOut)
def post_account_request_close(
    request_id: UUID,
    data: AccountRequestClose,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> AccountRequestOut:
    return close_account_request(
        db, user, request_id, outcome=data.outcome, reason=data.reason,
        idempotency_key=idempotency_key,
    )


@router.post("/requests/{request_id}/remind", response_model=AccountRequestOut)
def post_account_request_remind(
    request_id: UUID,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> AccountRequestOut:
    return remind_account_request(
        db, user, request_id, idempotency_key=idempotency_key
    )
