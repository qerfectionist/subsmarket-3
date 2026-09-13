from __future__ import annotations

from subsmarket.identity.avatars import default_avatar_name
from subsmarket.identity.models import User
from subsmarket.marketplace.schemas import MarketplaceListingOwner


def to_marketplace_listing_owner(user: User) -> MarketplaceListingOwner:
    return MarketplaceListingOwner(
        avatar_name=user.public_name or default_avatar_name(user.id),
        first_name=user.first_name,
        # Catalog cards use the public alias and initial; the Telegram photo
        # is intentionally not exposed by marketplace catalog responses.
        photo_url=None,
    )
