from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from subsmarket.catalog.schemas import CatalogImportResult, FamilyServiceOut
from subsmarket.catalog.service import import_family_services, list_family_services
from subsmarket.core.config import settings
from subsmarket.core.database import get_db

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.get("/family-services", response_model=list[FamilyServiceOut])
def get_family_services(
    status: str | None = Query(default="active"),
    category: str | None = Query(default=None),
    family_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[FamilyServiceOut]:
    return list_family_services(
        db,
        status=status,
        category=category,
        family_type=family_type,
    )


@router.post("/import-family-services", response_model=CatalogImportResult)
def import_catalog(db: Session = Depends(get_db)) -> CatalogImportResult:
    imported = import_family_services(
        db,
        settings.catalog_file,
        activate_demo=settings.demo_activate_catalog,
    )
    return CatalogImportResult(
        imported=imported,
        activated_for_demo=settings.demo_activate_catalog,
    )
