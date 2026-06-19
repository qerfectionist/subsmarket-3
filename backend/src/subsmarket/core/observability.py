from __future__ import annotations

import os
from typing import Any

from subsmarket.core.config import settings

_configured = False


def configure_sentry() -> bool:
    """Enable Sentry only when production env provides a DSN."""
    global _configured
    if _configured:
        return True
    if not settings.sentry_dsn:
        return False

    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

    init_kwargs: dict[str, Any] = {
        "dsn": settings.sentry_dsn,
        "environment": settings.app_env,
        "send_default_pii": settings.sentry_send_default_pii,
        "traces_sample_rate": settings.sentry_traces_sample_rate,
        "integrations": [
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
        ],
    }
    release = settings.sentry_release or os.getenv("RENDER_GIT_COMMIT")
    if release:
        init_kwargs["release"] = release

    sentry_sdk.init(**init_kwargs)
    _configured = True
    return True
