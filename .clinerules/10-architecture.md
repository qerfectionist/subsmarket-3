# 10-architecture.md: System Architecture & Invariants

1. **Modular Monolith (DDD-Lite)**:
   - Backend modules in `backend/src/subsmarket/`: `identity`, `catalog`, `families`, `marketplace`, `notifications`, `jobs`, `bot`, `core`, `ops`.
   - Clear boundaries: Family Engine (`families/`) and Marketplace Engine (`marketplace/`) DO NOT share business models.

2. **Anti-Monolith Guidelines (350–400 lines)**:
   - Standard target for files (React `.tsx`, hooks `.ts`, styles `.css`, Python `.py`) is 350–400 lines.
   - Decompose into clean child components, dedicated hooks, and split CSS stylesheets.
   - Exceeding 400 lines is permitted ONLY when justified by single-screen cohesion or indivisible business logic. Never allow 1,000+ line monsters.

3. **Backend Service Layer Rules**:
   - `families/service.py` is strictly a re-export facade. Business logic belongs in `creation.py`, `requests.py`, `members.py`, `payments.py`, `queries.py`.
   - Never call `db.commit()` in services; use `db.flush()`. Transaction commits belong in `get_db`.
