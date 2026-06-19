from __future__ import annotations

import json
import os
from typing import Any
from urllib.request import urlopen

REQUIRED_PATHS = {
    "/health",
    "/ready",
    "/api/me",
    "/api/families",
    "/api/families/page",
    "/api/families/{family_id}/view",
    "/api/families/invites/{code}",
    "/api/telegram/webhook",
}
FORBIDDEN_PATHS = {"/api/dev/reset-demo-data"}


def fetch_json(base_url: str, path: str) -> dict[str, Any]:
    with urlopen(f"{base_url.rstrip('/')}{path}", timeout=15) as response:
        if response.status != 200:
            raise RuntimeError(f"{path} returned HTTP {response.status}")
        return json.loads(response.read().decode("utf-8"))


def validate_openapi_paths(paths: set[str]) -> list[str]:
    problems = [
        f"missing route: {path}" for path in sorted(REQUIRED_PATHS - paths)
    ]
    problems.extend(
        f"development route exposed: {path}"
        for path in sorted(FORBIDDEN_PATHS & paths)
    )
    return problems


def validate_readiness(
    health: dict[str, Any],
    ready: dict[str, Any],
) -> list[str]:
    problems: list[str] = []
    if health.get("status") != "ok":
        problems.append("health status is not ok")
    if ready.get("database") != "ok":
        problems.append("database readiness is not ok")
    if ready.get("rate_limit") == "fallback":
        problems.append("Redis rate limiter is using local fallback")
    return problems


def main() -> None:
    base_url = os.getenv("PRODUCTION_API_URL", "").rstrip("/")
    allow_http = os.getenv("PRODUCTION_SMOKE_ALLOW_HTTP") == "true"
    if not base_url:
        raise SystemExit("PRODUCTION_API_URL is required")
    if not allow_http and not base_url.startswith("https://"):
        raise SystemExit("PRODUCTION_API_URL must use HTTPS")

    health = fetch_json(base_url, "/health")
    ready = fetch_json(base_url, "/ready")
    openapi = fetch_json(base_url, "/openapi.json")
    problems = validate_openapi_paths(set(openapi.get("paths", {})))
    problems.extend(validate_readiness(health, ready))

    payload = {
        "ok": not problems,
        "base_url": base_url,
        "problems": problems,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    if problems:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
