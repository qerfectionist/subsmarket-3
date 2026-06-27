from __future__ import annotations

from uuid import UUID

from fastapi import Depends, Header, Response
from sqlalchemy.orm import Session

from subsmarket.core.database import get_db
from subsmarket.families.api.deps import get_current_user
from subsmarket.families.schemas import (
    FamilyCloseCreate,
    FamilyCreate,
    FamilyCreateResult,
    FamilyDescriptionUpdate,
    FamilyInviteOut,
    FamilyMemberOut,
    FamilyOut,
    FamilyPaymentDayUpdate,
    FamilyPriceUpdate,
    FamilyVisibilityUpdate,
)
from subsmarket.families.service import (
    acknowledge_family_closing,
    close_family,
    confirm_family_availability,
    create_family,
    create_family_invite,
    disable_family_invite,
    get_family_invite,
    rotate_family_invite,
    to_family_out,
    to_member_out,
    update_family_description,
    update_family_payment_day,
    update_family_price,
    update_family_visibility,
)


def post_family(
    payload: FamilyCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyCreateResult:
    family = create_family(
        db,
        user,
        payload,
        idempotency_key=idempotency_key,
    )
    return FamilyCreateResult(family=to_family_out(family))


def patch_family_description(
    family_id: UUID,
    payload: FamilyDescriptionUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyOut:
    return to_family_out(update_family_description(db, user, family_id, payload))


def patch_family_price(
    family_id: UUID,
    payload: FamilyPriceUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyOut:
    return to_family_out(update_family_price(db, user, family_id, payload))


def patch_family_payment_day(
    family_id: UUID,
    payload: FamilyPaymentDayUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyOut:
    return to_family_out(update_family_payment_day(db, user, family_id, payload))


def patch_family_visibility(
    family_id: UUID,
    payload: FamilyVisibilityUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyOut:
    return to_family_out(update_family_visibility(db, user, family_id, payload))


def post_family_availability_confirmed(
    family_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyOut:
    return to_family_out(confirm_family_availability(db, user, family_id))


def get_owner_family_invite(
    family_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyInviteOut | None:
    invite = get_family_invite(db, user, family_id)
    return FamilyInviteOut.model_validate(invite) if invite else None


def post_owner_family_invite(
    family_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyInviteOut:
    return FamilyInviteOut.model_validate(create_family_invite(db, user, family_id))


def post_owner_family_invite_rotation(
    family_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyInviteOut:
    return FamilyInviteOut.model_validate(rotate_family_invite(db, user, family_id))


def post_owner_family_invite_disabled(
    family_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> Response:
    disable_family_invite(db, user, family_id)
    return Response(status_code=204)


def post_family_close(
    family_id: UUID,
    payload: FamilyCloseCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyOut:
    return to_family_out(
        close_family(
            db,
            user,
            family_id,
            closes_on=payload.closes_on,
            idempotency_key=idempotency_key,
        )
    )


def post_family_closing_acknowledged(
    family_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> FamilyMemberOut:
    member = acknowledge_family_closing(db, user, family_id)
    return to_member_out(member)
