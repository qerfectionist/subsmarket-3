# Локальная база Telegram-исследования

Эта база нужна как рабочая память по рынку: когда появляются продуктовые вопросы,
можно быстро проверить реальные сообщения из Telegram-чата, не перечитывая экспорт вручную.

## Где лежит

- Источник: `C:\Users\qerfe\Downloads\Telegram Desktop\ChatExport_2026-05-29\json_output`
- Локальная база: `data/research/market_chat.sqlite`
- Импортёр: `tools/build_market_research_db.py`
- Поиск: `tools/query_market_research_db.py`

`data/research/` не коммитится в git. В базе есть тексты сообщений, но телефоны,
Telegram username и ссылки заменяются на `[phone]`, `[telegram_username]`, `[url]`.
Имена отправителей не сохраняются: вместо них хранится стабильный hash, чтобы считать
уникальных авторов без раскрытия личности.

## Как обновить базу

```powershell
backend\.venv\Scripts\python.exe tools\build_market_research_db.py
```

## Быстрые проверки

Общая статистика:

```powershell
backend\.venv\Scripts\python.exe tools\query_market_research_db.py stats
```

Топ подписок:

```powershell
backend\.venv\Scripts\python.exe tools\query_market_research_db.py services --category subscription
```

Топ семейных тарифов:

```powershell
backend\.venv\Scripts\python.exe tools\query_market_research_db.py services --category mobile_tariff
```

Топ болей:

```powershell
backend\.venv\Scripts\python.exe tools\query_market_research_db.py pains
```

Поиск по сообщениям:

```powershell
backend\.venv\Scripts\python.exe tools\query_market_research_db.py search "не отвечает" --limit 10
```

Примеры по сервису:

```powershell
backend\.venv\Scripts\python.exe tools\query_market_research_db.py examples youtube --limit 10
```

## Как использовать в разработке

Если возникает спорный продуктовый вопрос, сначала проверяем базу:

- как люди формулируют спрос;
- какие сервисы и операторы чаще встречаются;
- какие проблемы повторяются;
- где нужен отдельный экран, предупреждение или правило.

Эта база не заменяет продуктовое решение, но помогает не гадать вслепую.
