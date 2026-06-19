from __future__ import annotations

import re
import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable, Iterable
from dataclasses import dataclass
from re import Pattern

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp


@dataclass(frozen=True)
class RateLimitRule:
    name: str
    method: str
    path_pattern: Pattern[str]
    max_requests: int
    window_seconds: int

    def matches(self, request: Request) -> bool:
        return request.method == self.method and bool(
            self.path_pattern.fullmatch(request.url.path)
        )


DEFAULT_RATE_LIMIT_RULES = (
    RateLimitRule("me_get", "GET", re.compile(r"/api/me"), 120, 60),
    RateLimitRule(
        "me_refresh",
        "PATCH",
        re.compile(r"/api/me/refresh-telegram-profile"),
        30,
        60,
    ),
    RateLimitRule(
        "join_request",
        "POST",
        re.compile(r"/api/families/[0-9a-fA-F-]{36}/requests"),
        20,
        60,
    ),
    RateLimitRule(
        "family_invite_lookup",
        "GET",
        re.compile(r"/api/families/invites/[0-9-]{8,9}"),
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
    ) -> None:
        self.rules = tuple(rules)
        self.clock = clock
        self._hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)

    def matching_rule(self, request: Request) -> RateLimitRule | None:
        for rule in self.rules:
            if rule.matches(request):
                return rule
        return None

    def allow(self, *, rule: RateLimitRule, client_key: str) -> bool:
        now = self.clock()
        bucket = self._hits[(rule.name, client_key)]
        window_start = now - rule.window_seconds
        while bucket and bucket[0] <= window_start:
            bucket.popleft()
        if len(bucket) >= rule.max_requests:
            return False
        bucket.append(now)
        return True


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: ASGIApp,
        *,
        limiter: InMemoryRateLimiter | None = None,
    ) -> None:
        super().__init__(app)
        self.limiter = limiter or InMemoryRateLimiter()

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        rule = self.limiter.matching_rule(request)
        if rule is None:
            return await call_next(request)

        client_key = _client_key(request)
        if not self.limiter.allow(rule=rule, client_key=client_key):
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
