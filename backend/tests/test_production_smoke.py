from __future__ import annotations

from subsmarket.ops.production_smoke import validate_openapi_paths


def test_production_smoke_accepts_required_routes() -> None:
    paths = {
        "/health",
        "/ready",
        "/api/me",
        "/api/families",
        "/api/families/{family_id}/view",
        "/api/families/invites/{code}",
        "/api/telegram/webhook",
    }

    assert validate_openapi_paths(paths) == []


def test_production_smoke_rejects_dev_route() -> None:
    problems = validate_openapi_paths(
        {
            "/health",
            "/ready",
            "/api/me",
            "/api/families",
            "/api/families/{family_id}/view",
            "/api/families/invites/{code}",
            "/api/telegram/webhook",
            "/api/dev/reset-demo-data",
        }
    )

    assert problems == ["development route exposed: /api/dev/reset-demo-data"]
