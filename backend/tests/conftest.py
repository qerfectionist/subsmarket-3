from __future__ import annotations

import os

# API tests intentionally use the local development authentication headers.
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("DEV_AUTH_ENABLED", "true")
