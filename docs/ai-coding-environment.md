# AI Coding Environment (Windows 2026)

Комплексная среда разработки, оптимизированная для высокоскоростного парного программирования с AI-агентами (Cline, Codex CLI, Claude Code).

---

## 1. Системный профиль

- **ОС**: Windows 11 Pro (Build 10.0.26200, AMD64)
- **Терминал**: Windows Terminal (`wt.exe`)
- **Основной Shell**: PowerShell 7.6.6 (`pwsh.exe`)
- **Вспомогательный Shell**: Windows PowerShell 5.1 (`powershell.exe`)
- **Контейнеризация**: Docker Desktop 29.8.0, Docker Compose v5.5.1, WSL 2.7.14
- **Резервные копии конфигов**: `C:\Users\qerfe\AI-Coding-Backups\20261003_035647\`

---

## 2. Инвентарь инструментов и CLI-утилит

| Утилита | Версия | Назначение | Команда запуска |
|---|---|---|---|
| **PowerShell 7** | 7.6.6 | Основная оболочка разработки | `pwsh` |
| **Git** | 2.52.0 | Контроль версий с Delta пейджером | `git` |
| **Delta** | 0.19.2 | Синтаксическая подсветка diff и zdiff3 | `delta` / `git diff` |
| **GitHub CLI** | 2.86.0 | Интеграция с GitHub (`qerfectionist`) | `gh` |
| **Mise** | 2026.9.18 | Менеджер задач и окружений проектов | `mise` |
| **Zoxide** | 0.10.0 | Смарт-навигация по каталогам | `z <дир>` |
| **Lazygit** | 0.65.1 | Терминальный TUI для Git | `lazygit` / `lg` |
| **Ripgrep** | 15.2.0 | Быстрый поиск по содержимому файлов | `rg` / `srch <шаблон>` |
| **fd** | 10.5.0 | Быстрый поиск файлов и каталогов | `fd` / `files` |
| **fzf** | 0.74.4 | Интерактивный fuzzy finder | `fzf` / `ff` |
| **bat** | 0.26.1 | Просмотр файлов с подсветкой синтаксиса | `bat <файл>` |
| **ast-grep** | 0.45.3 | Семантический поиск по AST кода | `ast-grep` / `sg` |
| **Difftastic** | 0.70.0 | Структурный diff по синтаксическому дереву | `difft` |
| **jq** | 1.8.2 | Парсер и процессор JSON в командной строке | `jq` |
| **hyperfine** | 1.20.0 | Бенчмаркинг команд и CLI | `hyperfine` |
| **ShellCheck** | 0.11.0 | Статический анализ shell-скриптов | `shellcheck` |
| **Zellij** | 0.45.1 | Мультиплексор терминала | `zellij` |
| **Yazi** | 26.9.1 | Терминальный файловый менеджер | `yazi` / `ya` |
| **Node.js** | 24.12.0 | JavaScript/TypeScript среда выполнения | `node`, `npm`, `yarn` |
| **Python** | 3.12.8 | Бэкенд runtime (FastAPI, Alembic) | `python` |
| **uv** | 0.11.32 | Быстрый менеджер пакетов Python | `uv` |

---

## 3. PowerShell Helper Functions & Aliases

Сконфигурированы в `$PROFILE` для PowerShell 7 и Windows PowerShell 5.1:

```powershell
croot          # Перейти в корень текущего Git-репозитория
lg             # Запустить LazyGit
ff             # Интерактивный выбор файла через fd + fzf и открытие в редакторе
srch <pattern> # Поиск текста через ripgrep по всему проекту
files          # Список файлов проекта через fd (без .git)
gd             # git diff (с авто-подсветкой Delta)
gs             # git status
gb             # Показать имя текущей ветки
verify         # Запуск быстрой верификации через mise/scripts/verify.ps1

# Управление изолированными Git Worktrees
wt-new <branch> [path] # Создать ветку в отдельном worktree
wt-list                # Показать список активных worktree
wt-remove <path>       # Удалить worktree после завершения задачи

# SubsMarket 3.0 хелперы
sm-test <spec> # Запуск Playwright теста: sm-test actions-archive-cancel.spec.ts
sm-check       # Полный регрессионный прогон
sm-build       # Сборка фронтенда
```

---

## 4. Конфигурация AI-агентов (Cline / Codex / Claude Code)

1. **Модульные правила `.clinerules/`**:
   - `00-core.md`: Принципы работы, ADHD-стиль вывода, безопасность (запрет деструктивных git-команд).
   - `10-architecture.md`: Модульный монолит, границы Family и Marketplace движков, правило анти-монолита (350–400 строк).
   - `20-coding.md`: React 19, Lucide иконки, TypeScript, `kz_today()`, `utcnow()`, `Column.payload["key"].as_string()`.
   - `30-testing.md`: Таргетированные тесты, регресс раз в 10 изменений, обязательный визуальный скриншот.
   - `40-git.md`: Защита dirty worktree, delta diff, гигиена пробелов.

2. **MCP-серверы (`.mcp.json` и `cline_mcp_settings.json`)**:
   - `playwright`: Браузерная автоматизация и снятие скриншотов через `@executeautomation/playwright-mcp-server`.
   - `context7`: Анализ документации и контекста через `@upstash/context7-mcp`.

3. **Mise Задачи (`mise.toml`)**:
   - `mise run verify` -> `scripts/verify.ps1` (ruff lint + compileall + labels + tsc build + diff hygiene за ~6.5 сек).
   - `mise run dev` -> запуск инфраструктуры и локального стека.
   - `mise run test` -> запуск тестов.
