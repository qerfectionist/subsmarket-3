from __future__ import annotations

import hashlib
import re
from collections.abc import Iterable, Iterator
from uuid import UUID

# Curated words keep the public aliases short, readable, and independent from
# Telegram profile data. The legacy pair generator below remains stable for
# users created before the persistent name pool was introduced.
PUBLIC_AVATAR_ADJECTIVES = (
    "baby",
    "black",
    "blue",
    "bright",
    "calm",
    "clever",
    "cloud",
    "cozy",
    "crystal",
    "dawn",
    "dreamy",
    "gentle",
    "golden",
    "green",
    "happy",
    "hazy",
    "honey",
    "icy",
    "kind",
    "little",
    "lucky",
    "lunar",
    "mellow",
    "mint",
    "misty",
    "peachy",
    "playful",
    "quiet",
    "rainy",
    "red",
    "rosy",
    "sleepy",
    "soft",
    "solar",
    "starry",
    "sunny",
    "sweet",
    "tiny",
    "velvet",
    "warm",
    "wild",
    "amber",
    "aqua",
    "autumn",
    "bold",
    "coral",
    "cosmic",
    "dusty",
    "emerald",
    "fresh",
    "frosty",
    "jade",
    "lemon",
    "lively",
    "magic",
    "midnight",
    "ocean",
    "olive",
    "plum",
    "silver",
    "snowy",
    "twilight",
    "vivid",
    "winter",
)

PUBLIC_AVATAR_ANIMALS = (
    "fox",
    "bird",
    "cat",
    "bear",
    "bunny",
    "koala",
    "panda",
    "pup",
    "otter",
    "owl",
    "deer",
    "rabbit",
    "squirrel",
    "penguin",
    "seal",
    "whale",
    "dolphin",
    "turtle",
    "hedgehog",
    "hamster",
    "duck",
    "swan",
    "robin",
    "sparrow",
    "finch",
    "parrot",
    "dove",
    "crane",
    "heron",
    "flamingo",
    "tiger",
    "lion",
    "leopard",
    "lynx",
    "wolf",
    "badger",
    "beaver",
    "moose",
    "elk",
    "fawn",
    "pony",
    "horse",
    "alpaca",
    "llama",
    "goat",
    "sheep",
    "lamb",
    "calf",
    "piglet",
    "mouse",
    "beetle",
    "bee",
    "butterfly",
    "firefly",
    "cricket",
    "dragonfly",
    "gecko",
    "iguana",
    "chameleon",
    "frog",
    "toad",
    "newt",
    "salamander",
    "starling",
    "hummingbird",
    "songbird",
    "nightingale",
    "magpie",
    "canary",
    "wren",
    "jay",
    "puffin",
    "seahorse",
    "jellyfish",
    "seastar",
    "shrimp",
    "octopus",
    "walrus",
    "manatee",
    "capybara",
    "marmot",
)

PUBLIC_AVATAR_CAPACITY = len(PUBLIC_AVATAR_ADJECTIVES) * len(PUBLIC_AVATAR_ANIMALS)

# Adding a short third word expands the pool without falling back to numeric
# suffixes or exposing any Telegram profile data. The resulting names remain
# readable (for example, "babybluefox") and fit the public UI.
PUBLIC_NAME_VARIANTS = (
    "blue",
    "gold",
    "star",
    "moon",
    "rose",
    "sky",
)
PUBLIC_NAME_MAX_LENGTH = 16
PUBLIC_NAME_POOL_TARGET = 20_000
PUBLIC_NAME_RESERVED = frozenset(
    {
        "babyfox",
        "blackbird",
        "mintcat",
        "tinybear",
        "bluebunny",
        "sleepykoala",
        "redpanda",
        "cloudpup",
    }
)
_PUBLIC_NAME_RE = re.compile(r"^[a-z][a-z]+$")


def iter_public_name_candidates() -> Iterator[tuple[str, str, str]]:
    """Yield stable, curated name candidates with their source components."""
    emitted: set[str] = set()
    for modifier in PUBLIC_AVATAR_ADJECTIVES:
        for mascot in PUBLIC_AVATAR_ANIMALS:
            candidate = f"{modifier}{mascot}"
            if _is_valid_public_name(candidate) and candidate not in emitted:
                emitted.add(candidate)
                yield candidate, modifier, mascot

        for variant in PUBLIC_NAME_VARIANTS:
            combined_modifier = f"{modifier}{variant}"
            for mascot in PUBLIC_AVATAR_ANIMALS:
                candidate = f"{combined_modifier}{mascot}"
                if _is_valid_public_name(candidate) and candidate not in emitted:
                    emitted.add(candidate)
                    yield candidate, combined_modifier, mascot


def generate_public_name_candidates(
    existing_names: Iterable[str] = (),
    *,
    limit: int = PUBLIC_NAME_POOL_TARGET,
) -> list[tuple[str, str, str]]:
    """Build a unique pool while excluding already assigned/reserved names."""
    seen = {
        name.strip().lower()
        for name in existing_names
        if isinstance(name, str) and name.strip()
    }
    seen.update(PUBLIC_NAME_RESERVED)

    result: list[tuple[str, str, str]] = []
    for candidate, modifier, mascot in iter_public_name_candidates():
        if candidate in seen:
            continue
        seen.add(candidate)
        result.append((candidate, modifier, mascot))
        if len(result) >= limit:
            break
    return result


def _is_valid_public_name(name: str) -> bool:
    return (
        6 <= len(name) <= PUBLIC_NAME_MAX_LENGTH
        and _PUBLIC_NAME_RE.fullmatch(name) is not None
    )


def default_avatar_name(user_id: UUID) -> str:
    digest = hashlib.sha256(user_id.bytes).digest()
    index = int.from_bytes(digest[:8], "big") % PUBLIC_AVATAR_CAPACITY
    adjective_index, animal_index = divmod(index, len(PUBLIC_AVATAR_ANIMALS))
    return (
        f"{PUBLIC_AVATAR_ADJECTIVES[adjective_index]}"
        f"{PUBLIC_AVATAR_ANIMALS[animal_index]}"
    )
