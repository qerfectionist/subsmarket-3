from __future__ import annotations

import ast
import re
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "alembic" / "versions"


def test_hot_path_index_migration_keeps_expected_indexes() -> None:
    migration = MIGRATIONS_DIR / "20260620_0017_hot_path_indexes.py"
    content = migration.read_text(encoding="utf-8")

    expected_indexes = {
        "families_discovery_visible_created_idx",
        "families_discovery_visible_type_created_idx",
        "family_requests_family_user_created_desc_idx",
        "family_payments_member_due_created_desc_idx",
        "family_payments_reported_paid_reminder_idx",
        "notification_jobs_dispatch_status_available_created_idx",
    }

    for index_name in expected_indexes:
        assert index_name in content


def test_public_table_migrations_are_hardened_for_supabase_data_api() -> None:
    hardening_migration = (
        MIGRATIONS_DIR / "20260619_0010_supabase_public_schema_hardening.py"
    )
    baseline_hardened_tables = _literal_tuple_assignment(
        hardening_migration.read_text(encoding="utf-8"),
        "PUBLIC_TABLES",
    )

    created_tables: dict[str, str] = {}
    directly_hardened_tables: set[str] = set()
    migration_files = sorted(MIGRATIONS_DIR.glob("*.py"))
    for migration in migration_files:
        content = migration.read_text(encoding="utf-8")
        created_table_names = re.findall(
            r'op\.create_table\(\s*["\']([a-z_][a-z0-9_]*)',
            content,
        )
        for table_name in created_table_names:
            created_tables[table_name] = migration.name
        if "ENABLE ROW LEVEL SECURITY" in content and "REVOKE ALL" in content:
            for table_name in created_tables:
                if table_name in content:
                    directly_hardened_tables.add(table_name)

    unprotected_tables = {
        table_name: migration_name
        for table_name, migration_name in created_tables.items()
        if table_name not in baseline_hardened_tables
        and table_name not in directly_hardened_tables
    }

    assert unprotected_tables == {}


def _literal_tuple_assignment(content: str, name: str) -> set[str]:
    tree = ast.parse(content)
    for node in tree.body:
        if not isinstance(node, ast.Assign):
            continue
        has_target = any(
            isinstance(target, ast.Name) and target.id == name
            for target in node.targets
        )
        if not has_target:
            continue
        value = ast.literal_eval(node.value)
        return set(value)
    raise AssertionError(f"{name} assignment not found")
