from datetime import timedelta
from decimal import Decimal
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "src")))

from sqlalchemy import delete, select

from subsmarket.core.database import SessionLocal, utcnow
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


def seed_actions() -> None:
    now = utcnow()
    expires_7d = now + timedelta(days=7)
    expires_30d = now + timedelta(days=30)

    with SessionLocal() as db:
        # 1. Ensure catalog
        ensure_development_marketplace_catalog(db)

        # Ensure operators
        tele2_op = db.scalar(
            select(MarketplaceOperator).where(MarketplaceOperator.slug == "tele2")
        )
        altel_op = db.scalar(
            select(MarketplaceOperator).where(MarketplaceOperator.slug == "altel")
        )
        beeline_op = db.scalar(
            select(MarketplaceOperator).where(MarketplaceOperator.slug == "beeline")
        )
        kcell_op = db.scalar(
            select(MarketplaceOperator).where(MarketplaceOperator.slug == "kcell")
        )
        if not tele2_op:
            tele2_op = MarketplaceOperator(
                slug="tele2",
                name="Tele2",
                is_active=True,
                min_lot_gb=Decimal("1.00"),
                max_lot_gb=Decimal("50.00"),
                amount_step_gb=Decimal("1.00"),
            )
            db.add(tele2_op)
            db.flush()
        if not altel_op:
            altel_op = MarketplaceOperator(
                slug="altel",
                name="Altel",
                is_active=True,
                min_lot_gb=Decimal("1.00"),
                max_lot_gb=Decimal("50.00"),
                amount_step_gb=Decimal("1.00"),
            )
            db.add(altel_op)
            db.flush()
        if not beeline_op:
            beeline_op = MarketplaceOperator(
                slug="beeline",
                name="Beeline",
                is_active=True,
                min_lot_gb=Decimal("1.00"),
                max_lot_gb=Decimal("50.00"),
                amount_step_gb=Decimal("1.00"),
            )
            db.add(beeline_op)
            db.flush()
        if not kcell_op:
            kcell_op = MarketplaceOperator(
                slug="kcell",
                name="Kcell",
                is_active=True,
                min_lot_gb=Decimal("1.00"),
                max_lot_gb=Decimal("50.00"),
                amount_step_gb=Decimal("1.00"),
            )
            db.add(kcell_op)
            db.flush()

        canva_svc = db.scalar(
            select(MarketplaceAccountService).where(MarketplaceAccountService.slug == "canva")
        )
        gemini_svc = db.scalar(
            select(MarketplaceAccountService).where(MarketplaceAccountService.slug == "gemini")
        )

        # 2. Ensure users
        owner = db.scalar(select(User).where(User.telegram_user_id == 200001))
        if not owner:
            owner = User(
                telegram_user_id=200001,
                username="demo_owner",
                first_name="Demo Owner",
            )
            db.add(owner)
            db.flush()

        member = db.scalar(select(User).where(User.telegram_user_id == 200002))
        if not member:
            member = User(
                telegram_user_id=200002,
                username="demo_member",
                first_name="Demo Member",
            )
            db.add(member)
            db.flush()

        buyer2 = db.scalar(select(User).where(User.telegram_user_id == 200003))
        if not buyer2:
            buyer2 = User(
                telegram_user_id=200003,
                username="serik_buyer",
                first_name="Серик",
            )
            db.add(buyer2)
            db.flush()

        # Find real user if exists (e.g. qauqar)
        real_user = db.scalar(select(User).where(User.telegram_user_id == 5099029851))

        sellers = [owner, member]
        if real_user and real_user.id not in (owner.id, member.id):
            sellers.append(real_user)

        for seller in sellers:
            print(f"Seeding test listings and requests for seller: {seller.username} (ID {seller.telegram_user_id})")
            b1 = owner if seller.id == member.id else member
            b2 = buyer2

            # --- A. Gigabytes Listings ---
            # Tele2 listing
            tele2_listing = db.scalar(
                select(MarketplaceListing).where(
                    MarketplaceListing.seller_user_id == seller.id,
                    MarketplaceListing.operator_id == tele2_op.id,
                    MarketplaceListing.status.in_(["active", "paused"]),
                )
            )
            if not tele2_listing:
                tele2_listing = MarketplaceListing(
                    seller_user_id=seller.id,
                    operator_id=tele2_op.id,
                    listing_type="mobile_data",
                    price_per_gb_kzt=100,
                    description="Tele2 ГБ по выгодной цене. Перевод сразу после подтверждения.",
                    status="active",
                    published_at=now,
                    expires_at=expires_7d,
                )
                db.add(tele2_listing)
                db.flush()

            # Altel listing
            altel_listing = db.scalar(
                select(MarketplaceListing).where(
                    MarketplaceListing.seller_user_id == seller.id,
                    MarketplaceListing.operator_id == altel_op.id,
                    MarketplaceListing.status.in_(["active", "paused"]),
                )
            )
            if not altel_listing:
                altel_listing = MarketplaceListing(
                    seller_user_id=seller.id,
                    operator_id=altel_op.id,
                    listing_type="mobile_data",
                    price_per_gb_kzt=120,
                    description="Altel 4G/5G быстрый перевод трафика.",
                    status="active",
                    published_at=now,
                    expires_at=expires_7d,
                )
                db.add(altel_listing)
                db.flush()

            # Beeline listing
            beeline_listing = db.scalar(
                select(MarketplaceListing).where(
                    MarketplaceListing.seller_user_id == seller.id,
                    MarketplaceListing.operator_id == beeline_op.id,
                    MarketplaceListing.status.in_(["active", "paused"]),
                )
            )
            if not beeline_listing:
                beeline_listing = MarketplaceListing(
                    seller_user_id=seller.id,
                    operator_id=beeline_op.id,
                    listing_type="mobile_data",
                    price_per_gb_kzt=110,
                    description="Beeline интернет трафик онлайн.",
                    status="active",
                    published_at=now,
                    expires_at=expires_7d,
                )
                db.add(beeline_listing)
                db.flush()

            # Clean existing active requests for these listings to avoid unique constraint
            db.execute(
                delete(MarketplaceListingRequest).where(
                    MarketplaceListingRequest.listing_id.in_([tele2_listing.id, altel_listing.id, beeline_listing.id]),
                    MarketplaceListingRequest.buyer_user_id.in_([b1.id, b2.id]),
                    MarketplaceListingRequest.status.in_(["pending", "accepted"]),
                )
            )
            db.flush()

            # Add GB Request 1: Tele2 5 GB from b1 (PENDING) -> To Approve
            db.add(
                MarketplaceListingRequest(
                    listing_id=tele2_listing.id,
                    buyer_user_id=b1.id,
                    status="pending",
                    operator_slug_snapshot="tele2",
                    operator_name_snapshot="Tele2",
                    amount_gb_snapshot=Decimal("5.00"),
                    price_per_gb_kzt_snapshot=100,
                    total_price_kzt_snapshot=500,
                    created_at=now - timedelta(minutes=15),
                )
            )

            # Add GB Request 2: Altel 10 GB from b2 (PENDING) -> To Reject
            db.add(
                MarketplaceListingRequest(
                    listing_id=altel_listing.id,
                    buyer_user_id=b2.id,
                    status="pending",
                    operator_slug_snapshot="altel",
                    operator_name_snapshot="Altel",
                    amount_gb_snapshot=Decimal("10.00"),
                    price_per_gb_kzt_snapshot=120,
                    total_price_kzt_snapshot=1200,
                    created_at=now - timedelta(minutes=5),
                )
            )

            # Add GB Request 3: Beeline 15 GB from b1 (PENDING)
            db.add(
                MarketplaceListingRequest(
                    listing_id=beeline_listing.id,
                    buyer_user_id=b1.id,
                    status="pending",
                    operator_slug_snapshot="beeline",
                    operator_name_snapshot="Beeline",
                    amount_gb_snapshot=Decimal("15.00"),
                    price_per_gb_kzt_snapshot=110,
                    total_price_kzt_snapshot=1650,
                    created_at=now - timedelta(minutes=2),
                )
            )

            # --- B. Account Listings ---
            if canva_svc:
                canva_listing = db.scalar(
                    select(MarketplaceAccountListing).where(
                        MarketplaceAccountListing.seller_user_id == seller.id,
                        MarketplaceAccountListing.service_id == canva_svc.id,
                        MarketplaceAccountListing.status.in_(["active", "paused"]),
                    )
                )
                if not canva_listing:
                    canva_listing = MarketplaceAccountListing(
                        seller_user_id=seller.id,
                        service_id=canva_svc.id,
                        title="Canva Pro годовая подписка",
                        price_kzt=2490,
                        description="Приглашение в команду Canva Pro без смены вашей почты.",
                        status="active",
                        published_at=now,
                        expires_at=expires_30d,
                    )
                    db.add(canva_listing)
                    db.flush()

                # Clean active requests for canva
                db.execute(
                    delete(MarketplaceAccountRequest).where(
                        MarketplaceAccountRequest.listing_id == canva_listing.id,
                        MarketplaceAccountRequest.buyer_user_id.in_([b1.id, b2.id]),
                        MarketplaceAccountRequest.status.in_(["pending", "accepted"]),
                    )
                )
                db.flush()

                # Add Account Request 1: Canva Pro from b1 (PENDING) -> To Approve
                db.add(
                    MarketplaceAccountRequest(
                        listing_id=canva_listing.id,
                        buyer_user_id=b1.id,
                        status="pending",
                        service_slug_snapshot="canva",
                        service_name_snapshot="Canva",
                        title_snapshot=canva_listing.title,
                        price_kzt_snapshot=canva_listing.price_kzt,
                        created_at=now - timedelta(minutes=25),
                    )
                )

            if gemini_svc:
                gemini_listing = db.scalar(
                    select(MarketplaceAccountListing).where(
                        MarketplaceAccountListing.seller_user_id == seller.id,
                        MarketplaceAccountListing.service_id == gemini_svc.id,
                        MarketplaceAccountListing.status.in_(["active", "paused"]),
                    )
                )
                if not gemini_listing:
                    gemini_listing = MarketplaceAccountListing(
                        seller_user_id=seller.id,
                        service_id=gemini_svc.id,
                        title="Gemini Advanced на 1 месяц",
                        price_kzt=1890,
                        description="Личный аккаунт с 2 ТБ Google One и Gemini 1.5 Pro.",
                        status="active",
                        published_at=now,
                        expires_at=expires_30d,
                    )
                    db.add(gemini_listing)
                    db.flush()

                # Clean active requests for gemini
                db.execute(
                    delete(MarketplaceAccountRequest).where(
                        MarketplaceAccountRequest.listing_id == gemini_listing.id,
                        MarketplaceAccountRequest.buyer_user_id.in_([b1.id, b2.id]),
                        MarketplaceAccountRequest.status.in_(["pending", "accepted"]),
                    )
                )
                db.flush()

                # Add Account Request 2: Gemini Advanced from b2 (PENDING) -> To Reject
                db.add(
                    MarketplaceAccountRequest(
                        listing_id=gemini_listing.id,
                        buyer_user_id=b2.id,
                        status="pending",
                        service_slug_snapshot="gemini",
                        service_name_snapshot="Gemini",
                        title_snapshot=gemini_listing.title,
                        price_kzt_snapshot=gemini_listing.price_kzt,
                        created_at=now - timedelta(minutes=10),
                    )
                )

        db.commit()
        print("Successfully seeded test listings and pending requests!")


if __name__ == "__main__":
    seed_actions()
