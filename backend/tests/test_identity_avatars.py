from __future__ import annotations

from uuid import UUID

from subsmarket.identity.avatars import (
    PUBLIC_AVATAR_ADJECTIVES,
    PUBLIC_AVATAR_ANIMALS,
    PUBLIC_AVATAR_CAPACITY,
    PUBLIC_NAME_POOL_TARGET,
    PUBLIC_NAME_RESERVED,
    default_avatar_name,
    generate_public_name_candidates,
)


def test_public_avatar_dictionary_has_at_least_five_thousand_combinations() -> None:
    assert PUBLIC_AVATAR_CAPACITY >= 5_000
    names = {
        f"{adjective}{animal}"
        for adjective in PUBLIC_AVATAR_ADJECTIVES
        for animal in PUBLIC_AVATAR_ANIMALS
    }
    assert len(names) == PUBLIC_AVATAR_CAPACITY


def test_default_avatar_name_is_stable_and_does_not_use_telegram_data() -> None:
    user_id = UUID("00000000-0000-0000-0000-000000000001")

    first_name = default_avatar_name(user_id)
    second_name = default_avatar_name(user_id)

    assert first_name == second_name
    assert first_name.isascii()
    assert first_name.islower()
    assert first_name.isalpha()


def test_public_name_pool_has_twenty_thousand_unique_valid_candidates() -> None:
    candidates = generate_public_name_candidates()
    names = [name for name, _, _ in candidates]

    assert len(names) == PUBLIC_NAME_POOL_TARGET
    assert len(set(names)) == PUBLIC_NAME_POOL_TARGET
    assert not set(names) & PUBLIC_NAME_RESERVED
    assert all(name.isascii() and name.islower() and name.isalpha() for name in names)
    assert all(6 <= len(name) <= 16 for name in names)
