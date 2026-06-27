# ECC adoption plan for SubsMarket

Дата анализа: 2026-06-27  
Источник: `https://github.com/affaan-m/ECC.git`  
Проверенный commit: `2bc924faf2f8e893bfe0af86b1931283693c30ae`

## Короткий вывод

ECC полезен не как библиотека для backend/frontend SubsMarket, а как набор
практик для работы AI-агентов: skills, проверки, безопасность, деплой,
верификация, E2E, production audit.

Целиком устанавливать ECC в проект или глобально в Codex сейчас не нужно.
Установщик ECC пишет в пользовательскую папку Codex (`~/.codex`): `AGENTS.md`,
`config.toml`, agents, MCP-конфиги, skills и scripts. Для нашего проекта это
слишком широкий эффект: можно случайно поменять глобальное поведение Codex и
сломать текущий рабочий процесс.

Правильный путь для SubsMarket: взять идеи ECC как локальные проектные
чеклисты и правила, без подключения чужих hooks/MCP/автоустановщика.

## Что НЕ устанавливаем

| Часть ECC | Решение | Почему |
| --- | --- | --- |
| Полный ECC installer | Не ставим | Меняет глобальную папку Codex, слишком большой риск побочных изменений. |
| Глобальный `~/.codex/config.toml` из ECC | Не ставим | У нас уже есть рабочая конфигурация Codex и проектный `AGENTS.md`. |
| Все ECC skills пачкой | Не ставим | Много лишнего, часть правил конфликтует с нашим стеком и процессом. |
| Чужие hooks | Не ставим | Hooks могут запускать команды автоматически. Это риск для секретов и рабочей машины. |
| Чужие MCP-конфиги | Не ставим | MCP получает доступ к внешним сервисам; подключать нужно только вручную и точечно. |
| ECC как npm dependency проекта | Не ставим | Это не runtime-библиотека для FastAPI, React или Telegram Mini App. |

## Что берем в SubsMarket

### 1. Production audit workflow

Берем идею ECC `production-audit`: перед релизом проверять проект по фактам из
локального кода, а не по ощущениям.

Для SubsMarket это означает:

- проверять `/health`, `/ready`, `/api/internal/jobs/health`;
- проверять OpenAPI;
- проверять Sentry DSN и отсутствие утечки секретов;
- проверять Render/Vercel env;
- проверять GitHub jobs;
- проверять rate limit через Redis;
- проверять Supabase/Postgres миграции;
- фиксировать результат в `docs/production-cutover-status.md`.

У нас уже есть близкие документы:

- `docs/release-checklist.md`;
- `docs/backend-readiness-plan.md`;
- `docs/production-cutover-status.md`;
- `docs/monitoring-and-security-setup.md`.

Действие: не создавать новый параллельный процесс, а усилить существующие
release/production документы пунктами из ECC.

### 2. Verification loop

Берем идею ECC `verification-loop`: после заметного изменения всегда гонять
короткий набор проверок.

Для SubsMarket базовый цикл:

```powershell
npm run backend:lint
npm run backend:compile
npm run backend:test
npm run build
npm run test:ui
```

Для релиза:

```powershell
npm run check
npm run production:check
```

Действие: использовать это как обязательный финальный шаг после backend-правок,
особенно перед деплоем.

### 3. Security review checklist

Берем идею ECC `security-review`, но адаптируем под наш продукт.

Для SubsMarket главные зоны риска:

- Telegram initData и webhook secret;
- Render/Vercel/Supabase/Redis/Sentry токены;
- платежные реквизиты владельца;
- rate limiting;
- гонки при вступлении, оплате, удалении и последнем свободном месте;
- CORS;
- публичные dev endpoints;
- логи без секретов;
- SQLAlchemy-запросы без ручной SQL-склейки.

Действие: добавить эти пункты в security/monitoring checklist, а не ставить
чужой security scanner как автоматическую зависимость.

### 4. Postgres patterns

Берем идеи ECC `postgres-patterns`:

- индексы под реальные частые запросы;
- cursor pagination вместо безлимитных списков;
- `FOR UPDATE SKIP LOCKED` для очередей;
- частичные индексы для active/pending статусов;
- отдельные проверки конкурентных сценариев на PostgreSQL.

У нас это уже частично есть:

- есть PostgreSQL concurrency tests;
- есть notification outbox;
- есть rate limit через Redis;
- есть cursor pagination helper.

Действие: следующий backend-аудит делать вокруг индексов, пагинации и
конкурентных операций.

### 5. E2E testing patterns

Берем идею ECC `e2e-testing`: Page Object Model и стабильные data-testid.

Для SubsMarket важно:

- не увеличивать E2E хаотично;
- держать тесты вокруг реальных пользовательских flow;
- не проверять дизайн ради дизайна;
- проверять семейные подписки и семейные тарифы отдельно;
- при добавлении аккаунтов и гигабайтов вынести отдельные flow.

Действие: позже можно разделить большой `family-flow.spec.ts` на маленькие
файлы и добавить page objects, но сейчас это не блокер.

### 6. Agent safety

Самая ценная часть ECC для нас — дисциплина безопасности AI-агентов.

Правила для SubsMarket:

- не запускать чужие install scripts без dry-run;
- не ставить чужие hooks/MCP без отдельного решения;
- не хранить токены в документах;
- не коммитить `.env`;
- любые глобальные изменения Codex сначала документировать;
- все проектные правила держать в `AGENTS.md` и `docs/`, а не в скрытой
  глобальной магии.

## Что можно сделать позже

### Локальные skills для Codex

Если понадобится, можно сделать не установку ECC, а свои маленькие skills:

- `subsmarket-production-audit`;
- `subsmarket-security-review`;
- `subsmarket-backend-verification`;
- `subsmarket-tma-e2e-review`.

Они должны ссылаться на наши команды и наши документы, а не тащить весь ECC.

### AgentShield

ECC предлагает `ecc-agentshield` для проверки `.claude` конфигурации.
Для нас это не первоочередно, потому что основной проектный контекст живет в
`AGENTS.md`, а не в `.claude`. Можно вернуться к этому позже, если начнем
активно использовать Claude Code hooks/agents.

## Решение

На текущем этапе:

1. ECC целиком не устанавливаем.
2. В проектные зависимости ничего из ECC не добавляем.
3. Используем ECC как источник лучших практик.
4. Усиливаем наши существующие документы и проверки.
5. Следующая практическая работа после этого анализа: backend-hardening,
   production checks, индексы, конкурентные тесты, мониторинг и чистота секретов.

