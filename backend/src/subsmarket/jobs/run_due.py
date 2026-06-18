from __future__ import annotations

from subsmarket.core.database import SessionLocal
from subsmarket.jobs.service import run_due_jobs


def main() -> None:
    with SessionLocal() as db:
        result = run_due_jobs(db)
    print(result.model_dump_json())


if __name__ == "__main__":
    main()
