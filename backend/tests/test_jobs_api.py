from __future__ import annotations

from collections.abc import Iterator
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from subsmarket.core.config import settings
from subsmarket.core.database import Base, get_db, utcnow
from subsmarket.identity.models import User
from subsmarket.main import app
from subsmarket.models import import_models
from subsmarket.notifications.models import NotificationJob


@pytest.fixture()
def db() -> Iterator[Session]:
    import_models()
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with session_factory() as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def client(db: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


def test_jobs_status_requires_internal_token_in_production(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "internal_job_token", "job-secret")

    missing = client.get("/api/internal/jobs/status")
    wrong = client.get(
        "/api/internal/jobs/status",
        headers={"X-Internal-Job-Token": "wrong"},
    )
    ok = client.get(
        "/api/internal/jobs/status",
        headers={"X-Internal-Job-Token": "job-secret"},
    )

    assert missing.status_code == 403
    assert wrong.status_code == 403
    assert ok.status_code == 200
    assert ok.json()["status"] == "ok"
    assert ok.json()["notification_queue"]["pending_total"] == 0


def test_jobs_health_returns_ok_when_no_attention_is_needed(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "internal_job_token", "job-secret")

    response = client.get(
        "/api/internal/jobs/health",
        headers={"X-Internal-Job-Token": "job-secret"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_jobs_health_returns_503_when_notifications_need_attention(
    client: TestClient,
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "internal_job_token", "job-secret")
    user = User(
        telegram_user_id=909001,
        username="jobs_health_user",
        first_name="Jobs Health",
    )
    db.add(user)
    db.flush()
    db.add(
        NotificationJob(
            recipient_user_id=user.id,
            event_type="jobs_health_failed_test",
            status="failed",
            attempts=5,
            failed_at=utcnow() - timedelta(minutes=1),
            error="telegram blocked",
        )
    )
    db.commit()

    response = client.get(
        "/api/internal/jobs/health",
        headers={"X-Internal-Job-Token": "job-secret"},
    )

    assert response.status_code == 503
    assert response.json()["status"] == "attention"
    assert "notification_failures_last_24h" in response.json()["warnings"]
