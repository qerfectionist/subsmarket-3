import uuid
from datetime import timedelta

from subsmarket.core.database import SessionLocal, utcnow
from subsmarket.families.models import (
    Family,
    FamilyRequest,
)
from subsmarket.identity.models import User
from subsmarket.marketplace.account_models import (
    MarketplaceAccountListing,
    MarketplaceAccountRequest,
)
from subsmarket.marketplace.models import (
    MarketplaceListing,
    MarketplaceListingRequest,
)


def seed_test_incoming():
    with SessionLocal() as db:
        buyers = {}
        for uid, uname, first_name in [
            (200003, "serik_buyer", "Серик"),
            (200004, "aida_buyer", "Аида"),
            (200005, "dana_buyer", "Дана"),
            (200006, "marat_buyer", "Марат")
        ]:
            b = db.query(User).filter_by(telegram_user_id=uid).first()
            if not b:
                b = User(
                    id=uuid.uuid4(),
                    telegram_user_id=uid,
                    username=uname,
                    first_name=first_name,
                    status="active"
                )
                db.add(b)
                db.flush()
            buyers[uname] = b

        now = utcnow()
        target_uids = [200001, 200002]
        target_users = (
            db.query(User).filter(User.telegram_user_id.in_(target_uids)).all()
        )

        for user in target_users:
            print(
                f"Seeding incoming cards for {user.username} "
                f"({user.telegram_user_id})..."
            )

            # 1. GB Listings
            gb_listings = (
                db.query(MarketplaceListing).filter_by(seller_user_id=user.id).all()
            )
            if gb_listings:
                l1 = gb_listings[0]
                buyer = buyers["serik_buyer"]
                req1 = (
                    db.query(MarketplaceListingRequest)
                    .filter_by(
                        listing_id=l1.id, buyer_user_id=buyer.id, status="pending"
                    )
                    .first()
                )
                if not req1:
                    req1 = MarketplaceListingRequest(
                        id=uuid.uuid4(),
                        listing_id=l1.id,
                        buyer_user_id=buyer.id,
                        amount_gb_snapshot=10,
                        price_per_gb_kzt_snapshot=l1.price_per_gb_kzt,
                        total_price_kzt_snapshot=10 * l1.price_per_gb_kzt,
                        operator_slug_snapshot=(
                            l1.operator.slug if l1.operator else "tele2"
                        ),
                        operator_name_snapshot=(
                            l1.operator.name if l1.operator else "Tele2"
                        ),
                        status="pending",
                        created_at=now - timedelta(minutes=3),
                    )
                    db.add(req1)
                else:
                    req1.created_at = now - timedelta(minutes=3)

                l2 = gb_listings[1] if len(gb_listings) > 1 else l1
                buyer2 = buyers["aida_buyer"]
                req2 = (
                    db.query(MarketplaceListingRequest)
                    .filter_by(
                        listing_id=l2.id, buyer_user_id=buyer2.id, status="accepted"
                    )
                    .first()
                )
                if not req2:
                    req2 = MarketplaceListingRequest(
                        id=uuid.uuid4(),
                        listing_id=l2.id,
                        buyer_user_id=buyer2.id,
                        amount_gb_snapshot=5,
                        price_per_gb_kzt_snapshot=l2.price_per_gb_kzt,
                        total_price_kzt_snapshot=5 * l2.price_per_gb_kzt,
                        operator_slug_snapshot=(
                            l2.operator.slug if l2.operator else "altel"
                        ),
                        operator_name_snapshot=(
                            l2.operator.name if l2.operator else "Altel"
                        ),
                        status="accepted",
                        created_at=now - timedelta(minutes=20),
                        decided_at=now - timedelta(minutes=15),
                    )
                    db.add(req2)
                else:
                    req2.created_at = now - timedelta(minutes=20)
                    req2.decided_at = now - timedelta(minutes=15)

            # 2. Account Listings
            acc_listings = (
                db.query(MarketplaceAccountListing)
                .filter_by(seller_user_id=user.id)
                .all()
            )
            if acc_listings:
                a1 = acc_listings[0]
                buyer_a1 = buyers["dana_buyer"]
                req_acc1 = (
                    db.query(MarketplaceAccountRequest)
                    .filter_by(
                        listing_id=a1.id, buyer_user_id=buyer_a1.id, status="pending"
                    )
                    .first()
                )
                if not req_acc1:
                    req_acc1 = MarketplaceAccountRequest(
                        id=uuid.uuid4(),
                        listing_id=a1.id,
                        buyer_user_id=buyer_a1.id,
                        title_snapshot=a1.title,
                        price_kzt_snapshot=a1.price_kzt,
                        service_slug_snapshot=(
                            a1.service.slug if a1.service else "canva"
                        ),
                        service_name_snapshot=(
                            a1.service.name if a1.service else "Canva"
                        ),
                        status="pending",
                        created_at=now - timedelta(minutes=6),
                    )
                    db.add(req_acc1)
                else:
                    req_acc1.created_at = now - timedelta(minutes=6)

                a2 = acc_listings[1] if len(acc_listings) > 1 else a1
                buyer_a2 = buyers["marat_buyer"]
                req_acc2 = (
                    db.query(MarketplaceAccountRequest)
                    .filter_by(
                        listing_id=a2.id, buyer_user_id=buyer_a2.id, status="accepted"
                    )
                    .first()
                )
                if not req_acc2:
                    req_acc2 = MarketplaceAccountRequest(
                        id=uuid.uuid4(),
                        listing_id=a2.id,
                        buyer_user_id=buyer_a2.id,
                        title_snapshot=a2.title,
                        price_kzt_snapshot=a2.price_kzt,
                        service_slug_snapshot=(
                            a2.service.slug if a2.service else "gemini"
                        ),
                        service_name_snapshot=(
                            a2.service.name if a2.service else "Gemini"
                        ),
                        status="accepted",
                        created_at=now - timedelta(minutes=30),
                        decided_at=now - timedelta(minutes=25),
                    )
                    db.add(req_acc2)
                else:
                    req_acc2.created_at = now - timedelta(minutes=30)
                    req_acc2.decided_at = now - timedelta(minutes=25)

            # 3. Family Request
            fams = (
                db.query(Family)
                .filter_by(owner_user_id=user.id, status="active")
                .all()
            )
            if fams:
                f1 = fams[0]
                buyer_fam = (
                    buyers["dana_buyer"]
                    if user.telegram_user_id == 200001
                    else buyers["serik_buyer"]
                )
                existing_freq = (
                    db.query(FamilyRequest)
                    .filter_by(
                        family_id=f1.id, user_id=buyer_fam.id, status="pending"
                    )
                    .first()
                )
                if not existing_freq:
                    fam_req = FamilyRequest(
                        id=uuid.uuid4(),
                        family_id=f1.id,
                        user_id=buyer_fam.id,
                        status="pending",
                        created_at=now - timedelta(minutes=2),
                        expires_at=now + timedelta(hours=5),
                    )
                    db.add(fam_req)
                else:
                    existing_freq.created_at = now - timedelta(minutes=2)
                    existing_freq.expires_at = now + timedelta(hours=5)

        db.commit()
        print("SUCCESSFULLY SEEDED FOR BOTH OWNER AND MEMBER!")

if __name__ == "__main__":
    seed_test_incoming()
