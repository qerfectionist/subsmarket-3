from __future__ import annotations

import asyncio
import logging
import re

from fastapi import FastAPI
from fastapi.testclient import TestClient
from redis.exceptions import RedisError

from subsmarket.core.config import settings
from subsmarket.core.rate_limit import (
    InMemoryRateLimiter,
    RateLimitMiddleware,
    RateLimitRule,
    RedisRateLimiter,
    rate_limit_backend_status,
)


def resolve_test_telegram_user(init_data: str) -> str | None:
    prefix = "signed-user:"
    user_id = init_data.removeprefix(prefix)
    return user_id if init_data.startswith(prefix) and user_id.isdecimal() else None


class FakeRedis:
    def __init__(self) -> None:
        self.counts: dict[str, int] = {}
        self.keys: list[str] = []

    async def eval(
        self,
        script: str,
        number_of_keys: int,
        key: str,
        window_seconds: int,
    ) -> int:
        assert script
        assert number_of_keys == 1
        assert window_seconds > 0
        self.keys.append(key)
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]


class FailingRedis:
    async def eval(self, *args: object) -> int:
        raise RedisError("redis unavailable")


class RecoveringRedis:
    def __init__(self) -> None:
        self.available = False

    async def eval(self, *args: object) -> int:
        if not self.available:
            raise RedisError("redis unavailable")
        return 1


class ReadyPingRedis:
    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.closed = False

    async def ping(self) -> bool:
        if self.fail:
            raise RedisError("redis unavailable")
        return True

    async def aclose(self) -> None:
        self.closed = True


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


def test_rate_limit_ignores_spoofed_leftmost_forwarded_address() -> None:
    app = FastAPI()
    limiter = InMemoryRateLimiter(
        [RateLimitRule("test", "GET", re.compile(r"/limited"), 1, 60)]
    )
    app.add_middleware(RateLimitMiddleware, limiter=limiter)

    @app.get("/limited")
    def limited() -> dict[str, bool]:
        return {"ok": True}

    client = TestClient(app)

    assert client.get(
        "/limited",
        headers={"x-forwarded-for": "1.1.1.1, 203.0.113.7"},
    ).status_code == 200
    assert client.get(
        "/limited",
        headers={"x-forwarded-for": "2.2.2.2, 203.0.113.7"},
    ).status_code == 429


def test_rate_limit_supports_multiple_trusted_proxy_hops() -> None:
    app = FastAPI()
    limiter = InMemoryRateLimiter(
        [RateLimitRule("test", "GET", re.compile(r"/limited"), 1, 60)]
    )
    app.add_middleware(
        RateLimitMiddleware,
        limiter=limiter,
        trusted_proxy_hops=2,
    )

    @app.get("/limited")
    def limited() -> dict[str, bool]:
        return {"ok": True}

    client = TestClient(app)

    assert client.get(
        "/limited",
        headers={
            "x-forwarded-for": "1.1.1.1, 203.0.113.7, 198.51.100.4"
        },
    ).status_code == 200
    assert client.get(
        "/limited",
        headers={
            "x-forwarded-for": "2.2.2.2, 203.0.113.7, 198.51.100.5"
        },
    ).status_code == 429


def test_rate_limit_falls_back_to_peer_when_proxy_chain_is_too_short() -> None:
    app = FastAPI()
    limiter = InMemoryRateLimiter(
        [RateLimitRule("test", "GET", re.compile(r"/limited"), 1, 60)]
    )
    app.add_middleware(
        RateLimitMiddleware,
        limiter=limiter,
        trusted_proxy_hops=2,
    )

    @app.get("/limited")
    def limited() -> dict[str, bool]:
        return {"ok": True}

    client = TestClient(app)

    assert client.get(
        "/limited",
        headers={"x-forwarded-for": "1.1.1.1"},
    ).status_code == 200
    assert client.get(
        "/limited",
        headers={"x-forwarded-for": "2.2.2.2"},
    ).status_code == 429


def test_rate_limit_ignores_forwarded_chain_when_no_proxy_is_trusted() -> None:
    app = FastAPI()
    limiter = InMemoryRateLimiter(
        [RateLimitRule("test", "GET", re.compile(r"/limited"), 1, 60)]
    )
    app.add_middleware(
        RateLimitMiddleware,
        limiter=limiter,
        trusted_proxy_hops=0,
    )

    @app.get("/limited")
    def limited() -> dict[str, bool]:
        return {"ok": True}

    client = TestClient(app)

    assert client.get(
        "/limited",
        headers={"x-forwarded-for": "1.1.1.1"},
    ).status_code == 200
    assert client.get(
        "/limited",
        headers={"x-forwarded-for": "2.2.2.2"},
    ).status_code == 429


def test_invite_lookup_rate_limit_covers_invalid_code_shapes() -> None:
    now = [1000.0]
    app = FastAPI()
    limiter = InMemoryRateLimiter(clock=lambda: now[0])
    app.add_middleware(RateLimitMiddleware, limiter=limiter)

    @app.get("/api/families/invites/{code}")
    def invite_lookup(code: str) -> dict[str, str]:
        return {"code": code}

    client = TestClient(app)

    for index in range(10):
        response = client.get(
            f"/api/families/invites/not-a-code-{index}",
            headers={"x-forwarded-for": "7.7.7.7"},
        )
        assert response.status_code == 200

    blocked = client.get(
        "/api/families/invites/12345678",
        headers={"x-forwarded-for": "7.7.7.7"},
    )
    other_client = client.get(
        "/api/families/invites/12345678",
        headers={"x-forwarded-for": "8.8.8.8"},
    )

    assert blocked.status_code == 429
    assert blocked.json() == {"detail": "RATE_LIMIT_EXCEEDED"}
    assert other_client.status_code == 200


def test_family_create_rate_limit_blocks_burst_by_client() -> None:
    now = [1000.0]
    app = FastAPI()
    limiter = InMemoryRateLimiter(clock=lambda: now[0])
    app.add_middleware(RateLimitMiddleware, limiter=limiter)

    @app.post("/api/families")
    def create_family() -> dict[str, bool]:
        return {"ok": True}

    client = TestClient(app)

    for _ in range(10):
        response = client.post(
            "/api/families",
            headers={"x-forwarded-for": "9.9.9.9"},
        )
        assert response.status_code == 200

    blocked = client.post(
        "/api/families",
        headers={"x-forwarded-for": "9.9.9.9"},
    )
    other_client = client.post(
        "/api/families",
        headers={"x-forwarded-for": "9.9.9.10"},
    )

    assert blocked.status_code == 429
    assert blocked.json() == {"detail": "RATE_LIMIT_EXCEEDED"}
    assert blocked.headers["Retry-After"] == "600"
    assert other_client.status_code == 200


def test_marketplace_request_create_rate_limit_blocks_cross_listing_spam(
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "development")
    app = FastAPI()
    limiter = InMemoryRateLimiter()
    app.add_middleware(RateLimitMiddleware, limiter=limiter)

    @app.post("/api/marketplace/listings/{listing_id}/requests")
    def create_request(listing_id: str) -> dict[str, str]:
        return {"listing_id": listing_id}

    client = TestClient(app)
    first_user = {"x-dev-telegram-user-id": "5001"}
    second_user = {"x-dev-telegram-user-id": "5002"}

    for index in range(20):
        listing_id = f"00000000-0000-0000-0000-{index:012d}"
        response = client.post(
            f"/api/marketplace/listings/{listing_id}/requests",
            headers=first_user,
        )
        assert response.status_code == 200

    blocked = client.post(
        "/api/marketplace/listings/00000000-0000-0000-0000-999999999999/requests",
        headers=first_user,
    )
    other_user = client.post(
        "/api/marketplace/listings/00000000-0000-0000-0000-999999999999/requests",
        headers=second_user,
    )

    assert blocked.status_code == 429
    assert blocked.headers["Retry-After"] == "3600"
    assert other_user.status_code == 200


def test_marketplace_reminder_rate_limit_is_stricter_than_other_actions(
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "development")
    app = FastAPI()
    limiter = InMemoryRateLimiter()
    app.add_middleware(RateLimitMiddleware, limiter=limiter)

    @app.post("/api/marketplace/requests/{request_id}/{action}")
    def request_action(request_id: str, action: str) -> dict[str, str]:
        return {"request_id": request_id, "action": action}

    client = TestClient(app)
    headers = {"x-dev-telegram-user-id": "5101"}
    request_id = "00000000-0000-0000-0000-000000000001"

    for _ in range(10):
        assert client.post(
            f"/api/marketplace/requests/{request_id}/remind",
            headers=headers,
        ).status_code == 200

    blocked = client.post(
        f"/api/marketplace/requests/{request_id}/remind",
        headers=headers,
    )
    accepted = client.post(
        f"/api/marketplace/requests/{request_id}/accept",
        headers=headers,
    )

    assert blocked.status_code == 429
    assert blocked.headers["Retry-After"] == "3600"
    assert accepted.status_code == 200


def test_account_request_create_rate_limit_blocks_cross_listing_spam(
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "development")
    app = FastAPI()
    limiter = InMemoryRateLimiter()
    app.add_middleware(RateLimitMiddleware, limiter=limiter)

    @app.post("/api/marketplace/accounts/listings/{listing_id}/requests")
    def create_request(listing_id: str) -> dict[str, str]:
        return {"listing_id": listing_id}

    client = TestClient(app)
    first_user = {"x-dev-telegram-user-id": "5201"}
    second_user = {"x-dev-telegram-user-id": "5202"}

    for index in range(20):
        listing_id = f"00000000-0000-0000-0000-{index:012d}"
        response = client.post(
            f"/api/marketplace/accounts/listings/{listing_id}/requests",
            headers=first_user,
        )
        assert response.status_code == 200

    blocked = client.post(
        "/api/marketplace/accounts/listings/"
        "00000000-0000-0000-0000-999999999999/requests",
        headers=first_user,
    )
    other_user = client.post(
        "/api/marketplace/accounts/listings/"
        "00000000-0000-0000-0000-999999999999/requests",
        headers=second_user,
    )

    assert blocked.status_code == 429
    assert blocked.headers["Retry-After"] == "3600"
    assert other_user.status_code == 200


def test_account_reminder_rate_limit_is_stricter_than_other_actions(
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "development")
    app = FastAPI()
    limiter = InMemoryRateLimiter()
    app.add_middleware(RateLimitMiddleware, limiter=limiter)

    @app.post("/api/marketplace/accounts/requests/{request_id}/{action}")
    def request_action(request_id: str, action: str) -> dict[str, str]:
        return {"request_id": request_id, "action": action}

    client = TestClient(app)
    headers = {"x-dev-telegram-user-id": "5301"}
    request_id = "00000000-0000-0000-0000-000000000001"

    for _ in range(10):
        assert client.post(
            f"/api/marketplace/accounts/requests/{request_id}/remind",
            headers=headers,
        ).status_code == 200

    blocked = client.post(
        f"/api/marketplace/accounts/requests/{request_id}/remind",
        headers=headers,
    )
    accepted = client.post(
        f"/api/marketplace/accounts/requests/{request_id}/accept",
        headers=headers,
    )

    assert blocked.status_code == 429
    assert blocked.headers["Retry-After"] == "3600"
    assert accepted.status_code == 200


def test_rate_limiter_prunes_expired_client_buckets() -> None:
    now = [1000.0]
    limiter = InMemoryRateLimiter(
        [RateLimitRule("test", "GET", re.compile(r"/limited"), 2, 60)],
        clock=lambda: now[0],
        prune_interval_seconds=1,
    )
    rule = limiter.rules[0]

    assert limiter.allow(rule=rule, client_key="old-client") is True
    assert ("test", "old-client") in limiter._hits

    now[0] += 61
    assert limiter.allow(rule=rule, client_key="new-client") is True

    assert ("test", "old-client") not in limiter._hits
    assert ("test", "new-client") in limiter._hits


def test_telegram_scoped_limit_separates_users_on_shared_ip() -> None:
    app = FastAPI()
    limiter = InMemoryRateLimiter(
        [
            RateLimitRule(
                "test",
                "POST",
                re.compile(r"/limited"),
                1,
                60,
                key_by_telegram_user=True,
            )
        ]
    )
    app.add_middleware(
        RateLimitMiddleware,
        limiter=limiter,
        telegram_user_id_resolver=resolve_test_telegram_user,
    )

    @app.post("/limited")
    def limited() -> dict[str, bool]:
        return {"ok": True}

    client = TestClient(app)
    shared_ip = {"x-forwarded-for": "10.0.0.1"}

    first_user = client.post(
        "/limited",
        headers={
            **shared_ip,
            "x-telegram-init-data": "signed-user:1001",
        },
    )
    second_user = client.post(
        "/limited",
        headers={
            **shared_ip,
            "x-telegram-init-data": "signed-user:1002",
        },
    )
    first_user_again = client.post(
        "/limited",
        headers={
            "x-forwarded-for": "10.0.0.2",
            "x-telegram-init-data": "signed-user:1001",
        },
    )

    assert first_user.status_code == 200
    assert second_user.status_code == 200
    assert first_user_again.status_code == 429


def test_telegram_scoped_limit_uses_verified_user_id() -> None:
    app = FastAPI()
    limiter = InMemoryRateLimiter(
        [
            RateLimitRule(
                "test",
                "POST",
                re.compile(r"/limited"),
                1,
                60,
                key_by_telegram_user=True,
            )
        ]
    )
    app.add_middleware(
        RateLimitMiddleware,
        limiter=limiter,
        telegram_user_id_resolver=resolve_test_telegram_user,
    )

    @app.post("/limited")
    def limited() -> dict[str, bool]:
        return {"ok": True}

    client = TestClient(app)
    headers = {
        "x-forwarded-for": "10.0.0.1",
        "x-telegram-init-data": "signed-user:2001",
    }

    assert client.post("/limited", headers=headers).status_code == 200
    assert client.post("/limited", headers=headers).status_code == 429


def test_telegram_limit_uses_ip_for_missing_and_invalid_identity() -> None:
    app = FastAPI()
    limiter = InMemoryRateLimiter(
        [
            RateLimitRule(
                "test",
                "POST",
                re.compile(r"/limited"),
                1,
                60,
                key_by_telegram_user=True,
            )
        ]
    )
    app.add_middleware(
        RateLimitMiddleware,
        limiter=limiter,
        telegram_user_id_resolver=resolve_test_telegram_user,
    )

    @app.post("/limited")
    def limited() -> dict[str, bool]:
        return {"ok": True}

    client = TestClient(app)
    shared_proxy_address = "203.0.113.9"

    assert client.post(
        "/limited",
        headers={"x-forwarded-for": shared_proxy_address},
    ).status_code == 200
    assert client.post(
        "/limited",
        headers={
            "x-forwarded-for": shared_proxy_address,
            "x-telegram-init-data": "user=%7B%22id%22%3A2002%7D",
        },
    ).status_code == 429


def test_telegram_scoped_limit_reads_development_user_header(monkeypatch) -> None:
    monkeypatch.setattr(settings, "app_env", "development")
    app = FastAPI()
    limiter = InMemoryRateLimiter(
        [
            RateLimitRule(
                "test",
                "POST",
                re.compile(r"/limited"),
                1,
                60,
                key_by_telegram_user=True,
            )
        ]
    )
    app.add_middleware(RateLimitMiddleware, limiter=limiter)

    @app.post("/limited")
    def limited() -> dict[str, bool]:
        return {"ok": True}

    client = TestClient(app)
    shared_ip = {"x-forwarded-for": "10.0.0.1"}

    assert client.post(
        "/limited", headers={**shared_ip, "x-dev-telegram-user-id": "3001"}
    ).status_code == 200
    assert client.post(
        "/limited", headers={**shared_ip, "x-dev-telegram-user-id": "3002"}
    ).status_code == 200
    assert client.post(
        "/limited",
        headers={"x-forwarded-for": "10.0.0.2", "x-dev-telegram-user-id": "3001"},
    ).status_code == 429


def test_production_limit_ignores_development_header(monkeypatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    app = FastAPI()
    limiter = InMemoryRateLimiter(
        [
            RateLimitRule(
                "test",
                "POST",
                re.compile(r"/limited"),
                1,
                60,
                key_by_telegram_user=True,
            )
        ]
    )
    app.add_middleware(RateLimitMiddleware, limiter=limiter)

    @app.post("/limited")
    def limited() -> dict[str, bool]:
        return {"ok": True}

    client = TestClient(app)
    shared_ip = {"x-forwarded-for": "10.0.0.1"}
    assert client.post(
        "/limited", headers={**shared_ip, "x-dev-telegram-user-id": "4001"}
    ).status_code == 200
    assert client.post(
        "/limited", headers={**shared_ip, "x-dev-telegram-user-id": "4002"}
    ).status_code == 429


def test_redis_rate_limiter_shares_counts_between_instances() -> None:
    rule = RateLimitRule("test", "POST", re.compile(r"/limited"), 2, 60)
    redis = FakeRedis()
    first = RedisRateLimiter("redis://unused", [rule], client=redis)
    second = RedisRateLimiter("redis://unused", [rule], client=redis)

    async def run() -> tuple[bool, bool, bool]:
        return (
            await first.allow(rule=rule, client_key="telegram:1001"),
            await second.allow(rule=rule, client_key="telegram:1001"),
            await first.allow(rule=rule, client_key="telegram:1001"),
        )

    assert asyncio.run(run()) == (True, True, False)
    assert redis.keys
    assert all("telegram:1001" not in key for key in redis.keys)


def test_redis_rate_limiter_uses_local_fallback_on_connection_error() -> None:
    rule = RateLimitRule("test", "POST", re.compile(r"/limited"), 1, 60)
    limiter = RedisRateLimiter(
        "redis://unused",
        [rule],
        client=FailingRedis(),
    )

    async def run() -> tuple[bool, bool]:
        return (
            await limiter.allow(rule=rule, client_key="telegram:1001"),
            await limiter.allow(rule=rule, client_key="telegram:1001"),
        )

    assert asyncio.run(run()) == (True, False)


def test_redis_rate_limiter_logs_outage_and_recovery_once(caplog) -> None:
    rule = RateLimitRule("test", "POST", re.compile(r"/limited"), 5, 60)
    redis = RecoveringRedis()
    limiter = RedisRateLimiter("redis://unused", [rule], client=redis)

    async def run() -> None:
        await limiter.allow(rule=rule, client_key="telegram:1001")
        await limiter.allow(rule=rule, client_key="telegram:1002")
        redis.available = True
        await limiter.allow(rule=rule, client_key="telegram:1003")

    with caplog.at_level(logging.INFO):
        asyncio.run(run())

    messages = [record.getMessage() for record in caplog.records]
    assert messages.count(
        "Redis rate limiter unavailable; using process-local fallback"
    ) == 1
    assert messages.count(
        "Redis rate limiter recovered; shared limits restored"
    ) == 1


def test_rate_limit_backend_status_reports_redis_and_fallback(
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "rate_limit_redis_url", "redis://example")
    ready_client = ReadyPingRedis()
    monkeypatch.setattr(
        "subsmarket.core.rate_limit.Redis.from_url",
        lambda *args, **kwargs: ready_client,
    )

    assert asyncio.run(rate_limit_backend_status()) == "redis"
    assert ready_client.closed is True

    failing_client = ReadyPingRedis(fail=True)
    monkeypatch.setattr(
        "subsmarket.core.rate_limit.Redis.from_url",
        lambda *args, **kwargs: failing_client,
    )

    assert asyncio.run(rate_limit_backend_status()) == "fallback"
    assert failing_client.closed is True
