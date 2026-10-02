"""Unified Development Database Seeder for SubsMarket 3.0.

Populates PostgreSQL with realistic multi-role scenarios:
- Demo Owner (200001): families, listings, incoming requests
- Demo Member (200002): active memberships, payment reports
- Demo Newbie (200003): pending requests to join
"""
from __future__ import annotations

import os
import sys
import uuid
from datetime import timedelta
from decimal import Decimal

# Ensure python path sees backend/src
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "src")))

from sqlalchemy import select
from sqlalchemy.orm import Session

from subsmarket.catalog.models import FamilyService
from subsmarket.catalog.service import import_family_services
from subsmarket.core.config import settings
from subsmarket.core.database import SessionLocal, utcnow
from subsmarket.families.models import Family, FamilyPayment
from subsmarket.families.schemas import FamilyCreate
from subsmarket.families.service import (
    approve_join_request,
    confirm_access_received,
    create_family,
    create_join_request,
    mark_access_provided,
    report_payment_paid,
)
from subsmarket.identity.models import User
from subsmarket.marketplace.account_models import (
    MarketplaceAccountListing,
    MarketplaceAccountRequest,
    MarketplaceAccountService,
)
from subsmarket.marketplace.bootstrap import ensure_development_marketplace_catalog
from subsmarket.marketplace.models import (
    MarketplaceListing,
    MarketplaceListingRequest,
    MarketplaceOperator,
)


def ensure_users(db: Session) -> dict[str, User]:
    user_specs = [
        (200001, "demo_owner", "Айназ", "Owner"),
        (200002, "demo_member", "Баха", "Member"),
        (200003, "demo_newbie", "Дамир", "Newbie"),
        (200004, "aida_buyer", "Аида", "Buyer"),
        (200005, "serik_buyer", "Серик", "Buyer"),
    ]
    users: dict[str, User] = {}
    for uid, username, first_name, role in user_specs:
        user = db.scalar(select(User).where(User.telegram_user_id == uid))
        if not user:
            user = User(
                id=uuid.uuid4(),
                telegram_user_id=uid,
                username=username,
                first_name=f"{first_name} ({role})",
                status="active",
            )
            db.add(user)
            db.flush()
        users[username] = user
    return users


def seed_families(db: Session, users: dict[str, User]) -> None:
    owner = users["demo_owner"]
    member = users["demo_member"]
    newbie = users["demo_newbie"]

    services = db.scalars(select(FamilyService).where(FamilyService.status == "active")).all()
    if not services:
        import_family_services(db, settings.catalog_file, activate_demo=True)
        services = db.scalars(select(FamilyService).where(FamilyService.status == "active")).all()

    yt_service = next((s for s in services if "youtube" in s.slug.lower()), services[0] if services else None)
    spotify_service = next((s for s in services if "spotify" in s.slug.lower()), None)
    apple_service = next((s for s in services if "apple" in s.slug.lower()), None)

    today = utcnow().date()

    # 1. Active YouTube Family with Member & Pending Newbie
    if yt_service:
        existing_yt = db.scalar(select(Family).where(Family.service_id == yt_service.id))
        if not existing_yt:
            payload = FamilyCreate(
                service_id=yt_service.id,
                plan_name=None,
                max_members=5,
                total_price_kzt=2500,
                payment_day=15,
                next_payment_date=today + timedelta(days=12),
                payment_phone="+77011112233",
                payment_bank="kaspi",
            )
            yt_family = create_family(db, owner, payload)
            db.flush()

            # Member joins and gets access
            req1 = create_join_request(db, yt_family.id, member)
            db.flush()
            m1 = approve_join_request(db, req1.id, owner.id)
            db.flush()
            mark_access_provided(db, yt_family.id, m1.id, owner.id)
            db.flush()
            confirm_access_received(db, yt_family.id, m1.id, member.id)
            db.flush()

            # Newbie sends pending join request
            create_join_request(db, yt_family.id, newbie)
            db.flush()

    # 2. Spotify Family with reported payment waiting confirmation
    if spotify_service:
        existing_spot = db.scalar(select(Family).where(Family.service_id == spotify_service.id))
        if not existing_spot:
            payload = FamilyCreate(
                service_id=spotify_service.id,
                plan_name=None,
                max_members=6,
                total_price_kzt=2800,
                payment_day=5,
                next_payment_date=today + timedelta(days=2),
                payment_phone="+77011112233",
                payment_bank="kaspi",
            )
            spot_family = create_family(db, owner, payload)
            db.flush()

            # Member joins, gets access and reports payment
            req2 = create_join_request(db, spot_family.id, member)
            db.flush()
            m2 = approve_join_request(db, req2.id, owner.id)
            db.flush()
            mark_access_provided(db, spot_family.id, m2.id, owner.id)
            db.flush()
            confirm_access_received(db, spot_family.id, m2.id, member.id)
            db.flush()

            payment = db.scalar(select(FamilyPayment).where(FamilyPayment.family_id == spot_family.id, FamilyPayment.member_id == m2.id))
            if payment and payment.status == "pending":
                report_payment_paid(db, payment.id, member.id)
                db.flush()

    # 3. Apple One Family owned by member
    if apple_service:
        existing_apple = db.scalar(select(Family).where(Family.service_id == apple_service.id))
        if not existing_apple:
            plan_name = "Семейный" if getattr(apple_service, "family_type", "") == "tariff" else None
            payload = FamilyCreate(
                service_id=apple_service.id,
                plan_name=plan_name,
                max_members=4,
                total_price_kzt=3500,
                payment_day=20,
                next_payment_date=today + timedelta(days=17),
                payment_phone="+77022223344",
                payment_bank="halyk",
            )
            create_family(db, member, payload)
            db.flush()


def seed_marketplace(db: Session, users: dict[str, User]) -> None:
    owner = users["demo_owner"]
    buyer_aida = users["aida_buyer"]
    buyer_serik = users["serik_buyer"]

    ensure_development_marketplace_catalog(db)
    now = utcnow()

    # GB Listing
    tele2 = db.scalar(select(MarketplaceOperator).where(MarketplaceOperator.slug == "tele2"))
    if tele2:
        existing_gb = db.scalar(select(MarketplaceListing).where(MarketplaceListing.seller_user_id == owner.id))
        if not existing_gb:
            gb_listing = MarketplaceListing(
                id=uuid.uuid4(),
                seller_user_id=owner.id,
                operator_id=tele2.id,
                gb_amount=Decimal("25.00"),
                price_kzt=3000,
                phone_prefix="+7 707",
                status="active",
                expires_at=now + timedelta(days=7),
            )
            db.add(gb_listing)
            db.flush()

            # Add incoming request
            req = MarketplaceListingRequest(
                id=uuid.uuid4(),
                listing_id=gb_listing.id,
                buyer_user_id=buyer_aida.id,
                buyer_phone="+7 707 123 4567",
                status="pending",
                expires_at=now + timedelta(hours=24),
            )
            db.add(req)
            db.flush()

    # Account Listing
    chatgpt = db.scalar(select(MarketplaceAccountService).where(MarketplaceAccountService.slug == "chatgpt-plus"))
    if chatgpt:
        existing_acc = db.scalar(select(MarketplaceAccountListing).where(MarketplaceAccountListing.seller_user_id == owner.id))
        if not existing_acc:
            acc_listing = MarketplaceAccountListing(
                id=uuid.uuid4(),
                seller_user_id=owner.id,
                service_id=chatgpt.id,
                title="ChatGPT Plus 1 месяц (Личный)",
                price_kzt=9500,
                status="active",
                expires_at=now + timedelta(days=30),
            )
            db.add(acc_listing)
            db.flush()

            # Add incoming request
            req_acc = MarketplaceAccountRequest(
                id=uuid.uuid4(),
                listing_id=acc_listing.id,
                buyer_user_id=buyer_serik.id,
                status="pending",
                expires_at=now + timedelta(hours=24),
            )
            db.add(req_acc)
            db.flush()


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("[SubsMarket 3.0] Seeding development database...")
    with SessionLocal() as db:
        users = ensure_users(db)
        print(f"  + Users verified: {', '.join(users.keys())}")

        seed_families(db, users)
        print("  + Families seeded (Active, Reported Payment, Open Slots, Pending Requests)")

        seed_marketplace(db, users)
        print("  + Marketplace seeded (GB & Accounts with incoming buyer requests)")

        db.commit()
    print("SUCCESS: Seed completed! Environment is ready for multi-role testing.")


if __name__ == "__main__":
    main()
