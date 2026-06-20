from __future__ import annotations

import json

from subsmarket.core.config import settings
from subsmarket.core.observability import configure_sentry


def send_sentry_smoke() -> dict[str, object]:
    if not settings.sentry_dsn:
        return {
            "ok": False,
            "sent": False,
            "problem": "SENTRY_DSN is not configured",
        }
    if not configure_sentry():
        return {
            "ok": False,
            "sent": False,
            "problem": "Sentry initialization failed",
        }

    import sentry_sdk

    event_id = sentry_sdk.capture_message(
        "SubsMarket Sentry smoke check",
        level="info",
    )
    sentry_sdk.flush(timeout=5)
    return {
        "ok": event_id is not None,
        "sent": event_id is not None,
        "event_id": str(event_id) if event_id is not None else None,
        "environment": settings.app_env,
    }


def main() -> None:
    payload = send_sentry_smoke()
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    if not payload["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

