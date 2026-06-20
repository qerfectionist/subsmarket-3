from __future__ import annotations

import os

import pytest
from sqlalchemy import create_engine, text

from subsmarket.core.config import normalize_sqlalchemy_database_url
from subsmarket.core.database import Base
from subsmarket.models import import_models

POSTGRES_TEST_DATABASE_URL = os.getenv("POSTGRES_TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not POSTGRES_TEST_DATABASE_URL,
    reason="POSTGRES_TEST_DATABASE_URL is not configured",
)


def test_all_application_tables_have_rls_and_no_supabase_client_grants() -> None:
    import_models()
    engine = create_engine(
        normalize_sqlalchemy_database_url(POSTGRES_TEST_DATABASE_URL or "")
    )
    expected_tables = set(Base.metadata.tables)

    try:
        with engine.connect() as connection:
            rls_rows = connection.execute(
                text(
                    """
                    select c.relname, c.relrowsecurity
                    from pg_class c
                    join pg_namespace n on n.oid = c.relnamespace
                    where n.nspname = 'public'
                      and c.relkind = 'r'
                      and c.relname = any(:table_names)
                    """
                ),
                {"table_names": sorted(expected_tables)},
            ).all()
            rls_by_table = {
                table_name: bool(enabled) for table_name, enabled in rls_rows
            }

            assert set(rls_by_table) == expected_tables
            assert {
                table_name
                for table_name, enabled in rls_by_table.items()
                if not enabled
            } == set()

            available_roles = set(
                connection.scalars(
                    text(
                        """
                        select rolname
                        from pg_roles
                        where rolname in ('anon', 'authenticated')
                        """
                    )
                ).all()
            )
            for role in available_roles:
                granted_tables = set(
                    connection.scalars(
                        text(
                            """
                            select table_name
                            from information_schema.role_table_grants
                            where grantee = :role
                              and table_schema = 'public'
                              and table_name = any(:table_names)
                            """
                        ),
                        {
                            "role": role,
                            "table_names": sorted(expected_tables),
                        },
                    ).all()
                )
                assert granted_tables == set()
    finally:
        engine.dispose()
