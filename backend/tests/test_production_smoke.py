from __future__ import annotations

from subsmarket.ops.production_smoke import (
    REQUIRED_PATHS,
    validate_openapi_paths,
    validate_readiness,
)


def test_production_smoke_accepts_required_routes() -> None:
    assert validate_openapi_paths(set(REQUIRED_PATHS)) == []


def test_production_smoke_rejects_dev_route() -> None:
    problems = validate_openapi_paths(
        set(REQUIRED_PATHS) | {"/api/dev/reset-demo-data"}
    )

    assert problems == ["development route exposed: /api/dev/reset-demo-data"]


def test_production_smoke_reports_redis_fallback() -> None:
    problems = validate_readiness(
        {"status": "ok"},
        {"database": "ok", "rate_limit": "fallback"},
    )

    assert problems == ["Redis rate limiter is using local fallback"]
