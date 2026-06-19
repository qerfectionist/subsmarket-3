from __future__ import annotations

from subsmarket.core.config import Settings


def test_postgres_engine_kwargs_include_bounded_pool() -> None:
    settings = Settings(
        DATABASE_URL="postgresql://db.example/subsmarket",
        DB_POOL_SIZE=3,
        DB_MAX_OVERFLOW=2,
        DB_POOL_TIMEOUT_SECONDS=7,
        DB_POOL_RECYCLE_SECONDS=900,
        DB_CONNECT_TIMEOUT_SECONDS=4,
    )

    assert settings.sqlalchemy_engine_kwargs == {
        "pool_pre_ping": True,
        "pool_size": 3,
        "max_overflow": 2,
        "pool_timeout": 7,
        "pool_recycle": 900,
        "connect_args": {
            "connect_timeout": 4,
            "application_name": "subsmarket-api",
        },
    }


def test_sqlite_engine_kwargs_skip_queue_pool_options() -> None:
    settings = Settings(DATABASE_URL="sqlite+pysqlite:///:memory:")

    assert settings.sqlalchemy_engine_kwargs == {"pool_pre_ping": True}

