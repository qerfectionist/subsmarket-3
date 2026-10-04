from __future__ import annotations

from sqlalchemy import delete
from sqlalchemy.orm import Session

from subsmarket.families.models import (
    Family,
    FamilyAuditLog,
    FamilyMember,
    FamilyPayment,
    FamilyPaymentRequisite,
    FamilyRequest,
    FamilyRequestRestriction,
)
from subsmarket.marketplace.account_models import (
    MarketplaceAccountListing,
    MarketplaceAccountRequest,
)
from subsmarket.marketplace.models import (
    MarketplaceListing,
    MarketplaceListingRequest,
)
from subsmarket.notifications.models import NotificationJob


def clean_archive(db: Session) -> dict[str, int]:
    """Wipes all terminal (archived) requests from DB across all entities."""
    del_gb = db.execute(
        delete(MarketplaceListingRequest).where(
            MarketplaceListingRequest.status.in_(
                ["closed", "cancelled", "rejected", "expired"]
            )
        )
    ).rowcount
    del_acc = db.execute(
        delete(MarketplaceAccountRequest).where(
            MarketplaceAccountRequest.status.in_(
                ["closed", "cancelled", "rejected", "expired"]
            )
        )
    ).rowcount
    del_fam = db.execute(
        delete(FamilyRequest).where(
            FamilyRequest.status.in_(["approved", "rejected", "cancelled", "expired"])
        )
    ).rowcount
    db.commit()
    return {
        "gb_archived_cleaned": del_gb,
        "account_archived_cleaned": del_acc,
        "family_archived_cleaned": del_fam,
    }


def clean_all_cards(db: Session) -> dict[str, int]:
    """Wipes both archived and active requests across all users."""
    del_gb = db.execute(delete(MarketplaceListingRequest)).rowcount
    del_acc = db.execute(delete(MarketplaceAccountRequest)).rowcount
    del_fam = db.execute(delete(FamilyRequest)).rowcount
    db.commit()
    return {
        "gb_requests": del_gb,
        "account_requests": del_acc,
        "family_requests": del_fam,
    }


def purge_all_test_data(db: Session) -> dict[str, int]:
    """Wipes all requests, listings, and families completely."""
    del_m_reqs = db.execute(delete(MarketplaceListingRequest)).rowcount
    del_a_reqs = db.execute(delete(MarketplaceAccountRequest)).rowcount
    del_f_reqs = db.execute(delete(FamilyRequest)).rowcount
    del_m_list = db.execute(delete(MarketplaceListing)).rowcount
    del_a_list = db.execute(delete(MarketplaceAccountListing)).rowcount
    db.execute(delete(FamilyPayment))
    db.execute(delete(FamilyMember))
    db.execute(delete(FamilyRequestRestriction))
    db.execute(delete(FamilyPaymentRequisite))
    db.execute(delete(FamilyAuditLog))
    del_fam = db.execute(delete(Family)).rowcount
    db.execute(delete(NotificationJob))
    db.commit()
    return {
        "gb_requests": del_m_reqs,
        "account_requests": del_a_reqs,
        "family_requests": del_f_reqs,
        "gb_listings": del_m_list,
        "account_listings": del_a_list,
        "families": del_fam,
    }
