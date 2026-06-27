"""Print evidence from a normalized Telegram family-subscriptions export."""

from __future__ import annotations

import json
import re
import sys
from collections.abc import Iterable
from pathlib import Path
from typing import Any


TOPICS = {
    "Предложения мест": r"(?:добавлю|есть\s+(?:\d+\s+)?мест|свободн\w*\s+мест|мест[ао]\s+в)",
    "Поиск семьи или места": r"(?:ищу|нужн\w*).{0,40}(?:семь|тариф|мест|подписк|актив|билайн|tele2|алтел)",
    "Мобильные тарифы": r"(?:актив|activ|beeline|билайн|tele2|теле2|altel|алтел|kcell|кселл)",
    "Цифровые подписки": r"(?:youtube|ютуб|spotify|спотиф|яндекс|duolingo|дуолинго|netflix|gemini|google ai|apple one|ivi|иви|кинопоиск)",
    "Роутеры": r"роутер",
    "Оплата и просрочки": r"(?:не\s*оплат|задерж|просроч|оплат[аиы]ть|пополн)",
    "Даты и продления": r"(?:кажд\w*\s+\d+|до\s+\d{1,2}\.\d{1,2}|месяц|год|продлен|следующ)",
    "Групповые скидки": r"(?:скидк|выгодно вместе|групп)",
    "AI-сервисы": r"(?:gemini|chatgpt|grok|claude|antigravity)",
}


def print_sample(title: str, messages: Iterable[dict[str, Any]], limit: int = 8) -> None:
    print(f"\n--- {title} ---")
    for message in list(messages)[-limit:]:
        text = (message["text"] or "").replace("\n", " / ")
        print(
            f"#{message['message_id']} | {message['sent_at_raw']} | "
            f"{message['sender_name'] or 'Без имени'}: {text[:650]}"
        )


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/analyze_telegram_market_research.py <messages.json>")

    payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    messages = [
        message
        for message in payload["messages"]
        if message["event_type"] == "message" and message["text"]
    ]
    matches = {
        name: [message for message in messages if re.search(pattern, message["text"], re.I | re.S)]
        for name, pattern in TOPICS.items()
    }
    offers = matches["Предложения мест"]
    money = re.compile(r"\b\d{2,5}\s*(?:тг|тенге|₸)", re.I)
    dates = re.compile(TOPICS["Даты и продления"], re.I | re.S)

    print(f"Обычных сообщений: {len(messages)}")
    for name, values in matches.items():
        print(f"{name}: {len(values)}")
    print(
        "Структура предложений: "
        f"{len(offers)} всего; {sum(bool(money.search(m['text'])) for m in offers)} с ценой; "
        f"{sum(bool(dates.search(m['text'])) for m in offers)} с датой или периодом."
    )
    print_sample("Групповые скидки", matches["Групповые скидки"])
    print_sample("Оплата и просрочки", matches["Оплата и просрочки"])
    print_sample("Роутеры", matches["Роутеры"])
    print_sample("AI-сервисы", matches["AI-сервисы"])


if __name__ == "__main__":
    main()
