# Subsmarket 3.0

Telegram Mini App и инфраструктура доверия для совместной оплаты цифровых
подписок и семейных тарифов мобильных операторов.

Проект собирается заново. Код из `subsmarket 2.0` не переносится целиком:
сначала из него выделены полезные продуктовые сценарии, доменные правила и
проверенные технические решения.

## Текущий статус

- Проведен аудит старого проекта.
- Утверждены продуктовые правила MVP.
- Основной домен называется `Family`; термин `Club` не используется.
- Family Engine покрывает семьи цифровых подписок и отдельный тип семей
  мобильных тарифов.

Документы:

- [Продуктовое видение](docs/product-vision.md)
- [Архитектура](docs/architecture.md)
- [Спецификация MVP](docs/mvp-spec.md)
- [Доменная модель](docs/domain-model.md)
- [Схема БД](docs/database-schema.md)
- [API контракт](docs/api-contract.md)
- [Экраны Mini App](docs/mini-app-screens.md)
- [Telegram Mini App plan](docs/telegram-mini-app.md)
- [План разработки](docs/development-plan.md)
- [Долгий roadmap](docs/long-term-roadmap.md)
- [Gap-аудит Family Engine MVP](docs/mvp-gap-audit.md)
- [Каталог семейных подписок](docs/catalog.md)
- [Деплой и инфраструктура](docs/deployment.md)
- [Аудит старого проекта](docs/legacy-audit.md)

## Первый этап

1. Каталог цифровых сервисов.
2. Поиск доступных семей.
3. Создание семьи.
4. Заявка на вступление.
5. Подтверждение заявки владельцем.
6. Учет участников семьи.
7. Подтверждение доступа перед раскрытием реквизитов.
8. Календарь взносов и контроль своевременной оплаты.
9. 30-минутный таймер первого платежа.
10. Telegram-аутентификация и напоминания.

Владелец принимает участника в семью внутри Subsmarket. Добавление в семейный
план YouTube, Netflix или другого сервиса он выполняет отдельно, например по
email. Mini App фиксирует получение доступа, но не хранит логины и пароли.

На первом этапе нет чеков, платежного посредничества, споров, админки,
отдельного диалогового интерфейса бота, аккаунтов, гигабайтов, `slot_config` и
`slot_type`. Семьи тарифов существуют как отдельный тип Family без сложных
слотов: одно место = один участник.

Следующие этапы добавляются отдельно и не должны заранее усложнять модель
семьи подписки.

## Локальный запуск

Требования:

- Python 3.12+
- Node.js 24+
- Docker для PostgreSQL

Backend:

```powershell
docker compose up -d postgres
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
alembic upgrade head
python -m subsmarket.catalog.seed
uvicorn subsmarket.main:app --reload
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Из корня проекта также доступны короткие команды:

```powershell
npm run build
npm run test:ui
npm run backend:lint
npm run backend:compile
npm run backend:test
npm run backend:test:postgres
npm run check:diff
npm run check
```

PostgreSQL-only lock and schema-security tests. Start local Postgres first with
`docker compose up -d postgres`; the command below uses the local Docker URL by
default. Set `POSTGRES_TEST_DATABASE_URL` only when testing another database.

```powershell
npm run backend:test:postgres
```

Production backend smoke after deployment:

```powershell
$env:PRODUCTION_API_URL='https://<backend-domain>'
cd backend
.\.venv\Scripts\python -m subsmarket.ops.production_smoke
```

## Production infrastructure

- Frontend: Vercel.
- Backend API: Render web service.
- Database: Supabase PostgreSQL project `subsmarket-3`
  (`oulwqlysozrdhlhheflk`, `eu-central-1`).
- Background jobs: GitHub Actions workflow
  `.github/workflows/subsmarket-jobs.yml`.

Production database state:

- Alembic version: verify before deploy with `alembic current`; older setup
  notes referenced `20260619_0011`, but the repository head is newer.
- Catalog: 26 subscription services and 5 tariff services.
- Supabase public tables have RLS enabled with explicit deny policies for
  `anon` and `authenticated`; the Mini App never connects to Supabase directly.

По умолчанию dev-режим использует демо Telegram-пользователя из `.env.example`.
Исходный каталог остается `pending_verification`, но seed в dev-режиме может
активировать записи для локальной проверки через `DEMO_ACTIVATE_CATALOG=true`.
