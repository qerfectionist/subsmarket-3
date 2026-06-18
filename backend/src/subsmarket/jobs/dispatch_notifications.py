from __future__ import annotations

from subsmarket.core.database import SessionLocal
from subsmarket.notifications.dispatcher import dispatch_pending_notifications


def main() -> None:
    with SessionLocal() as db:
        result = dispatch_pending_notifications(db)
    print(result.model_dump_json())


if __name__ == "__main__":
    main()
