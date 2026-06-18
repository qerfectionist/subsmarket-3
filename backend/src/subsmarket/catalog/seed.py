from __future__ import annotations

from subsmarket.catalog.service import import_family_services
from subsmarket.core.config import settings
from subsmarket.core.database import SessionLocal


def main() -> None:
    with SessionLocal() as db:
        imported = import_family_services(
            db,
            settings.catalog_file,
            activate_demo=settings.demo_activate_catalog,
        )
    print(
        f"Imported {imported} services "
        f"(demo activation={settings.demo_activate_catalog})"
    )


if __name__ == "__main__":
    main()
