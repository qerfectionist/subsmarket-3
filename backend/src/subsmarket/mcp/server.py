from __future__ import annotations

import logging
from typing import Any

from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings

logger = logging.getLogger("subsmarket.mcp")

mcp_server = MCPServer(
    name="SubsMarket-Controller",
    version="0.1.0",
    description="Read-only SubsMarket statistics for AI agents",
)


class PlatformDataUnavailable(RuntimeError):
    """Raised instead of returning invented numbers when the DB is unreachable."""


def _query_stats() -> dict[str, Any]:
    from sqlalchemy import func, select

    from subsmarket.core.database import SessionLocal
    from subsmarket.families.models import Family
    from subsmarket.identity.models import User
    from subsmarket.marketplace.models import MarketplaceListing

    try:
        with SessionLocal() as db:
            return {
                "users_total": db.scalar(select(func.count(User.id))) or 0,
                "families_total": db.scalar(select(func.count(Family.id))) or 0,
                "marketplace_listings": (
                    db.scalar(select(func.count(MarketplaceListing.id))) or 0
                ),
            }
    except Exception as exc:
        logger.warning("Failed querying platform stats: %s", exc)
        raise PlatformDataUnavailable(
            f"DATABASE_UNAVAILABLE: {exc.__class__.__name__}"
        ) from exc


@mcp_server.tool()
async def get_platform_stats() -> dict[str, Any]:
    """Get real platform statistics: user, family and listing counts.

    Fails with an error when the database is unavailable; never returns
    placeholder numbers.
    """
    return {
        "currency": "KZT",
        "platform": "SubsMarket 3.0",
        **_query_stats(),
    }


@mcp_server.tool()
async def get_system_health() -> dict[str, Any]:
    """Check whether this MCP server can reach the SubsMarket database.

    It does not check the API, scheduler or notification queue; use the
    internal jobs status endpoint for those.
    """
    try:
        _query_stats()
    except PlatformDataUnavailable as exc:
        return {"database": "unavailable", "error": str(exc)}
    return {"database": "ok"}


@mcp_server.tool()
async def list_active_families(limit: int = 5) -> list[dict[str, Any]]:
    """List the most recently created active or full families."""
    from sqlalchemy import select
    from sqlalchemy.orm import joinedload

    from subsmarket.core.database import SessionLocal
    from subsmarket.families.models import Family

    safe_limit = max(1, min(limit, 50))
    try:
        with SessionLocal() as db:
            families = list(
                db.scalars(
                    select(Family)
                    .options(joinedload(Family.service))
                    .where(Family.status.in_({"active", "full"}))
                    .order_by(Family.created_at.desc())
                    .limit(safe_limit)
                ).all()
            )
            return [
                {
                    "id": str(f.id),
                    "service": (
                        (f.service.name if f.service else f.plan_name) or "Custom"
                    ),
                    "family_type": f.family_type,
                    "price_kzt": f.member_share_kzt,
                    "free_places": max(0, f.max_members - f.active_members_count),
                    "status": f.status,
                }
                for f in families
            ]
    except Exception as exc:
        logger.warning("Failed querying active families: %s", exc)
        raise PlatformDataUnavailable(
            f"DATABASE_UNAVAILABLE: {exc.__class__.__name__}"
        ) from exc


@mcp_server.tool()
async def list_marketplace_listings(limit: int = 10) -> list[dict[str, Any]]:
    """List the most recent active gigabyte listings."""
    from sqlalchemy import select
    from sqlalchemy.orm import joinedload

    from subsmarket.core.database import SessionLocal
    from subsmarket.marketplace.models import MarketplaceListing

    safe_limit = max(1, min(limit, 50))
    try:
        with SessionLocal() as db:
            listings = list(
                db.scalars(
                    select(MarketplaceListing)
                    .options(joinedload(MarketplaceListing.operator))
                    .where(MarketplaceListing.status == "active")
                    .order_by(MarketplaceListing.published_at.desc())
                    .limit(safe_limit)
                ).all()
            )
            return [
                {
                    "id": str(lst.id),
                    "type": lst.listing_type,
                    "operator": lst.operator.name if lst.operator else "Unknown",
                    "price_per_gb_kzt": lst.price_per_gb_kzt,
                    "status": lst.status,
                }
                for lst in listings
            ]
    except Exception as exc:
        logger.warning("Failed querying marketplace listings: %s", exc)
        raise PlatformDataUnavailable(
            f"DATABASE_UNAVAILABLE: {exc.__class__.__name__}"
        ) from exc


# Dispute analysis and user bans are not implemented in the product. The former
# stub tools returned invented dossiers and reported bans that never happened,
# so they were removed rather than left to mislead an agent.


def run_server(host: str = "127.0.0.1", port: int = 8003) -> None:
    security = TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=[f"{host}:{port}", f"localhost:{port}", host, "localhost"],
        allowed_origins=[f"http://{host}:{port}", f"http://localhost:{port}"],
    )
    mcp_server.run(
        transport="streamable-http",
        host=host,
        port=port,
        streamable_http_path="/mcp",
        stateless_http=True,
        transport_security=security,
    )


if __name__ == "__main__":
    run_server()
