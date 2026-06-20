from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path


DEFAULT_DB_PATH = Path("data/research/market_chat.sqlite")


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")


def connect(db_path: Path) -> sqlite3.Connection:
    if not db_path.exists():
        raise SystemExit(
            f"Database not found: {db_path}. Run tools/build_market_research_db.py first."
        )
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def print_rows(rows: list[sqlite3.Row]) -> None:
    for row in rows:
        print(" | ".join(f"{key}={row[key]}" for key in row.keys()))


def build_fts_query(query: str) -> str:
    cleaned = query.strip().replace('"', " ")
    if not cleaned:
        return query
    if " " in cleaned:
        return f'"{cleaned}"'
    return cleaned


def stats(conn: sqlite3.Connection) -> None:
    queries = {
        "messages": "SELECT COUNT(*) AS count FROM messages",
        "text_messages": "SELECT COUNT(*) AS count FROM messages WHERE normalized_text <> ''",
        "unique_senders": (
            "SELECT COUNT(DISTINCT sender_hash) AS count "
            "FROM messages WHERE sender_hash IS NOT NULL"
        ),
        "replies": "SELECT COUNT(*) AS count FROM messages WHERE reply_to IS NOT NULL",
        "forwarded": "SELECT COUNT(*) AS count FROM messages WHERE has_forward = 1",
        "media": "SELECT COUNT(*) AS count FROM messages WHERE has_media = 1",
    }
    for label, query in queries.items():
        value = conn.execute(query).fetchone()["count"]
        print(f"{label}: {value}")


def top_services(conn: sqlite3.Connection, category: str | None, limit: int) -> None:
    where = "WHERE category = ?" if category else ""
    params: tuple[object, ...] = (category,) if category else ()
    rows = conn.execute(
        f"""
        SELECT
            service_label,
            category,
            COUNT(*) AS messages,
            COUNT(DISTINCT messages.sender_hash) AS unique_senders
        FROM service_mentions
        JOIN messages ON messages.id = service_mentions.message_rowid
        {where}
        GROUP BY service_key, service_label, category
        ORDER BY messages DESC, unique_senders DESC
        LIMIT ?
        """,
        (*params, limit),
    ).fetchall()
    print_rows(rows)


def top_pains(conn: sqlite3.Connection, limit: int) -> None:
    rows = conn.execute(
        """
        SELECT
            pain_label,
            COUNT(*) AS messages,
            COUNT(DISTINCT messages.sender_hash) AS unique_senders
        FROM pain_mentions
        JOIN messages ON messages.id = pain_mentions.message_rowid
        GROUP BY pain_key, pain_label
        ORDER BY messages DESC, unique_senders DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    print_rows(rows)


def search(conn: sqlite3.Connection, query: str, limit: int) -> None:
    rows = conn.execute(
        """
        SELECT
            messages.message_id,
            messages.sent_at,
            messages.text_redacted
        FROM message_search
        JOIN messages ON messages.id = message_search.rowid
        WHERE message_search MATCH ?
        ORDER BY rank
        LIMIT ?
        """,
        (build_fts_query(query), limit),
    ).fetchall()
    print_rows(rows)


def service_examples(conn: sqlite3.Connection, service_key: str, limit: int) -> None:
    rows = conn.execute(
        """
        SELECT
            messages.message_id,
            messages.sent_at,
            messages.text_redacted
        FROM service_mentions
        JOIN messages ON messages.id = service_mentions.message_rowid
        WHERE service_mentions.service_key = ?
        ORDER BY messages.sent_at DESC
        LIMIT ?
        """,
        (service_key, limit),
    ).fetchall()
    print_rows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Query the local Telegram market research DB."
    )
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH)
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("stats")

    services_parser = subparsers.add_parser("services")
    services_parser.add_argument(
        "--category", choices=["subscription", "mobile_tariff", "marketplace_later"]
    )
    services_parser.add_argument("--limit", type=int, default=20)

    pains_parser = subparsers.add_parser("pains")
    pains_parser.add_argument("--limit", type=int, default=20)

    search_parser = subparsers.add_parser("search")
    search_parser.add_argument("query")
    search_parser.add_argument("--limit", type=int, default=20)

    examples_parser = subparsers.add_parser("examples")
    examples_parser.add_argument("service_key")
    examples_parser.add_argument("--limit", type=int, default=20)

    args = parser.parse_args()
    with connect(args.db) as conn:
        if args.command == "stats":
            stats(conn)
        elif args.command == "services":
            top_services(conn, args.category, args.limit)
        elif args.command == "pains":
            top_pains(conn, args.limit)
        elif args.command == "search":
            search(conn, args.query, args.limit)
        elif args.command == "examples":
            service_examples(conn, args.service_key, args.limit)


if __name__ == "__main__":
    main()
