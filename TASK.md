# TASK.md - SubsMarket 3.0 Active Memory State

## 🎯 Active Goal
**SubsMarket 3.0 UI & Performance Polish**
Deliver an ultra-responsive, Apple HIG-inspired Telegram Mini App for subscription and tariff sharing, with sub-second agent feedback loops, strict architectural boundaries, and modular components.

---

## 🏛️ Architecture & Core Modules

### 1. Family Engine (`backend/src/subsmarket/families/`)
- **Domain**: Subscription families and cellular tariff families.
- **Modular Structure**:
  - `_internal.py`: Domain constants and internal helpers.
  - `creation.py`: Family initialization and updates.
  - `invites.py`: Invite links and token validation.
  - `queries.py`: Projections and read queries.
  - `requests.py`: Join requests and approval flow.
  - `members.py`: Participant management, access confirmation, expulsions.
  - `payments.py`: Payments and prepayments schedule.
  - `service.py`: Compatibility re-export facade ONLY (no direct business logic).

### 2. Marketplace Engine (`backend/src/subsmarket/marketplace/`)
- **Domain**: Peer-to-peer Gigabytes and Account trading verticals.
- **Invariant**: Strict DDD-lite boundary. Marketplace items are NEVER modeled as families. No bank credentials or raw logins stored.

### 3. Telegram Mini App Frontend (`frontend/src/`)
- **Viewport**: Mobile-first 390 × 844 (device scale factor 2).
- **State Architecture**: TanStack Query for server state cache, React local state for UI interactions.
- **Visual Design System**: `docs/design-system.md`, Lucide icons, native Telegram WebApp bridges (`frontend/src/telegram.ts`).
- **Canonical UI Baseline**: Screen "Мои" (`MyFamiliesScreen.tsx`, `mode="mine"`) is the gold standard for layout rhythm, chips, counters, and cards.

---

## ⚡ 3-Tier Subagent Workflow
To maximize agent speed and minimize token overhead:
1. **Scout** (`Model: 'flash'`, role: `Repo Scout`):
   - Fast 1–2s pre-retrieval context mapping: `npm run scout -- <query>`.
   - Checks file line counts before editing (Rule 17).
2. **Builder** (`Model: 'inherit'`, role: `Coder` / `self`):
   - Modular implementation, single-purpose functions, clean diffs.
3. **Verifier** (`npm run verify:agent`, role: `Tester`):
   - Rapid bounded check (<1.5s): TypeScript compile, Python ruff, line hygiene.

---

## 🔒 Active Invariants & Quality Rules

| Category | Invariant Rule |
|---|---|
| **Rule 17 (Anti-Monolith)** | Target 350–400 lines per file. Monoliths (1,000+ lines) strictly forbidden. Decompose into `*Card.tsx`, `*Drawer.tsx`, custom hooks, or `@import` CSS. |
| **Backend Transactions** | Use `db.flush()` in `families` services. Never call `db.commit()` inside service functions. |
| **Authentication Isolation** | `get_auth_db` strictly isolated from business transaction DB sessions. |
| **Dates & Timestamps** | Business dates use `kz_today()`; event timestamps use `utcnow()`. |
| **JSON Column Queries** | Filter via `Column.payload["key"].as_string()`, never `.astext` or in Python memory. |
| **UI Safety** | Destructive actions must require native Telegram confirmation dialogs. |
| **Test Verification** | Targeted tests after every change; full regression (`npm run check`) strictly every 10th change. |

---

## 📊 Current State & Task Checklist

### Completed Milestones
- [x] Restored canonical Category Menu (2x2 grid, original colors & icons).
- [x] Floating developer drawer & Stepwise Deal Resolution modal.
- [x] Fast verification runner (`scripts/verify-fast.mjs`, `npm run verify:fast` < 1.5s).
- [x] Symbol AST explorer (`scripts/lsp-symbols.mjs`, `npm run symbols`).
- [x] MCP Optimizer & Profile Manager (`scripts/mcp-profile.mjs`, `npm run mcp:profile` for `lean` vs `full`).
- [x] Fast Pre-Retrieval Scout Tool & Spec (`scripts/scout.mjs`, `.agent/subagents/scout.md`, `npm run scout`).
- [x] Active Memory System (`TASK.md`).

### Active & Upcoming Tasks
- [ ] Run targeted and regression tests to verify cleanliness.
- [ ] Optimize TMA asset caching and network prefetch strategies.
- [ ] Finalize production release checklist.
