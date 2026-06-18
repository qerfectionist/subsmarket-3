from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from subsmarket.core.database import get_db
from subsmarket.main import app


class ReadyDb:
    def execute(self, _statement) -> None:
        return None


class FailingReadyDb:
    def execute(self, _statement) -> None:
        raise SQLAlchemyError("db down")


def test_health_endpoint_is_lightweight() -> None:
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_endpoint_checks_database() -> None:
    app.dependency_overrides[get_db] = lambda: ReadyDb()
    try:
        with TestClient(app) as client:
            response = client.get("/ready")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_ready_endpoint_returns_503_when_database_is_down() -> None:
    app.dependency_overrides[get_db] = lambda: FailingReadyDb()
    try:
        with TestClient(app) as client:
            response = client.get("/ready")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json()["detail"] == "DATABASE_NOT_READY"
