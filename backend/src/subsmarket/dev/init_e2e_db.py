from __future__ import annotations

from subsmarket.core.config import settings
from subsmarket.core.database import Base, SessionLocal, engine
from subsmarket.marketplace.bootstrap import ensure_development_marketplace_catalog
from subsmarket.models import import_models


def main() -> None:
    if not settings.sqlalchemy_database_url.startswith("sqlite"):
        raise RuntimeError("E2E database reset is allowed only for sqlite URLs")

    import_models()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        ensure_development_marketplace_catalog(db)
        db.commit()
    engine.dispose()
    print("Initialized E2E SQLite database")


if __name__ == "__main__":
    main()
