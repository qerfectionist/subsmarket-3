from __future__ import annotations

import sys
import types

import subsmarket.ops.sentry_smoke as sentry_smoke
from subsmarket.core.config import settings


def test_sentry_smoke_reports_missing_dsn(monkeypatch) -> None:
    monkeypatch.setattr(settings, "sentry_dsn", None)

    assert sentry_smoke.send_sentry_smoke() == {
        "ok": False,
        "sent": False,
        "problem": "SENTRY_DSN is not configured",
    }


def test_sentry_smoke_sends_controlled_message(monkeypatch) -> None:
    calls: list[tuple[str, str]] = []
    flush_timeouts: list[int] = []
    fake_sentry = types.ModuleType("sentry_sdk")
    fake_sentry.capture_message = lambda message, level: (
        calls.append((message, level)) or "event-123"
    )
    fake_sentry.flush = lambda timeout: flush_timeouts.append(timeout)

    monkeypatch.setitem(sys.modules, "sentry_sdk", fake_sentry)
    monkeypatch.setattr(settings, "sentry_dsn", "https://public@example.sentry.io/1")
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(sentry_smoke, "configure_sentry", lambda: True)

    assert sentry_smoke.send_sentry_smoke() == {
        "ok": True,
        "sent": True,
        "event_id": "event-123",
        "environment": "production",
    }
    assert calls == [("SubsMarket Sentry smoke check", "info")]
    assert flush_timeouts == [5]

