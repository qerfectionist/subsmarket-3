"""Summarize product-relevant categories in the broad Telegram market export."""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any


CATEGORIES = {
    "Семейные подписки": r"(?:семейн\w*|family|мест[ао]\s+в\s+семь|вступлю\s+в\s+семь)",
    "Семейные тарифы": r"(?:актив|activ|beeline|билайн|tele2|теле2|altel|алтел|kcell|кселл).{0,55}(?:семь|тариф|групп)|(?:семь|тариф).{0,55}(?:актив|activ|beeline|билайн|tele2|теле2|altel|алтел|kcell|кселл)",
    "Гигабайты и интернет": r"(?:\bгб\b|\bgb\b|гигабайт|трафик|интернет|безлимит)",
    "Аккаунты и доступы": r"(?:аккаунт|доступ|логин|пароль|учетн\w*\s+запис)",
    "AI-сервисы": r"(?:chatgpt|gemini|grok|claude|openai|midjourney|antigravity|sora)",
    "Видео и музыка": r"(?:youtube|ютуб|netflix|spotify|спотиф|кинопоиск|яндекс\s*плюс|ivi|иви|megogo|apple\s*music)",
    "Облако и работа": r"(?:google\s*one|icloud|i\s*cloud|onedrive|microsoft\s*365|office\s*365|canva|notion)",
    "Обучение": r"(?:duolingo|дуолинго|coursera|skillbox|udemy|quizlet)",
    "Безопасность и VPN": r"(?:vpn|adguard|kaspersky|антивирус)",
}


def normal_messages(raw: list[dict[str, Any]]) -> list[dict[str, str]]:
    return [
        {
            "id": str(message.get("id", "")),
            "timestamp": str(message.get("timestamp", "")),
            "sender": str(message.get("sender", "")),
            "text": str(message.get("text", "")),
        }
        for message in raw
        if message.get("type") == "message" and message.get("text")
    ]


def print_samples(title: str, matches: list[dict[str, str]], limit: int = 5) -> None:
    print(f"\n--- {title} ({len(matches)}) ---")
    for message in matches[-limit:]:
        text = message["text"].replace("\n", " / ")
        print(f"{message['id']} | {message['timestamp']} | {message['sender']}: {text[:480]}")


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/analyze_general_telegram_market.py <messages.json>")

    raw = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    messages = normal_messages(raw)
    matches = {
        label: [message for message in messages if re.search(pattern, message["text"], re.I | re.S)]
        for label, pattern in CATEGORIES.items()
    }
    print(f"Обычных сообщений: {len(messages)}")
    for label, values in matches.items():
        print(f"{label}: {len(values)}")

    repeated = Counter(
        re.sub(r"\s+", " ", message["text"].strip().lower())
        for message in messages
        if len(message["text"].strip()) > 12
    )
    print(f"Повторяющихся текстов (4+ раз): {sum(count >= 4 for count in repeated.values())}")
    for label in CATEGORIES:
        print_samples(label, matches[label])


if __name__ == "__main__":
    main()
