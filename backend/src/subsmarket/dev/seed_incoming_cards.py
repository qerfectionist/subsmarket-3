import uuid
from datetime import timedelta

from sqlalchemy.orm import Session

from subsmarket.catalog.models import FamilyService
from subsmarket.core.database import SessionLocal, kz_today, utcnow
from subsmarket.dev.cleanup import clean_all_cards, clean_archive
from subsmarket.families.models import Family, FamilyMember, FamilyRequest
from subsmarket.identity.models import User
from subsmarket.marketplace.account_models import (
    MarketplaceAccountListing,
    MarketplaceAccountRequest,
    MarketplaceAccountService,
)
from subsmarket.marketplace.models import (
    MarketplaceListing,
    MarketplaceListingRequest,
    MarketplaceOperator,
)

TARGET_UIDS = [5099029851, 200001, 200002]


def _ensure_buyers(db: Session) -> dict[str, User]:
    buyers = {}
    for uid, uname, first_name in [
        (200003, "serik_buyer", "Серик"),
        (200004, "aida_buyer", "Аида"),
        (200005, "dana_buyer", "Дана"),
        (200006, "marat_buyer", "Марат"),
    ]:
        b = db.query(User).filter_by(telegram_user_id=uid).first()
        if not b:
            b = User(
                id=uuid.uuid4(),
                telegram_user_id=uid,
                username=uname,
                first_name=first_name,
                status="active",
            )
            db.add(b)
            db.flush()
        buyers[uname] = b
    return buyers


def _ensure_seller(db: Session) -> User:
    seller = db.query(User).filter_by(telegram_user_id=920001).first()
    if not seller:
        seller = User(
            id=uuid.uuid4(),
            telegram_user_id=920001,
            username="demo_gb_seller",
            first_name="Seller",
            status="active",
        )
        db.add(seller)
        db.flush()
    return seller


def seed_test_incoming(db: Session | None = None) -> dict[str, int]:
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        now = utcnow()
        today = kz_today()
        buyers = _ensure_buyers(db)
        seller = _ensure_seller(db)
        counts = {"gb": 0, "accounts": 0, "families": 0}

        tele2 = db.query(MarketplaceOperator).filter_by(slug="tele2").first()
        altel = db.query(MarketplaceOperator).filter_by(slug="altel").first() or tele2
        canva = db.query(MarketplaceAccountService).filter_by(slug="canva").first()
        chatgpt = (
            db.query(MarketplaceAccountService).filter_by(slug="chatgpt").first()
            or canva
        )
        spotify_svc = (
            db.query(FamilyService).filter_by(slug="spotify-family").first()
            or db.query(FamilyService).first()
        )
        youtube_svc = (
            db.query(FamilyService).filter_by(slug="youtube-premium").first()
            or spotify_svc
        )

        for uid in TARGET_UIDS:
            user = db.query(User).filter_by(telegram_user_id=uid).first()
            if not user:
                continue

            # 1. Ensure user has GB listing + seed incoming request
            gb_listing = (
                db.query(MarketplaceListing)
                .filter_by(seller_user_id=user.id, status="active")
                .first()
            )
            if not gb_listing and tele2:
                gb_listing = MarketplaceListing(
                    id=uuid.uuid4(),
                    seller_user_id=user.id,
                    operator_id=tele2.id,
                    price_per_gb_kzt=350,
                    status="active",
                    expires_at=now + timedelta(days=30),
                    published_at=now - timedelta(hours=2),
                    created_at=now - timedelta(hours=2),
                )
                db.add(gb_listing)
                db.flush()

            if gb_listing:
                db.add(
                    MarketplaceListingRequest(
                        id=uuid.uuid4(),
                        listing_id=gb_listing.id,
                        buyer_user_id=buyers["serik_buyer"].id,
                        amount_gb_snapshot=10,
                        price_per_gb_kzt_snapshot=gb_listing.price_per_gb_kzt,
                        total_price_kzt_snapshot=10 * gb_listing.price_per_gb_kzt,
                        operator_slug_snapshot=(
                            gb_listing.operator.slug if gb_listing.operator else "tele2"
                        ),
                        operator_name_snapshot=(
                            gb_listing.operator.name if gb_listing.operator else "Tele2"
                        ),
                        status="pending",
                        created_at=now - timedelta(minutes=2),
                    )
                )
                counts["gb"] += 1

            # 2. Ensure user has Account listing + seed incoming request
            acc_listing = (
                db.query(MarketplaceAccountListing)
                .filter_by(seller_user_id=user.id, status="active")
                .first()
            )
            if not acc_listing and canva:
                acc_listing = MarketplaceAccountListing(
                    id=uuid.uuid4(),
                    seller_user_id=user.id,
                    service_id=canva.id,
                    title="Canva Pro (1 месяц)",
                    price_kzt=1500,
                    status="active",
                    created_at=now - timedelta(hours=2),
                    expires_at=now + timedelta(days=30),
                )
                db.add(acc_listing)
                db.flush()

            if acc_listing:
                db.add(
                    MarketplaceAccountRequest(
                        id=uuid.uuid4(),
                        listing_id=acc_listing.id,
                        buyer_user_id=buyers["dana_buyer"].id,
                        title_snapshot=acc_listing.title,
                        price_kzt_snapshot=acc_listing.price_kzt,
                        service_slug_snapshot=(
                            acc_listing.service.slug if acc_listing.service else "canva"
                        ),
                        service_name_snapshot=(
                            acc_listing.service.name if acc_listing.service else "Canva"
                        ),
                        status="pending",
                        created_at=now - timedelta(minutes=3),
                    )
                )
                counts["accounts"] += 1

            # 3. Ensure user has Family + seed incoming candidate request
            family = (
                db.query(Family)
                .filter_by(owner_user_id=user.id, status="active")
                .first()
            )
            if not family and spotify_svc:
                family = Family(
                    id=uuid.uuid4(),
                    owner_user_id=user.id,
                    service_id=spotify_svc.id,
                    family_type=spotify_svc.family_type,
                    plan_name=spotify_svc.name,
                    status="active",
                    is_search_visible=True,
                    period="monthly",
                    max_members=6,
                    active_members_count=1,
                    has_been_full=False,
                    total_price_kzt=4800,
                    member_share_kzt=800,
                    rounding_delta_kzt=0,
                    payment_day=15,
                    next_payment_date=today + timedelta(days=20),
                    created_at=now - timedelta(hours=3),
                )
                db.add(family)
                db.flush()
                db.add(
                    FamilyMember(
                        id=uuid.uuid4(),
                        family_id=family.id,
                        user_id=user.id,
                        role="owner",
                        status="active",
                        joined_at=now - timedelta(hours=3),
                    )
                )
                db.flush()

            if family:
                db.add(
                    FamilyRequest(
                        id=uuid.uuid4(),
                        family_id=family.id,
                        user_id=buyers["aida_buyer"].id,
                        status="pending",
                        created_at=now - timedelta(minutes=1),
                        expires_at=now + timedelta(hours=5),
                    )
                )
                counts["families"] += 1

        # Outbox purchases (user as buyer)
        ext_gb = (
            db.query(MarketplaceListing)
            .filter_by(seller_user_id=seller.id, status="active")
            .first()
        )
        if not ext_gb and altel:
            ext_gb = MarketplaceListing(
                id=uuid.uuid4(),
                seller_user_id=seller.id,
                operator_id=altel.id,
                price_per_gb_kzt=300,
                status="active",
                expires_at=now + timedelta(days=30),
                published_at=now,
                created_at=now,
            )
            db.add(ext_gb)
            db.flush()

        ext_acc = (
            db.query(MarketplaceAccountListing)
            .filter_by(seller_user_id=seller.id, status="active")
            .first()
        )
        if not ext_acc and chatgpt:
            ext_acc = MarketplaceAccountListing(
                id=uuid.uuid4(),
                seller_user_id=seller.id,
                service_id=chatgpt.id,
                title="ChatGPT Plus на 1 месяц",
                price_kzt=3490,
                status="active",
                expires_at=now + timedelta(days=30),
                created_at=now,
            )
            db.add(ext_acc)
            db.flush()

        target_ids = [
            u.id
            for u in db.query(User).filter(User.telegram_user_id.in_(TARGET_UIDS)).all()
        ]
        ext_fam = (
            db.query(Family)
            .filter(~Family.owner_user_id.in_(target_ids), Family.status == "active")
            .first()
        )
        if not ext_fam and youtube_svc:
            ext_fam = Family(
                id=uuid.uuid4(),
                owner_user_id=seller.id,
                service_id=youtube_svc.id,
                family_type=youtube_svc.family_type,
                plan_name=youtube_svc.name,
                status="active",
                is_search_visible=True,
                period="monthly",
                max_members=6,
                active_members_count=1,
                has_been_full=False,
                total_price_kzt=7200,
                member_share_kzt=1200,
                rounding_delta_kzt=0,
                payment_day=10,
                next_payment_date=today + timedelta(days=15),
                created_at=now,
            )
            db.add(ext_fam)
            db.flush()
            db.add(
                FamilyMember(
                    id=uuid.uuid4(),
                    family_id=ext_fam.id,
                    user_id=seller.id,
                    role="owner",
                    status="active",
                    joined_at=now,
                )
            )
            db.flush()

        for uid in TARGET_UIDS:
            user = db.query(User).filter_by(telegram_user_id=uid).first()
            if not user:
                continue

            if ext_gb:
                db.add(
                    MarketplaceListingRequest(
                        id=uuid.uuid4(),
                        listing_id=ext_gb.id,
                        buyer_user_id=user.id,
                        amount_gb_snapshot=20,
                        price_per_gb_kzt_snapshot=ext_gb.price_per_gb_kzt,
                        total_price_kzt_snapshot=20 * ext_gb.price_per_gb_kzt,
                        operator_slug_snapshot=(
                            ext_gb.operator.slug if ext_gb.operator else "altel"
                        ),
                        operator_name_snapshot=(
                            ext_gb.operator.name if ext_gb.operator else "Altel"
                        ),
                        status="pending",
                        created_at=now - timedelta(minutes=2),
                    )
                )
                db.add(
                    MarketplaceListingRequest(
                        id=uuid.uuid4(),
                        listing_id=ext_gb.id,
                        buyer_user_id=user.id,
                        amount_gb_snapshot=15,
                        price_per_gb_kzt_snapshot=ext_gb.price_per_gb_kzt,
                        total_price_kzt_snapshot=15 * ext_gb.price_per_gb_kzt,
                        operator_slug_snapshot=(
                            ext_gb.operator.slug if ext_gb.operator else "altel"
                        ),
                        operator_name_snapshot=(
                            ext_gb.operator.name if ext_gb.operator else "Altel"
                        ),
                        status="rejected",
                        created_at=now - timedelta(hours=1),
                    )
                )

            if ext_acc:
                db.add(
                    MarketplaceAccountRequest(
                        id=uuid.uuid4(),
                        listing_id=ext_acc.id,
                        buyer_user_id=user.id,
                        title_snapshot=ext_acc.title,
                        price_kzt_snapshot=ext_acc.price_kzt,
                        service_slug_snapshot=(
                            ext_acc.service.slug if ext_acc.service else "chatgpt"
                        ),
                        service_name_snapshot=(
                            ext_acc.service.name if ext_acc.service else "ChatGPT"
                        ),
                        status="pending",
                        created_at=now - timedelta(minutes=3),
                    )
                )
                db.add(
                    MarketplaceAccountRequest(
                        id=uuid.uuid4(),
                        listing_id=ext_acc.id,
                        buyer_user_id=user.id,
                        title_snapshot=ext_acc.title,
                        price_kzt_snapshot=ext_acc.price_kzt,
                        service_slug_snapshot=(
                            ext_acc.service.slug if ext_acc.service else "chatgpt"
                        ),
                        service_name_snapshot=(
                            ext_acc.service.name if ext_acc.service else "ChatGPT"
                        ),
                        status="rejected",
                        created_at=now - timedelta(hours=2),
                    )
                )

            if ext_fam:
                db.add(
                    FamilyRequest(
                        id=uuid.uuid4(),
                        family_id=ext_fam.id,
                        user_id=user.id,
                        status="pending",
                        created_at=now - timedelta(minutes=1),
                        expires_at=now + timedelta(hours=5),
                    )
                )
                db.add(
                    FamilyRequest(
                        id=uuid.uuid4(),
                        family_id=ext_fam.id,
                        user_id=user.id,
                        status="rejected",
                        created_at=now - timedelta(hours=3),
                        expires_at=now - timedelta(hours=1),
                    )
                )

        db.commit()
        return counts
    finally:
        if close_db:
            db.close()


def reset_and_reseed_all(db: Session | None = None) -> dict[str, int]:
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        clean_archive(db)
        clean_all_cards(db)
        seeded = seed_test_incoming(db)
        return seeded
    finally:
        if close_db:
            db.close()


if __name__ == "__main__":
    res = reset_and_reseed_all()
    print("Reset and reseeded successfully:", res)
