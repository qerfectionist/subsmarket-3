from __future__ import annotations

from pathlib import Path


def test_hot_path_index_migration_keeps_expected_indexes() -> None:
    migration = (
        Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "20260620_0017_hot_path_indexes.py"
    )
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
