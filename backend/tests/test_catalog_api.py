from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from subsmarket.core.config import settings
from subsmarket.core.database import Base, get_db
from subsmarket.main import app
from subsmarket.models import import_models


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


def test_catalog_import_requires_internal_token_in_production(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "internal_job_token", "job-secret")

    missing_token = client.post("/api/catalog/import-family-services")
    wrong_token = client.post(
        "/api/catalog/import-family-services",
        headers={"X-Internal-Job-Token": "wrong"},
    )
    valid_token = client.post(
        "/api/catalog/import-family-services",
        headers={"X-Internal-Job-Token": "job-secret"},
    )

    assert missing_token.status_code == 403
    assert missing_token.json()["detail"] == "INVALID_INTERNAL_JOB_TOKEN"
    assert wrong_token.status_code == 403
    assert wrong_token.json()["detail"] == "INVALID_INTERNAL_JOB_TOKEN"
    assert valid_token.status_code == 200
    assert valid_token.json()["imported"] > 0
