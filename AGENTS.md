# AGENTS.md — контекст для AI-ассистентов (Codex, Claude, opencode)

Этот файл описывает архитектурные конвенции и недавние изменения, чтобы
AI-ассистент, начинающий работу над проектом, не опирался на устаревший
контекст. Читать перед правками backend.

## Команды проверки

```powershell
npm run backend:lint      # ruff (через scripts/run-python.mjs — win + posix)
npm run backend:compile   # compileall
npm run backend:test      # pytest (нужна PostgreSQL для *_postgres_* тестов)
npm run build             # frontend tsc + vite
npm run test:ui           # Playwright E2E (7 тестов)
npm run check             # всё подряд
```

Backend-скрипты и Playwright `webServer` кроссплатформенные (`scripts/run-python.mjs`,
`frontend/playwright.config.ts`). CI: `.github/workflows/frontend-check.yml` (build + E2E на
`ubuntu-latest`). UX-контракт экранов: `frontend/docs/ux-states.md`.

Тесты, требующие PostgreSQL:
`test_postgres_concurrency.py`, `test_postgres_schema_security.py`.
Остальные тесты используют SQLite in-memory и запускаются без БД.

## Архитектура

Модульный монолит, DDD-lite. Модули в `backend/src/subsmarket/`:
`identity`, `catalog`, `families`, `notifications`, `jobs`, `bot`, `core`,
`ops`, `dev`. Границы описаны в `docs/architecture.md`.

- `families` — основной домен (Family Engine), не знает про marketplace.
- `notifications` — только enqueues, не меняет бизнес-состояние.
- `core` — shared инфраструктура (config, database, idempotency, rate_limit,
  observability, models).
- `families/service.py` — **теперь re-export модуль**. Реальная логика в
  подмодулях (см. ниже). Сервисы **не делают `db.commit()`** — commit
  выполняется в `get_db` (auto-commit после запроса).

## Структура `families/` (после рефакторинга)

```
families/
  _internal.py   — константы, хелперы, метрики владельца
  creation.py    — create_family, update_family_*
  invites.py     — create/rotate/disable/resolve invites
  queries.py     — to_* мапперы, list_*, get_family_view
  requests.py    — create/cancel/approve/reject join request
  members.py     — leave/remove/acknowledge, close_family, mark_access
  payments.py    — confirm_access, report/confirm/cancel payments, prepayments
  service.py     — re-export всего (для обратной совместимости)
  api.py         — endpoints (зависит от service.py)
  models.py      — SQLAlchemy модели
  schemas.py     — Pydantic схемы
  audit.py       — record_family_audit_event
  calendar.py    — add_payment_period, payment_due_at
  crypto.py      — encrypt/decrypt payment requisite
  pagination.py  — cursor encode/decode
```

**Важно:** `api.py` и `jobs/service.py` импортируют из `families.service`
(который re-экспортирует из подмодулей). Не меняй импорты в `api.py` на
прямые импорты из подмодулей — `service.py` остаётся агрегирующим модулем.

## Недавние изменения (сессия 2026-06-22)

Все проверки зелёные: lint, compile, 146 тестов, frontend build, 7 Playwright E2E.

### 1. Таймзона Казахстана для расчёта периода

**Проблема:** `date.today()` использует локальный TZ сервера. Бизнес-логика
семей привязана к Казахстану (KZ, UTC+5), но `close_family` уже использовал
`KAZAKHSTAN_TIMEZONE`, а `confirm_access_received`, `create_regular_payments`,
`send_regular_payment_reminders`, `get_jobs_status` — нет. Несоответствие
давало off-by-one около полуночи.

**Решение:** общие хелперы в `core/database.py`:
- `KAZAKHSTAN_TIMEZONE = timezone(timedelta(hours=5))`
- `kz_today() -> date` — текущая дата в KZ.

**Затронутые файлы:**
- `core/database.py` — добавлены `KAZAKHSTAN_TIMEZONE` и `kz_today`.
- `families/payments.py` — `confirm_access_received` использует `kz_today()`.
- `jobs/service.py` — `create_regular_payments`, `send_regular_payment_reminders`
  используют `kz_today()`.
- `jobs/monitoring.py` — `get_jobs_status` использует `kz_today()`.
- `dev/demo_flow.py`, `ops/write_load_smoke.py` — используют `kz_today()`.

**Конвенция:** везде, где считается "сегодня" для бизнес-логики семей
(периоды платежей, reminders, closing), использовать `kz_today()`, не
`date.today()`. `utcnow()` остаётся для timestamp-ов.

### 2. Cap на предоплату для monthly

`record_owner_prepaid_periods` (`families/payments.py`) теперь ограничивает
`data.periods > 12` для `family.period == "monthly"` → 409
`MONTHLY_PREPAYMENT_LIMIT_REACHED`. Раньше cap был только для yearly (≤3).

### 3. Guard повторного ack закрытия семьи

`acknowledge_family_closing` (`families/members.py`) теперь возвращает
member без записи в аудит, если `member.closing_acknowledged_at` уже задан
(по аналогии с `acknowledge_member_removal`). Раньше повторный вызов
создавал дубль в `FamilyAuditLog`.

### 4. Дедупликация уведомлений через SQL

**Проблема:** `cancel_pending_payment_notifications`,
`_enqueue_member_notification_once`, `_payment_notification_exists`
грузили все pending jobs получателя и фильтровали по `payload["payment_id"]`
в Python. На росте данных — дорого.

**Решение:** фильтр спущен в SQL через `NotificationJob.payload["key"].as_string()`
(работает для PostgreSQL JSONB и SQLite JSON1). НЕ использовать `.astext` —
это PostgreSQL-only, падает в тестах на SQLite.

**Индекс:** `notification_jobs_recipient_event_created_idx` на
`(recipient_user_id, event_type, created_at)`. Добавлен в модель
`NotificationJob.__table_args__` и в миграцию
`alembic/versions/20260622_0021_notification_dedup_index.py`.

**Затронутые файлы:**
- `families/payments.py` — `cancel_pending_payment_notifications`.
- `jobs/service.py` — `_enqueue_member_notification_once`,
  `_payment_notification_exists`.
- `notifications/models.py` — `Index` в `__table_args__`.
- `alembic/versions/20260622_0021_notification_dedup_index.py` — новая
  миграция (revision `20260622_0021`, down_revision `20260620_0020`).

**Конвенция:** для JSONB payload-фильтров использовать
`Column.payload["key"].as_string() == value`, не `.astext` и не Python-фильтр.

### 5. Изоляция auth-сессии

**Проблема:** `upsert_user` делал `db.commit()` внутри сервиса и вызывался в
`Depends(get_current_user)` для каждого families endpoint. Если endpoint
откатывался, user уже был в БД (сайд-эффект auth в бизнес-транзакции).

**Решение:** добавлена зависимость `get_auth_db` в `core/database.py` —
отдельная сессия для auth. `get_current_user` (`families/api.py`) и
`_me_response` (`identity/api.py`) вызывают `upsert_user(auth_db, ...)` (commit
изолирован в auth_db), затем закрывают auth-сессию до обращения к основной
сессии и получают fresh user через `db.get(User, user.id)`. Это важно: обе
сессии используют один pool, и удержание auth-подключения до конца запроса
может заблокировать бизнес-операции при параллельном входе.

`upsert_user` (`identity/service.py`) **не изменён** — всё ещё коммитит
внутри. Это оставлено осознанно: тест `test_identity_telegram.py` вызывает
`upsert_user` напрямую без явного commit и полагается на внутренний commit.

**Затронутые файлы:**
- `core/database.py` — добавлена `get_auth_db`.
- `families/api.py` — `get_current_user` принимает `auth_db`, импортирует
  `User`, `get_auth_db`.
- `identity/api.py` — endpoints принимают `auth_db`, `_me_response`
  использует auth_db для upsert + db.get для fresh user.
- `tests/test_family_api.py` — фикстура `client` переопределяет
  `get_auth_db` той же test-сессией.

**Конвенция для тестов:** любой TestClient-тест, переопределяющий `get_db`,
должен также переопределять `get_auth_db` той же сессией:
```python
def _db_with_commit() -> Iterator[Session]:
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise

app.dependency_overrides[get_db] = _db_with_commit
app.dependency_overrides[get_auth_db] = lambda: db
```

### 6. Дробление `families/service.py` на подмодули

**Проблема:** `service.py` был ~3440 строк в одном файле.

**Решение:** разбит на 7 подмодулей + `service.py` как re-export:
- `_internal.py` — константы, приватные хелперы, метрики владельца.
- `creation.py` — `create_family`, `update_family_*`, `confirm_family_availability`.
- `invites.py` — `create/rotate/disable/resolve_family_invite`.
- `queries.py` — `to_*` мапперы, `list_*`, `get_family_view`, `list_family_audit_logs`.
- `requests.py` — `create/cancel/approve/reject_join_request`.
- `members.py` — `cancel_member_before_access`, `leave_family`, `remove_member`,
  `revoke/acknowledge_member_removal`, `close_family`, `acknowledge_family_closing`,
  `mark_access_provided`, `remind_access_confirmation`.
- `payments.py` — `confirm_access_received`, `report/cancel/confirm_payment`,
  `mark_payment_not_received`, `create_member_prepayment`,
  `record_owner_prepaid_periods`, `cancel_scheduled_payments`,
  `cancel_pending_payment_notifications`.
- `service.py` — re-export: `from .creation import *` и т.д. с `# noqa: F401`.

**Зависимости между подмодулями:**
- `_internal.py` — не импортирует другие families подмодули.
- `creation.py` → `_internal`, `queries`.
- `invites.py` → `_internal`, `queries`.
- `queries.py` → `_internal`.
- `requests.py` → `_internal`.
- `members.py` → `_internal`, `queries`, `invites`, `payments`, `requests`.
- `payments.py` → `_internal`, `queries`.

Нет circular imports.

### 7. Полный отказ от `db.commit()` в сервисах

**Проблема:** ~30 вызовов `db.commit()` внутри сервисных функций `families/`.
Сайд-эффекты, невозможность композировать операции.

**Решение:**
1. Все `db.commit()` в подмодулях `families/` заменены на `db.flush()`.
   `flush` отправляет изменения в БД в рамках транзакции (видимы для
   последующих `SELECT`/`refresh` в той же сессии), но не фиксирует.
2. `get_db` (`core/database.py`) теперь делает **auto-commit** после
   успешного запроса и **auto-rollback** при исключении:
   ```python
   def get_db() -> Generator[Session]:
       db = SessionLocal()
       try:
           yield db
           db.commit()
       except Exception:
           db.rollback()
           raise
       finally:
           db.close()
   ```
3. `get_auth_db` оставлен без auto-commit (`upsert_user` коммитит внутри).
4. `jobs/service.py` — jobs коммитят внутри `_run_due_job_step` (этот слой
   ок, не менялся).

**Затронутые файлы:**
- `core/database.py` — `get_db` с auto-commit.
- `families/creation.py`, `invites.py`, `requests.py`, `members.py`,
  `payments.py` — `db.commit()` → `db.flush()`.
- `tests/test_family_api.py` — override `get_db` с auto-commit генератором.

**Конвенция:**
- Новые сервисы в `families/` делают `db.flush()` (не `db.commit()`).
- Commit выполняется в `get_db` (или в тестовой фикстуре).
- Сервисные тесты (`test_family_service.py`) работают без явного commit,
  т.к. `flush` достаточно в рамках одной сессии.

### 8. Frontend: React Query для server state

**Проблема:** `App.tsx` — 694 строки, весь серверный стейт на `useState`,
`runAction` после каждого действия делал `await load()` (4 параллельных
запроса). Нет кэша, нет automatic invalidation.

**Решение:**
1. Установлен `@tanstack/react-query`.
2. `main.tsx` — обёрнут в `QueryClientProvider` (staleTime 30s, retry 1).
3. `hooks/useApi.ts` — ~30 hooks: `useQuery` для чтения, `useMutation`
   для записи с `invalidateQueries` после успеха.
4. `App.tsx` — переписан: server state через hooks, UI state (tab, form,
   busy, error, notice) на `useState`. `load()` и `runAction()` заменены
   на `runMutation` (обёртка над `mutateAsync`).

**Query keys** (в `hooks/useApi.ts`):
- `["me"]`, `["services", familyType]`, `["families", familyType]`,
  `["myFamilies"]`, `["myRequests"]`,
- `["familyView", familyId]`, `["familyAuditLog", familyId]`,
  `["familyInvite", familyId]`, `["ownerRequests", familyId]`,
  `["familyMembers", familyId]`, `["familyMemberPayments", familyId]`.

**Конвенция:**
- Новые API вызовы — добавлять hook в `hooks/useApi.ts`.
- Server state — через React Query hooks, не через `useState`.
- UI state (формы, вкладки, busy/error/notice) — `useState`.

### 9. Telegram Mini App нативные UX-элементы

**Что добавлено:**
- `showTelegramConfirm(message): Promise<boolean>` — нативный confirm-попап
  Telegram (Bot API 6.2+), fallback на `window.confirm`. Используется перед
  деструктивными действиями: `close_family`, `leave_family`, `remove_member`,
  `disable_family_invite`.
- `showTelegramAlert(message): Promise<void>` — нативный alert.
- `showTelegramPopup(params): Promise<string>` — кастомный попап с кнопками.
- `setTelegramMainButton(text, handler, options?)` — нативная нижняя кнопка
  Telegram (MainButton). Показывается на экране создания семьи с прогрессом
  и disabled-состоянием. `hideTelegramMainButton()` — скрыть.
  `setTelegramMainButtonProgress(visible)` — toggle loading.
- `setTelegramClosingConfirmation(enabled)` — нативный диалог при попытке
  закрыть Mini App. Включается при `busy !== null` или заполненной форме
  создания семьи, отключается в остальных случаях.

**Скелетоны:**
- `components/skeleton.tsx` — `FamilyCardSkeleton`, `FamilyListSkeleton`,
  `PanelSkeleton`.
- CSS `.skeleton` + `@keyframes skeleton-shimmer` в `styles.css`.
- `SearchScreen` показывает `FamilyListSkeleton` при `isLoading && empty`.

**Затронутые файлы:**
- `telegram.ts` — добавлены типы `TelegramBottomButton`, `TelegramPopupButton`,
  функции `showTelegramAlert/Confirm/Popup`, `setTelegramClosingConfirmation`,
  `setTelegramMainButton`, `hideTelegramMainButton`,
  `setTelegramMainButtonProgress`.
- `App.tsx` — деструктивные действия обёрнуты в `showTelegramConfirm`;
  `useEffect` для `closingConfirmation` и `MainButton` на экране создания.
- `components/skeleton.tsx` — новый файл.
- `screens/SearchScreen.tsx` — `isLoading` prop + skeleton.
- `styles.css` — `.skeleton*` классы и `skeleton-shimmer` анимация.

**Конвенция:**
- Деструктивные действия (remove, close, disable, leave) — через
  `showTelegramConfirm`, не через кастомный modal.
- Главный CTA экрана — через `setTelegramMainButton`, не через кнопку в
  контенте (если экран подразумевает одно основное действие).
- Loading state списка — `Skeleton` компонент, не пустой экран.
- При форме с unsaved changes — `setTelegramClosingConfirmation(true)`.

### 10. Telegram UI Kit (`@telegram-apps/telegram-ui`)

**Что добавлено:**
- `@telegram-apps/telegram-ui` v2.1.13 — библиотека нативных компонентов
  Telegram. Установлена с `--legacy-peer-deps` (React 19 vs peer dep).
- `main.tsx` — обёрнут в `AppRoot` с `appearance` (light/dark из
  `Telegram.WebApp.colorScheme`) и `platform` (ios/base из
  `Telegram.WebApp.platform`).
- `import "@telegram-apps/telegram-ui/dist/styles.css"` — стили библиотеки.
- `components/layout.tsx` — мигрированы на telegram-ui:
  - `AppHeader` → `Section` + `Cell` + `Avatar` (с acronym fallback).
  - `DevUserSwitch` → `Section` + `Cell`.
  - `Panel` → `Section` (header, footer).
  - `FamilyTypeSwitch` → `List` + `Button` (mode filled/plain).
- `components/families.tsx` — мигрированы на telegram-ui:
  - `FamilyCard` → `Card` + `Cell` (title, subtitle, description, multiline).
  - `OwnerDetails` → `Section` + `Cell` (before, after, description).
  - `OwnerSection` → `Section` (header с count).
  - `PaymentList` → `Section` + `Cell`.
  - Все кнопки → `Button` (size="s", mode="filled"/"plain").
  - `TaskCounter` → кастомный span (telegram-ui Badge только number/dot).
- `App.tsx` — `notice` заменён на `Snackbar` из telegram-ui:
  - `toast` state вместо `notice`.
  - `toastMessage(label)` — карта label → контекстное сообщение
    ("Семья создана", "Заявка отправлена", "Оплата подтверждена" и т.д.).
  - `Snackbar` с `duration={3000}`, auto-dismiss, before-icon "✓".

**Не мигрированы (оставлены кастомные):**
- `Badge` — telegram-ui Badge только для number/dot уведомлений, не для
  status labels.
- `Skeleton` — нет в v2.1.13. Используется свой CSS shimmer.
- `EmptyState` — Placeholder не принимает arbitrary JSX children с кнопками.
- `BottomNav` — нет прямого аналога (FixedTabs/Tabs другое).

**Конвенция:**
- Новые компоненты — предпочитать `@telegram-apps/telegram-ui` если есть
  подходящий (Section, Cell, List, Button, Avatar, Modal, Snackbar).
- Кастомные классы — только если нет аналога в библиотеке.
- Не использовать `Badge` из telegram-ui для status labels — он для
  number/dot индикаторов.
- Toast-уведомления — через `Snackbar` из telegram-ui, не через
  `inline-success` div.
- Кнопки в списках/карточках — `Button` size="s", mode="filled" (primary)
  или "plain" (secondary).

### 11. UX-улучшения (раунд 2)

**Backend:**
- `_cancel_pending_requests_for_full_family` (`requests.py`) — добавлен
  `with_for_update()` для симметрии с closing-family (убирает гонку при
  параллельном self-cancel).
- `_get_or_create_owner_metric_for_update` (`_internal.py`) — убран лишний
  `with_for_update` на `User` (создавал contention). Lock остаётся только
  на `FamilyOwnerMetric`.

**Frontend:**
- `RequisiteBox` (`components/RequisiteBox.tsx`) — номер телефона маскируется
  (`+7 *** *** ** 67`), кнопка "Показать"/"Скрыть". Заменила inline-вывод
  в `MyFamiliesScreen` и `FamilyDetailsScreen`.
- `BottomNav` — badge-индикаторы: сччик активных заявок на "Заявки",
  сччик семей с pending payments на "Семьи". CSS `.nav-badge`.
- `CreateFamilyScreen` — валидация в реальном времени: телефон (`+7\d{10}`),
  цена > 0, день 1-31, дата не в прошлом, max_members ≤ service.max.
  Inline ошибки `.field-error`, submit disabled при ошибках.
- `OwnerDetails` (`families.tsx`) — табы "Заявки | Участники | Оплаты"
  вместо 3 секций на одном скролле. Активный таб через `ownerTab` state.
  CSS `.owner-tabs`.

### 12. Немедленное удаление участника владельцем

**Продуктовое правило:** владелец может удалить участника сразу. Он обязан
выбрать причину: нет оплаты, нет ответа, проблема с доступом, по договорённости
или другое. Участник получает уведомление, но не может отменить удаление.

**Решение:**
- `remove_member` сразу переводит участника в `removed`, освобождает место и
  отменяет будущие платежи.
- Причина и время удаления навсегда сохраняются в `FamilyAuditLog`.
- В Mini App после удаления показывается обычное подтверждение, без окна
  отмены.
- Старый статус `removal_pending` оставлен только для безопасной обработки
  записей, созданных прежней версией приложения; новые удаления его не создают.

**Конвенция:** не добавлять ожидание, отмену или запрос отмены удаления без
нового продуктового решения.

**Не сделано (план):**
- **Marketplace Engine** — отдельный крупный модуль (см. `docs/architecture.md`).

### 13. Playwright E2E для основных flow семьи

**Проблема:** E2E-тестов не было — регрессии UI (overlay-intercepts,
race-условия React Query, табы OwnerDetails) ловились вручную.

**Решение:**
- `frontend/tests/family-flow.spec.ts` — 6 тестов:
  1. `owner and member complete the first payment family flow` — полный flow:
     create family → invite → join request → approve → access provided →
     confirm access → report payment → confirm payment → prepayment →
     immediate member removal with a reason.
  2. `subscription and tariff families stay in separate storefronts` —
     изоляция familyType в search/MyFamilies.
  3. `create family form validates phone in real time` — inline-валидация
     телефона (`+7\d{10}`), цены, дня.
  4. `requisite phone is masked until revealed` — `RequisiteBox` маскирует
     телефон (`+7 *** *** ** 67`) до тапа "Показать".
  5. `owner tabs switch between requests members and payments` — табы
     OwnerDetails переключаются, badge-индикаторы обновляются.
  6. `owner removes a member immediately with a reason` — место освобождается,
     а участник исчезает из активного списка.
- `frontend/tests/tma-smoke.spec.ts` — 1 тест: TMA renders home/search/details.
- Хелперы в spec-файле: `switchDevUser`, `openNav`, `waitForNetworkQuiet`,
  `clickAndWait`. Все `.click()` используют `force: true` (telegram-ui
  компоненты имеют overlay-эффекты, перехватывающие pointer events).

**Frontend-фиксы для тестов:**
- `components/families.tsx` — `OwnerDetails` auto-switch таба: если
  `details.requests.length === 0` и `ownerTab === "requests"`,
  `useEffect` переключает на `"members"`. Без этого `access-provided-button`
  оставался невидимым после approve последней заявки (тест таймаутился).
- `hooks/useApi.ts` — `useRevokeMemberRemoval` инвалидирует `ownerRequests`,
  `familyMembers`, `familyView`.

**Затронутые файлы:**
- `frontend/tests/family-flow.spec.ts` — новый файл, 6 тестов + хелперы.
- `frontend/tests/tma-smoke.spec.ts` — существующий, 1 тест.
- `frontend/src/components/families/OwnerDetails.tsx` — `useEffect` для auto-switch табы.
- `frontend/src/App.tsx` — `data-testid` на Undo button.

**Конвенции для E2E:**
- Все `.click()` в Playwright — с `force: true` (telegram-ui overlays).
- После state-changing API вызовов — `waitForNetworkQuiet(page)` (ждёт
  React Query refetch + re-render).
- Для проверки исчезновения элемента — `toHaveCount(0)`, не `not.toBeVisible()`
  (надёжнее после re-render).
- Dev user switch через `switchDevUser(page, id)` + `openNav(page, index)`.
- Backend должен быть запущен (`npm run backend:dev` или через
  `npm run dev`), иначе тесты упадут на network-connect.
- Для Snackbar-кнопок — добавлять `data-testid`, не искать по тексту
  (telegram-ui может рендерить несколько кнопок с одинаковым текстом).
**Команда запуска:**
```powershell
npm run test:ui      # все 7 Playwright тестов
npm run backend:dev  # нужен для E2E (запустить в отдельном терминале)
```

### 17. Frontend API split и OpenAPI (2026-06-25)

**Сделано:** `api/typed.ts` — `typedGet`/`typedPatch` + pilot `typedIdentity`.
`api/identity.ts` делегирует в `typedIdentity`. Расширять pilot перед миграцией
остальных `api/*.ts`; после изменений backend — `npm run openapi:sync`.

**Сделано:** логика React Query hooks разделена в `hooks/api/`
(`queryKeys`, `identity`, `catalog`, `families-queries`, `families-mutations`);
`hooks/useApi.ts` остаётся re-export для обратной совместимости.
Новые hooks — в соответствующий подмодуль + re-export.

### 16. API-модули без shim `api.ts` (2026-06-25)

**Было:** корневой `frontend/src/api.ts` re-export shim.

**Стало:** публичный API только через `frontend/src/api/index.ts`:
`client`, `dev`, `identity`, `catalog`, `families`. Импорты `from "./api"` /
`from "../api"` резолвятся в папку `api/`.

### 15. Frontend container state (текущее состояние)

`App.tsx` пока остаётся основным контейнером экранов, навигации, toast/error
state, owner details и requisites cache. Не добавлять второй параллельный слой
`AppContext`/router/mutations без отдельного полноценного рефакторинга всего
`App.tsx`.

Если продолжать frontend-рефактор:
- сначала выделить один маленький кусок из `App.tsx`;
- подключить его в реальный render path;
- обновить E2E под новый поток;
- не оставлять неподключённые hooks/components "на потом".

## Соглашения для правок

- Не использовать `.astext` для JSON column — только `.as_string()`.
- `date.today()` — только в code без бизнес-логики; в бизнес-логике семей —
  `kz_today()` из `core.database`.
- Новые TestClient-тесты: переопределять и `get_db` (с auto-commit), и
  `get_auth_db` той же сессией.
- Новые миграции: revision id в формате `YYYYMMDD_NNNN`, down_revision =
  предыдущая. Текущая голова: `20260622_0021`.
- JSON payload-фильтры в SQL — через `Column.payload["key"].as_string()`.
- Сервисы в `families/` подмодулях делают `db.flush()` (не `db.commit()`).
  Commit — в `get_db`.
- `upsert_user` коммитит внутри (до отдельной задачи).
- Новые функции в `families/` — добавлять в соответствующий подмодуль
  (`creation`, `invites`, `queries`, `requests`, `members`, `payments`),
  не в `service.py`. `service.py` — только re-export.
- Новые frontend API вызовы — функция в `frontend/src/api/{module}.ts`,
  re-export в `api/index.ts`; hook в `hooks/api/{domain}.ts` + re-export из
  `hooks/useApi.ts`. Импорт API: `from "./api"` или `from "../api"`.
- Пока `App.tsx` остаётся главным контейнером frontend-состояния. Не добавлять
  параллельный `AppContext`/router слой без полного подключения в render path.
- Playwright `.click()` — всегда с `force: true` (telegram-ui overlay-эффекты
  перехватывают pointer events). После state-changing API —
  `waitForNetworkQuiet(page)`.
- Для проверки исчезновения элемента в E2E — `toHaveCount(0)`, не
  `not.toBeVisible()` (надёжнее после re-render).
- Snackbar-кнопки — добавлять `data-testid`, не искать по тексту
  (telegram-ui может рендерить несколько кнопок с одинаковым текстом).
- UX-контракт: `frontend/docs/ux-states.md`.
