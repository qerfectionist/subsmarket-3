from __future__ import annotations

import argparse

from subsmarket.core.database import SessionLocal
from subsmarket.identity.avatars import PUBLIC_NAME_POOL_TARGET
from subsmarket.identity.service import seed_public_name_pool


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Top up the persistent public-name pool."
    )
    parser.add_argument(
        "--target-free",
        type=int,
        default=PUBLIC_NAME_POOL_TARGET,
        help="Desired number of unassigned names after the run.",
    )
    args = parser.parse_args()

    with SessionLocal() as db:
        inserted = seed_public_name_pool(db, target_free=args.target_free)
        db.commit()

    print(
        f"Added {inserted} public names; target free pool size is "
        f"{args.target_free}."
    )


if __name__ == "__main__":
    main()
