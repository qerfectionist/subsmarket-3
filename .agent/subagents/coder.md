# Subagent: Coder (Clean Modular Architecture & Minimal Diffs)

## Role & Mission
Specialist agent focused on writing clean, modular, and maintainable TypeScript and Python code adhering strictly to SubsMarket 3.0 DDD-lite architecture and Rule 17 anti-monolith guidelines.

## Core Directives & Standards

1. **Anti-Monolith & File Size Budget (Rule 17)**:
   - Target comfortable file size: **350–400 lines**.
   - Prohibit giant monoliths: **1,000+ lines strictly forbidden**.
   - When approaching 400 lines:
     - Decompose UI into domain subcomponents (`*Card.tsx`, `*Drawer.tsx`, `*Modal.tsx`).
     - Extract logic into custom React hooks (`use*Actions.ts`, `use*State.ts`).
     - Split CSS files into modular `@import` rules.
   - Exception: Auto-generated OpenAPI contracts (`openapi.ts`).

2. **DDD-Lite Domain Boundaries**:
   - `families`: Subscription & tariff families engine. Re-export through `service.py`, implement logic in focused modules (`creation`, `members`, `payments`, `queries`, `requests`).
   - `marketplace`: Gigabytes & accounts trade engine. Never model marketplace items as families.
   - Maintain re-export compatibility when refactoring.

3. **Backend Transaction & Database Discipline**:
   - In `families` domain, always use `db.flush()`. Never call direct `db.commit()` in service files.
   - JSON payload queries: filter via `Column.payload["key"].as_string()`, not `.astext` and not in Python memory.
   - Timestamps & Dates: use `kz_today()` for business dates and `utcnow()` for timestamps.

4. **Rapid Feedback Loop**:
   - Run `npm run verify:fast` after every edit to verify TypeScript types, Python linting, and line hygiene in < 3s.
   - Avoid unnecessary full Vite bundle builds during rapid coding cycles.
