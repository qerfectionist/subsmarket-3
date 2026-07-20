from __future__ import annotations

import json
from typing import Any

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text

from subsmarket.core.database import SessionLocal
from subsmarket.families.crypto import decrypt_payment_requisite

COUNTED_TABLES = (
    "users",
    "family_services",
    "families",
    "family_members",
    "family_payments",
    "family_audit_logs",
    "notification_jobs",
    "idempotency_records",
)

ORPHAN_CHECKS = {
    "family_members_without_family": """
        SELECT count(*)
        FROM family_members member
        LEFT JOIN families family ON family.id = member.family_id
        WHERE family.id IS NULL
    """,
    "family_members_without_user": """
        SELECT count(*)
        FROM family_members member
        LEFT JOIN users app_user ON app_user.id = member.user_id
        WHERE app_user.id IS NULL
    """,
    "family_payments_without_member": """
        SELECT count(*)
        FROM family_payments payment
        LEFT JOIN family_members member ON member.id = payment.member_id
        WHERE member.id IS NULL
    """,
}


def expected_migration_head() -> str:
    config = Config("alembic.ini")
    return ScriptDirectory.from_config(config).get_current_head() or ""


def requisite_format(value: str) -> str:
    if value.startswith("v3:"):
        return "v3"
    if value.startswith("v2:"):
        return "v2"
    return "legacy"


def run_restore_smoke() -> dict[str, Any]:
    problems: list[str] = []
    with SessionLocal() as db:
        migration_head = expected_migration_head()
        restored_revision = db.scalar(text("SELECT version_num FROM alembic_version"))
        if restored_revision != migration_head:
            problems.append(
                "migration mismatch: "
                f"restored={restored_revision} expected={migration_head}"
            )

        counts = {
            table: int(db.scalar(text(f'SELECT count(*) FROM "{table}"')) or 0)
            for table in COUNTED_TABLES
        }
        orphan_counts = {
            name: int(db.scalar(text(query)) or 0)
            for name, query in ORPHAN_CHECKS.items()
        }
        for name, count in orphan_counts.items():
            if count:
                problems.append(f"{name}: {count}")

        encrypted_requisites = list(
            db.scalars(text("SELECT encrypted_phone FROM family_payment_requisites"))
        )
        requisite_formats = {"v3": 0, "v2": 0, "legacy": 0}
        decryption_failures = 0
        for encrypted in encrypted_requisites:
            requisite_formats[requisite_format(encrypted)] += 1
            try:
                decrypted = decrypt_payment_requisite(encrypted)
                if not decrypted:
                    decryption_failures += 1
            except Exception:
                decryption_failures += 1
        if decryption_failures:
            problems.append(
                f"payment requisite decryption failures: {decryption_failures}"
            )

        db.rollback()

    return {
        "ok": not problems,
        "restored_revision": restored_revision,
        "expected_revision": migration_head,
        "table_counts": counts,
        "orphan_counts": orphan_counts,
        "payment_requisites": {
            "total": len(encrypted_requisites),
            "formats": requisite_formats,
            "decryption_failures": decryption_failures,
        },
        "problems": problems,
    }


def main() -> None:
    result = run_restore_smoke()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
