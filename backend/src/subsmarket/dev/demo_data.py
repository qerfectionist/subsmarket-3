from __future__ import annotations

from sqlalchemy import delete, select
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
from subsmarket.identity.models import User
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
        db.execute(delete(FamilyAuditLog).where(FamilyAuditLog.family_id.in_(family_ids)))
        db.execute(delete(Family).where(Family.id.in_(family_ids)))

    db.execute(
        delete(NotificationJob).where(
            NotificationJob.recipient_user_id.in_(demo_user_ids)
        )
    )
    db.execute(delete(User).where(User.id.in_(demo_user_ids)))
    db.commit()
    return {"users": len(demo_user_ids), "families": len(family_ids)}
