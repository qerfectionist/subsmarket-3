from __future__ import annotations

import hashlib
import inspect
import json
import logging
import re
import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable, Iterable
from dataclasses import dataclass
from re import Pattern
from urllib.parse import parse_qs

from redis.asyncio import Redis
from redis.exceptions import RedisError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

from subsmarket.core.config import settings

logger = logging.getLogger(__name__)

REDIS_RATE_LIMIT_SCRIPT = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
"""


@dataclass(frozen=True)
class RateLimitRule:
    name: str
    method: str
    path_pattern: Pattern[str]
    max_requests: int
    window_seconds: int
    key_by_telegram_user: bool = False

    def matches(self, request: Request) -> bool:
        return request.method == self.method and bool(
            self.path_pattern.fullmatch(request.url.path)
        )


DEFAULT_RATE_LIMIT_RULES = (
    RateLimitRule(
        "me_get",
        "GET",
        re.compile(r"/api/me"),
        120,
        60,
        key_by_telegram_user=True,
    ),
    RateLimitRule(
        "me_refresh",
        "PATCH",
        re.compile(r"/api/me/refresh-telegram-profile"),
        30,
        60,
        key_by_telegram_user=True,
    ),
    RateLimitRule(
        "family_create",
        "POST",
        re.compile(r"/api/families"),
        10,
        600,
        key_by_telegram_user=True,
    ),
    RateLimitRule(
        "join_request",
        "POST",
        re.compile(r"/api/families/[0-9a-fA-F-]{36}/requests"),
        20,
        60,
        key_by_telegram_user=True,
    ),
    RateLimitRule(
        "family_invite_lookup",
        "GET",
        re.compile(r"/api/families/invites/[^/]{1,64}"),
        10,
        600,
    ),
    RateLimitRule(
        "telegram_webhook",
        "POST",
        re.compile(r"/api/telegram/webhook"),
        120,
        60,
    ),
    RateLimitRule(
        "internal_jobs",
        "POST",
        re.compile(r"/api/internal/jobs/(run-due|dispatch-notifications)"),
        30,
        60,
    ),
)


class InMemoryRateLimiter:
    def __init__(
        self,
        rules: Iterable[RateLimitRule] = DEFAULT_RATE_LIMIT_RULES,
        *,
        clock: Callable[[], float] = time.monotonic,
        prune_interval_seconds: int = 60,
    ) -> None:
        self.rules = tuple(rules)
        self.clock = clock
        self.prune_interval_seconds = prune_interval_seconds
        self._last_prune = self.clock()
        self._hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)

    def matching_rule(self, request: Request) -> RateLimitRule | None:
        for rule in self.rules:
            if rule.matches(request):
                return rule
        return None

    def allow(self, *, rule: RateLimitRule, client_key: str) -> bool:
        now = self.clock()
        self._prune_if_due(now)
        bucket = self._hits[(rule.name, client_key)]
        window_start = now - rule.window_seconds
        while bucket and bucket[0] <= window_start:
            bucket.popleft()
        if len(bucket) >= rule.max_requests:
            return False
        bucket.append(now)
        return True

    def _prune_if_due(self, now: float) -> None:
        if now - self._last_prune < self.prune_interval_seconds:
            return
        max_window_seconds = max(
            (rule.window_seconds for rule in self.rules),
            default=0,
        )
        cutoff = now - max_window_seconds
        for key, bucket in list(self._hits.items()):
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if not bucket:
                del self._hits[key]
        self._last_prune = now


class RedisRateLimiter:
    def __init__(
        self,
        redis_url: str,
        rules: Iterable[RateLimitRule] = DEFAULT_RATE_LIMIT_RULES,
        *,
        client: Redis | None = None,
        fallback: InMemoryRateLimiter | None = None,
    ) -> None:
        self.rules = tuple(rules)
        self.client = client or Redis.from_url(redis_url, decode_responses=True)
        self.fallback = fallback or InMemoryRateLimiter(self.rules)

    def matching_rule(self, request: Request) -> RateLimitRule | None:
        for rule in self.rules:
            if rule.matches(request):
                return rule
        return None

    async def allow(self, *, rule: RateLimitRule, client_key: str) -> bool:
        digest = hashlib.sha256(client_key.encode("utf-8")).hexdigest()
        redis_key = f"subsmarket:rate-limit:{rule.name}:{digest}"
        try:
            count = await self.client.eval(
                REDIS_RATE_LIMIT_SCRIPT,
                1,
                redis_key,
                rule.window_seconds,
            )
        except RedisError:
            logger.warning(
                "Redis rate limiter unavailable; using process-local fallback",
                exc_info=True,
            )
            return self.fallback.allow(rule=rule, client_key=client_key)
        return int(count) <= rule.max_requests


def build_rate_limiter() -> InMemoryRateLimiter | RedisRateLimiter:
    if settings.rate_limit_redis_url:
        return RedisRateLimiter(settings.rate_limit_redis_url)
    return InMemoryRateLimiter()


async def rate_limit_backend_status() -> str:
    if not settings.rate_limit_redis_url:
        return "local"
    client = Redis.from_url(
        settings.rate_limit_redis_url,
        decode_responses=True,
        socket_connect_timeout=1,
        socket_timeout=1,
    )
    try:
        await client.ping()
    except (RedisError, TimeoutError):
        return "fallback"
    finally:
        await client.aclose()
    return "redis"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: ASGIApp,
        *,
        limiter: InMemoryRateLimiter | RedisRateLimiter | None = None,
    ) -> None:
        super().__init__(app)
        self.limiter = limiter or build_rate_limiter()

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        rule = self.limiter.matching_rule(request)
        if rule is None:
            return await call_next(request)

        client_key = _request_key(request, rule)
        allow_result = self.limiter.allow(rule=rule, client_key=client_key)
        allowed = (
            await allow_result
            if inspect.isawaitable(allow_result)
            else allow_result
        )
        if not allowed:
            return JSONResponse(
                {"detail": "RATE_LIMIT_EXCEEDED"},
                status_code=429,
                headers={"Retry-After": str(rule.window_seconds)},
            )
        return await call_next(request)


def _client_key(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    if request.client is not None:
        return request.client.host
    return "unknown"


def _request_key(request: Request, rule: RateLimitRule) -> str:
    if rule.key_by_telegram_user:
        telegram_user_id = _telegram_user_id(request)
        if telegram_user_id is not None:
            return f"telegram:{telegram_user_id}"
    return f"client:{_client_key(request)}"


def _telegram_user_id(request: Request) -> str | None:
    init_data = request.headers.get("x-telegram-init-data")
    if not init_data:
        return None
    try:
        user_json = parse_qs(init_data, keep_blank_values=True).get("user", [""])[0]
        telegram_user_id = json.loads(user_json).get("id")
    except (AttributeError, json.JSONDecodeError, TypeError, ValueError):
        return None
    if not isinstance(telegram_user_id, int) or telegram_user_id <= 0:
        return None
    return str(telegram_user_id)
