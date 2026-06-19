from __future__ import annotations

import re

from fastapi import FastAPI
from fastapi.testclient import TestClient

from subsmarket.core.rate_limit import (
    InMemoryRateLimiter,
    RateLimitMiddleware,
    RateLimitRule,
)


def test_rate_limit_middleware_blocks_after_rule_limit() -> None:
    now = [1000.0]
    app = FastAPI()
    limiter = InMemoryRateLimiter(
        [RateLimitRule("test", "GET", re.compile(r"/limited"), 2, 60)],
        clock=lambda: now[0],
    )
    app.add_middleware(RateLimitMiddleware, limiter=limiter)

    @app.get("/limited")
    def limited() -> dict[str, bool]:
        return {"ok": True}

    client = TestClient(app)

    assert client.get("/limited").status_code == 200
    assert client.get("/limited").status_code == 200
    blocked = client.get("/limited")
    assert blocked.status_code == 429
    assert blocked.json() == {"detail": "RATE_LIMIT_EXCEEDED"}
    assert blocked.headers["Retry-After"] == "60"

    now[0] += 61
    assert client.get("/limited").status_code == 200


def test_rate_limit_middleware_keys_by_forwarded_client() -> None:
    app = FastAPI()
    limiter = InMemoryRateLimiter(
        [RateLimitRule("test", "GET", re.compile(r"/limited"), 1, 60)]
    )
    app.add_middleware(RateLimitMiddleware, limiter=limiter)

    @app.get("/limited")
    def limited() -> dict[str, bool]:
        return {"ok": True}

    client = TestClient(app)

    first_client_response = client.get(
        "/limited", headers={"x-forwarded-for": "1.1.1.1"}
    )
    first_client_blocked = client.get(
        "/limited", headers={"x-forwarded-for": "1.1.1.1"}
    )
    second_client_response = client.get(
        "/limited", headers={"x-forwarded-for": "2.2.2.2"}
    )

    assert first_client_response.status_code == 200
    assert first_client_blocked.status_code == 429
    assert second_client_response.status_code == 200
