from __future__ import annotations

import sys
import types

import subsmarket.core.observability as observability
from subsmarket.core.config import settings


class FakeFastApiIntegration:
    def __init__(self, **kwargs):
        self.kwargs = kwargs


class FakeSqlalchemyIntegration:
    pass


def test_sentry_is_disabled_without_dsn(monkeypatch) -> None:
    monkeypatch.setattr(observability, "_configured", False)
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "sentry_dsn", None)

    assert observability.configure_sentry() is False


def test_sentry_is_disabled_outside_production_even_with_dsn(monkeypatch) -> None:
    monkeypatch.setattr(observability, "_configured", False)
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "sentry_dsn", "https://public@example.sentry.io/1")

    assert observability.configure_sentry() is False


def test_sentry_initializes_when_production_dsn_is_present(monkeypatch) -> None:
    calls: list[dict[str, object]] = []
    fake_sentry = types.ModuleType("sentry_sdk")
    fake_sentry.init = lambda **kwargs: calls.append(kwargs)
    fake_integrations = types.ModuleType("sentry_sdk.integrations")
    fake_fastapi = types.ModuleType("sentry_sdk.integrations.fastapi")
    fake_fastapi.FastApiIntegration = FakeFastApiIntegration
    fake_sqlalchemy = types.ModuleType("sentry_sdk.integrations.sqlalchemy")
    fake_sqlalchemy.SqlalchemyIntegration = FakeSqlalchemyIntegration

    monkeypatch.setitem(sys.modules, "sentry_sdk", fake_sentry)
    monkeypatch.setitem(sys.modules, "sentry_sdk.integrations", fake_integrations)
    monkeypatch.setitem(sys.modules, "sentry_sdk.integrations.fastapi", fake_fastapi)
    monkeypatch.setitem(
        sys.modules,
        "sentry_sdk.integrations.sqlalchemy",
        fake_sqlalchemy,
    )
    monkeypatch.setattr(observability, "_configured", False)
    monkeypatch.setattr(settings, "sentry_dsn", "https://public@example.sentry.io/1")
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "sentry_send_default_pii", False)
    monkeypatch.setattr(settings, "sentry_traces_sample_rate", 0.1)
    monkeypatch.setattr(settings, "sentry_release", "test-release")

    assert observability.configure_sentry() is True

    assert calls == [
        {
            "dsn": "https://public@example.sentry.io/1",
            "environment": "production",
            "send_default_pii": False,
            "traces_sample_rate": 0.1,
            "integrations": calls[0]["integrations"],
            "release": "test-release",
        }
    ]
    assert len(calls[0]["integrations"]) == 2


def test_sentry_initialization_is_idempotent(monkeypatch) -> None:
    calls: list[dict[str, object]] = []
    fake_sentry = types.ModuleType("sentry_sdk")
    fake_sentry.init = lambda **kwargs: calls.append(kwargs)
    fake_integrations = types.ModuleType("sentry_sdk.integrations")
    fake_fastapi = types.ModuleType("sentry_sdk.integrations.fastapi")
    fake_fastapi.FastApiIntegration = FakeFastApiIntegration
    fake_sqlalchemy = types.ModuleType("sentry_sdk.integrations.sqlalchemy")
    fake_sqlalchemy.SqlalchemyIntegration = FakeSqlalchemyIntegration

    monkeypatch.setitem(sys.modules, "sentry_sdk", fake_sentry)
    monkeypatch.setitem(sys.modules, "sentry_sdk.integrations", fake_integrations)
    monkeypatch.setitem(sys.modules, "sentry_sdk.integrations.fastapi", fake_fastapi)
    monkeypatch.setitem(
        sys.modules,
        "sentry_sdk.integrations.sqlalchemy",
        fake_sqlalchemy,
    )
    monkeypatch.setattr(observability, "_configured", False)
    monkeypatch.setattr(settings, "sentry_dsn", "https://public@example.sentry.io/1")
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "sentry_release", None)

    assert observability.configure_sentry() is True
    assert observability.configure_sentry() is True

    assert len(calls) == 1
