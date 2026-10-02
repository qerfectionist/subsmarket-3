# 20-coding.md: Coding Standards & Stack Rules

1. **Frontend (React 19 / TypeScript 5 / Vite)**:
   - Prefer functional components and custom hooks.
   - Use TanStack Query for server state; avoid global store sprawl.
   - Icons: exclusively `lucide-react`. Native Telegram WebApp SDK: `frontend/src/telegram.ts`.
   - UI Reference: `MyFamiliesScreen.tsx` (`mode="mine"`) is the gold standard for layout rhythm, chips, filters, and 10px spacing.

2. **Backend (Python 3.12 / FastAPI / SQLAlchemy 2.0)**:
   - Dates: Always calculate business dates via `kz_today()`; timestamps via `utcnow()`.
   - Database queries: JSON payload filtering via `Column.payload["key"].as_string()`, never `.astext` or in Python memory.
   - Migrations: Check current head via `alembic heads`; test upgrade on Postgres.

3. **Tooling & Dev Helpers**:
   - Use `verify` (`mise run verify`) for instant validation.
   - Use `sm-test <spec>` for fast targeted test runs.
