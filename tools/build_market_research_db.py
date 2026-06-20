from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
from collections.abc import Iterable
from datetime import datetime
from pathlib import Path
from typing import Any


DEFAULT_EXPORT_DIR = Path(
    r"C:\Users\qerfe\Downloads\Telegram Desktop\ChatExport_2026-05-29\json_output"
)
DEFAULT_DB_PATH = Path("data/research/market_chat.sqlite")

PHONE_RE = re.compile(
    r"(?<!\d)(?:\+?7|8)[\s\-()]?\d{3}[\s\-()]?\d{3}[\s\-()]?\d{2}[\s\-()]?\d{2}(?!\d)"
)
USERNAME_RE = re.compile(r"(?<![\w])@[\w\d_]{4,32}", re.IGNORECASE)
URL_RE = re.compile(r"https?://\S+", re.IGNORECASE)
SPACE_RE = re.compile(r"\s+")
NON_WORD_RE = re.compile(r"[^\w\s+#]+", re.UNICODE)

SENDER_HASH_PREFIX = "subsmarket-market-research-v1:"

SERVICE_PATTERNS: dict[str, tuple[str, str, tuple[str, ...]]] = {
    "tele2": ("Tele2", "mobile_tariff", ("tele2", "теле2", "теле 2", "теле-2")),
    "activ": ("Activ", "mobile_tariff", ("activ", "актив")),
    "beeline": ("Beeline", "mobile_tariff", ("beeline", "билайн")),
    "altel": ("Altel", "mobile_tariff", ("altel", "алтел")),
    "izi": ("Izi", "mobile_tariff", ("izi", "изи")),
    "kcell": ("Kcell", "mobile_tariff", ("kcell", "кселл")),
    "youtube": (
        "YouTube Premium",
        "subscription",
        ("youtube", "ютуб", "ютюб", "ютуб премиум", "youtube premium"),
    ),
    "netflix": ("Netflix", "subscription", ("netflix", "нетфликс")),
    "yandex_plus": (
        "Yandex Plus",
        "subscription",
        ("яндекс плюс", "yandex plus", "яндекс", "kinopoisk", "кинопоиск"),
    ),
    "spotify": ("Spotify", "subscription", ("spotify", "спотифай")),
    "duolingo": ("Duolingo", "subscription", ("duolingo", "дуолинго")),
    "ivi": ("Ivi", "subscription", ("ivi", "иви")),
    "apple_music": ("Apple Music", "subscription", ("apple music", "эпл музыка")),
    "apple_one": ("Apple One / iCloud", "subscription", ("apple one", "icloud", "айклауд")),
    "hbo_max": ("HBO / Max", "subscription", ("hbo", "max", "макс")),
    "microsoft_365": (
        "Microsoft 365",
        "subscription",
        ("microsoft 365", "office 365", "майкрософт"),
    ),
    "megogo": ("Megogo", "subscription", ("megogo", "мегого")),
    "google_one": ("Google One", "subscription", ("google one", "гугл ван")),
    "gb": (
        "Gigabytes",
        "marketplace_later",
        ("гб", "гигабайт", "гигабайты", "интернет"),
    ),
    "chatgpt": ("ChatGPT", "marketplace_later", ("chatgpt", "чатгпт", "чат gpt", "gpt")),
    "gemini": ("Gemini", "marketplace_later", ("gemini", "гемини")),
    "capcut": ("CapCut", "marketplace_later", ("capcut", "капкат")),
    "canva": ("Canva", "marketplace_later", ("canva", "канва")),
}

PAIN_PATTERNS: dict[str, tuple[str, tuple[str, ...]]] = {
    "free_slot": ("Free slot / availability", ("место", "слот", "есть место", "ищу", "приму")),
    "price": ("Price / terms", ("цена", "сколько", "по чем", "стоимость", "тенге", "тг")),
    "payment": ("Payment / period", ("оплат", "каспи", "перевод", "месяц", "год", "платеж")),
    "no_reply": ("No reply / ignore", ("не отвечает", "игнор", "молчит", "ответьте")),
    "access_issue": (
        "Access problem",
        ("не работает", "выкинуло", "доступ", "не заходит", "ошибка", "проблема"),
    ),
    "region": ("Region / VPN / address", ("регион", "страна", "адрес", "vpn", "впн")),
    "trust": ("Scam / trust", ("обман", "скам", "кид", "мошен", "развод")),
}


def normalize_text(value: str) -> str:
    value = value.lower().replace("ё", "е")
    value = URL_RE.sub(" ", value)
    value = USERNAME_RE.sub(" ", value)
    value = PHONE_RE.sub(" ", value)
    value = NON_WORD_RE.sub(" ", value)
    return SPACE_RE.sub(" ", value).strip()


def redact_text(value: str) -> str:
    value = PHONE_RE.sub("[phone]", value)
    value = USERNAME_RE.sub("[telegram_username]", value)
    value = URL_RE.sub("[url]", value)
    return value


def sender_hash(sender: str | None) -> str | None:
    if not sender:
        return None
    return hashlib.sha256(f"{SENDER_HASH_PREFIX}{sender}".encode("utf-8")).hexdigest()


def parse_timestamp(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.replace(" UTC", " ")
    try:
        return datetime.strptime(normalized, "%d.%m.%Y %H:%M:%S %z").isoformat()
    except ValueError:
        return None


def extract_text(message: dict[str, Any]) -> str:
    text = message.get("text", "")
    if isinstance(text, str):
        return text
    if isinstance(text, list):
        parts: list[str] = []
        for item in text:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                parts.append(str(item.get("text", "")))
        return "".join(parts)
    return ""


def has_any_term(normalized_text: str, terms: Iterable[str]) -> bool:
    padded = f" {normalized_text} "
    for term in terms:
        normalized_term = normalize_text(term)
        if normalized_term and (
            f" {normalized_term} " in padded or normalized_term in normalized_text
        ):
            return True
    return False


def iter_messages(export_dir: Path) -> Iterable[dict[str, Any]]:
    jsonl_path = export_dir / "messages.jsonl"
    with jsonl_path.open("r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if line:
                yield json.loads(line)


def create_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;

        DROP TABLE IF EXISTS service_mentions;
        DROP TABLE IF EXISTS pain_mentions;
        DROP TABLE IF EXISTS reactions;
        DROP TABLE IF EXISTS messages;
        DROP TABLE IF EXISTS import_metadata;
        DROP TABLE IF EXISTS message_search;

        CREATE TABLE import_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE messages (
            id INTEGER PRIMARY KEY,
            source_order INTEGER NOT NULL UNIQUE,
            message_id TEXT NOT NULL,
            message_type TEXT NOT NULL,
            sent_at TEXT,
            timestamp_text TEXT,
            sender_hash TEXT,
            text_redacted TEXT NOT NULL,
            normalized_text TEXT NOT NULL,
            reply_to TEXT,
            has_forward INTEGER NOT NULL DEFAULT 0,
            has_media INTEGER NOT NULL DEFAULT 0,
            media_filename TEXT,
            reaction_total INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE reactions (
            message_rowid INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
            emoji TEXT NOT NULL,
            count INTEGER NOT NULL
        );

        CREATE TABLE service_mentions (
            message_rowid INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
            service_key TEXT NOT NULL,
            service_label TEXT NOT NULL,
            category TEXT NOT NULL,
            PRIMARY KEY (message_rowid, service_key)
        );

        CREATE TABLE pain_mentions (
            message_rowid INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
            pain_key TEXT NOT NULL,
            pain_label TEXT NOT NULL,
            PRIMARY KEY (message_rowid, pain_key)
        );

        CREATE VIRTUAL TABLE message_search USING fts5(
            text_redacted,
            normalized_text,
            content='messages',
            content_rowid='id'
        );

        CREATE INDEX messages_sent_at_idx ON messages(sent_at);
        CREATE INDEX messages_sender_hash_idx ON messages(sender_hash);
        CREATE INDEX messages_reply_to_idx ON messages(reply_to);
        CREATE INDEX service_mentions_key_idx ON service_mentions(service_key);
        CREATE INDEX service_mentions_category_idx ON service_mentions(category);
        CREATE INDEX pain_mentions_key_idx ON pain_mentions(pain_key);

        CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
            INSERT INTO message_search(rowid, text_redacted, normalized_text)
            VALUES (new.id, new.text_redacted, new.normalized_text);
        END;
        CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
            INSERT INTO message_search(message_search, rowid, text_redacted, normalized_text)
            VALUES('delete', old.id, old.text_redacted, old.normalized_text);
        END;
        CREATE TRIGGER messages_au AFTER UPDATE ON messages BEGIN
            INSERT INTO message_search(message_search, rowid, text_redacted, normalized_text)
            VALUES('delete', old.id, old.text_redacted, old.normalized_text);
            INSERT INTO message_search(rowid, text_redacted, normalized_text)
            VALUES (new.id, new.text_redacted, new.normalized_text);
        END;
        """
    )


def build_database(export_dir: Path, db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if db_path.exists():
        db_path.unlink()

    conn = sqlite3.connect(db_path)
    try:
        create_schema(conn)

        metadata_path = export_dir / "chat_metadata.json"
        if metadata_path.exists():
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            for key, value in metadata.items():
                conn.execute(
                    "INSERT INTO import_metadata(key, value) VALUES (?, ?)",
                    (str(key), json.dumps(value, ensure_ascii=False)),
                )

        inserted = 0
        text_messages = 0
        for source_order, message in enumerate(iter_messages(export_dir), start=1):
            raw_text = extract_text(message)
            redacted = redact_text(raw_text)
            normalized = normalize_text(raw_text)
            reactions = message.get("reactions") or []
            reaction_total = sum(
                int(item.get("count", 0)) for item in reactions if isinstance(item, dict)
            )
            media = message.get("media") if isinstance(message.get("media"), dict) else None
            cursor = conn.execute(
                """
                INSERT INTO messages(
                    source_order,
                    message_id,
                    message_type,
                    sent_at,
                    timestamp_text,
                    sender_hash,
                    text_redacted,
                    normalized_text,
                    reply_to,
                    has_forward,
                    has_media,
                    media_filename,
                    reaction_total
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    source_order,
                    str(message.get("id", "")),
                    str(message.get("type", "")),
                    parse_timestamp(message.get("timestamp")),
                    message.get("timestamp"),
                    sender_hash(message.get("sender")),
                    redacted,
                    normalized,
                    message.get("reply_to"),
                    1 if message.get("forward") else 0,
                    1 if media else 0,
                    media.get("filename") if media else None,
                    reaction_total,
                ),
            )
            rowid = int(cursor.lastrowid)
            inserted += 1
            if normalized:
                text_messages += 1

            for reaction in reactions:
                if isinstance(reaction, dict):
                    conn.execute(
                        "INSERT INTO reactions(message_rowid, emoji, count) VALUES (?, ?, ?)",
                        (
                            rowid,
                            str(reaction.get("emoji", "")),
                            int(reaction.get("count", 0)),
                        ),
                    )

            for service_key, (label, category, terms) in SERVICE_PATTERNS.items():
                if normalized and has_any_term(normalized, terms):
                    conn.execute(
                        """
                        INSERT INTO service_mentions(
                            message_rowid, service_key, service_label, category
                        )
                        VALUES (?, ?, ?, ?)
                        """,
                        (rowid, service_key, label, category),
                    )

            for pain_key, (label, terms) in PAIN_PATTERNS.items():
                if normalized and has_any_term(normalized, terms):
                    conn.execute(
                        """
                        INSERT INTO pain_mentions(message_rowid, pain_key, pain_label)
                        VALUES (?, ?, ?)
                        """,
                        (rowid, pain_key, label),
                    )

        conn.execute(
            "INSERT OR REPLACE INTO import_metadata(key, value) VALUES ('db_created_at', ?)",
            (json.dumps(datetime.now().isoformat()),),
        )
        conn.execute(
            "INSERT OR REPLACE INTO import_metadata(key, value) VALUES ('db_message_count', ?)",
            (json.dumps(inserted),),
        )
        conn.execute(
            """
            INSERT OR REPLACE INTO import_metadata(key, value)
            VALUES ('db_text_message_count', ?)
            """,
            (json.dumps(text_messages),),
        )
        conn.commit()
        conn.execute("PRAGMA optimize")
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build a local SQLite research DB from a Telegram export."
    )
    parser.add_argument("--export-dir", type=Path, default=DEFAULT_EXPORT_DIR)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH)
    args = parser.parse_args()

    if not (args.export_dir / "messages.jsonl").exists():
        raise SystemExit(f"messages.jsonl was not found in {args.export_dir}")

    build_database(args.export_dir, args.db)
    print(f"Created {args.db}")


if __name__ == "__main__":
    main()
