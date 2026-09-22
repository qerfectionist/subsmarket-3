from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from subsmarket.core.database import utcnow
from subsmarket.families.models import (
    Family,
    FamilyAuditLog,
    FamilyMember,
    FamilyPayment,
    FamilyPaymentRequisite,
    FamilyRequest,
    FamilyRequestRestriction,
)
from subsmarket.identity.models import User
from subsmarket.marketplace.account_models import (
    MarketplaceAccountListing,
    MarketplaceAccountRequest,
    MarketplaceAccountService,
)
from subsmarket.marketplace.models import (
    MarketplaceListing,
    MarketplaceListingRequest,
)
from subsmarket.notifications.models import NotificationJob

DEMO_TELEGRAM_USER_IDS = [200001, 200002]


def cleanup_demo_data(db: Session) -> dict[str, int]:
    demo_users = list(
        db.scalars(
            select(User).where(User.telegram_user_id.in_(DEMO_TELEGRAM_USER_IDS))
        )
    )
    demo_user_ids = [user.id for user in demo_users]
    if not demo_user_ids:
        return {"users": 0, "families": 0}

    family_ids = list(
        db.scalars(select(Family.id).where(Family.owner_user_id.in_(demo_user_ids)))
    )
    marketplace_listing_ids = list(
        db.scalars(
            select(MarketplaceListing.id).where(
                MarketplaceListing.seller_user_id.in_(demo_user_ids)
            )
        )
    )
    marketplace_request_filter = MarketplaceListingRequest.buyer_user_id.in_(
        demo_user_ids
    )
    if marketplace_listing_ids:
        marketplace_request_filter = marketplace_request_filter | (
            MarketplaceListingRequest.listing_id.in_(marketplace_listing_ids)
        )
    db.execute(delete(MarketplaceListingRequest).where(marketplace_request_filter))
    if marketplace_listing_ids:
        db.execute(
            delete(MarketplaceListing).where(
                MarketplaceListing.id.in_(marketplace_listing_ids)
            )
        )
    account_listing_ids = list(
        db.scalars(
            select(MarketplaceAccountListing.id).where(
                MarketplaceAccountListing.seller_user_id.in_(demo_user_ids)
            )
        )
    )
    account_request_filter = MarketplaceAccountRequest.buyer_user_id.in_(demo_user_ids)
    if account_listing_ids:
        account_request_filter = account_request_filter | (
            MarketplaceAccountRequest.listing_id.in_(account_listing_ids)
        )
    db.execute(delete(MarketplaceAccountRequest).where(account_request_filter))
    if account_listing_ids:
        db.execute(
            delete(MarketplaceAccountListing).where(
                MarketplaceAccountListing.id.in_(account_listing_ids)
            )
        )
    if family_ids:
        db.execute(delete(FamilyPayment).where(FamilyPayment.family_id.in_(family_ids)))
        db.execute(delete(FamilyMember).where(FamilyMember.family_id.in_(family_ids)))
        db.execute(delete(FamilyRequest).where(FamilyRequest.family_id.in_(family_ids)))
        db.execute(
            delete(FamilyRequestRestriction).where(
                FamilyRequestRestriction.family_id.in_(family_ids)
            )
        )
        db.execute(
            delete(FamilyPaymentRequisite).where(
                FamilyPaymentRequisite.family_id.in_(family_ids)
            )
        )
        db.execute(
            delete(FamilyAuditLog).where(FamilyAuditLog.family_id.in_(family_ids))
        )
        db.execute(delete(Family).where(Family.id.in_(family_ids)))

    db.execute(
        delete(NotificationJob).where(
            NotificationJob.recipient_user_id.in_(demo_user_ids)
        )
    )
    db.execute(delete(User).where(User.id.in_(demo_user_ids)))
    db.commit()
    return {
        "users": len(demo_user_ids),
        "families": len(family_ids),
        "marketplace_listings": len(marketplace_listing_ids),
        "account_listings": len(account_listing_ids),
    }


def seed_demo_account_orders(db: Session) -> dict[str, int]:
    owner = db.scalar(select(User).where(User.telegram_user_id == 200001))
    member = db.scalar(select(User).where(User.telegram_user_id == 200002))
    if not owner or not member:
        return {"orders": 0}

    services = {
        s.slug: s for s in db.scalars(select(MarketplaceAccountService)).all()
    }
    gemini_svc = services.get("gemini")
    canva_svc = services.get("canva")
    chatgpt_svc = services.get("chatgpt")

    now = utcnow()
    expires = now + timedelta(days=30)

    gemini_listing = None
    if gemini_svc:
        gemini_listing = db.scalar(
            select(MarketplaceAccountListing).where(
                MarketplaceAccountListing.seller_user_id == owner.id,
                MarketplaceAccountListing.service_id == gemini_svc.id,
            )
        )
        if not gemini_listing:
            gemini_listing = MarketplaceAccountListing(
                seller_user_id=owner.id,
                service_id=gemini_svc.id,
                title="Gemini Advanced на 1 месяц",
                price_kzt=1890,
                description="Быстрая выдача логина и пароля сразу после оплаты.",
                status="active",
                expires_at=expires,
                published_at=now - timedelta(days=2),
            )
            db.add(gemini_listing)
            db.flush()

    canva_listing = None
    if canva_svc:
        canva_listing = db.scalar(
            select(MarketplaceAccountListing).where(
                MarketplaceAccountListing.seller_user_id == owner.id,
                MarketplaceAccountListing.service_id == canva_svc.id,
            )
        )
        if not canva_listing:
            canva_listing = MarketplaceAccountListing(
                seller_user_id=owner.id,
                service_id=canva_svc.id,
                title="Canva Pro годовая подписка",
                price_kzt=2490,
                description="Приглашение в семью/аккаунт без смены почты.",
                status="active",
                expires_at=expires,
                published_at=now - timedelta(days=3),
            )
            db.add(canva_listing)
            db.flush()

    owner_chatgpt_listing = None
    if chatgpt_svc:
        owner_chatgpt_listing = db.scalar(
            select(MarketplaceAccountListing).where(
                MarketplaceAccountListing.seller_user_id == owner.id,
                MarketplaceAccountListing.service_id == chatgpt_svc.id,
            )
        )

    member_chatgpt_listing = db.scalar(
        select(MarketplaceAccountListing).where(
            MarketplaceAccountListing.seller_user_id == member.id,
        )
    )

    db.execute(
        delete(MarketplaceAccountRequest).where(
            MarketplaceAccountRequest.buyer_user_id.in_([owner.id, member.id])
        )
    )
    db.flush()

    created_count = 0
    if gemini_listing:
        db.add(
            MarketplaceAccountRequest(
                listing_id=gemini_listing.id,
                buyer_user_id=member.id,
                status="accepted",
                service_slug_snapshot="gemini",
                service_name_snapshot="Gemini",
                title_snapshot=gemini_listing.title,
                price_kzt_snapshot=gemini_listing.price_kzt,
                decided_at=now - timedelta(hours=3),
                created_at=now - timedelta(hours=4),
            )
        )
        created_count += 1

    if canva_listing:
        db.add(
            MarketplaceAccountRequest(
                listing_id=canva_listing.id,
                buyer_user_id=member.id,
                status="pending",
                service_slug_snapshot="canva",
                service_name_snapshot="Canva",
                title_snapshot=canva_listing.title,
                price_kzt_snapshot=canva_listing.price_kzt,
                created_at=now - timedelta(hours=2),
            )
        )
        created_count += 1

    if owner_chatgpt_listing:
        db.add(
            MarketplaceAccountRequest(
                listing_id=owner_chatgpt_listing.id,
                buyer_user_id=member.id,
                status="closed",
                outcome="sold",
                service_slug_snapshot="chatgpt",
                service_name_snapshot="ChatGPT",
                title_snapshot=owner_chatgpt_listing.title,
                price_kzt_snapshot=owner_chatgpt_listing.price_kzt,
                decided_at=now - timedelta(days=2),
                closed_at=now - timedelta(days=1),
                created_at=now - timedelta(days=2, hours=2),
            )
        )
        created_count += 1

    if member_chatgpt_listing:
        db.add(
            MarketplaceAccountRequest(
                listing_id=member_chatgpt_listing.id,
                buyer_user_id=owner.id,
                status="pending",
                service_slug_snapshot="chatgpt",
                service_name_snapshot="ChatGPT",
                title_snapshot=member_chatgpt_listing.title,
                price_kzt_snapshot=member_chatgpt_listing.price_kzt,
                created_at=now - timedelta(hours=2),
            )
        )
        created_count += 1

    db.flush()
    return {"orders": created_count}
