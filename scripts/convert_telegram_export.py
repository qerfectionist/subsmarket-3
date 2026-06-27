"""Convert a Telegram Desktop HTML export into analysis-friendly JSON and CSV.

The exporter may split a chat into messages.html, messages2.html, etc.  This
script keeps that order and produces one record per visible chat event.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup


MESSAGE_FILE_RE = re.compile(r"^messages(?P<part>\d*)\.html$", re.IGNORECASE)
MESSAGE_ID_RE = re.compile(r"^message(?P<id>\d+)$")
REPLY_ID_RE = re.compile(r"go_to_message(?P<id>\d+)")
DATE_FORMAT = "%d.%m.%Y %H:%M:%S UTC%z"


def message_files(export_dir: Path) -> list[Path]:
    def sort_key(path: Path) -> int:
        match = MESSAGE_FILE_RE.match(path.name)
        return int(match.group("part") or "1") if match else 10**9

    return sorted(
        (path for path in export_dir.iterdir() if MESSAGE_FILE_RE.match(path.name)),
        key=sort_key,
    )


def normalize_text(node: Any | None) -> str:
    if node is None:
        return ""
    return node.get_text("\n", strip=True).replace("\xa0", " ")


def parse_timestamp(raw: str | None) -> tuple[str | None, str | None]:
    if not raw:
        return None, None
    try:
        parsed = datetime.strptime(raw, DATE_FORMAT)
    except ValueError:
        return raw, None
    return raw, parsed.isoformat()


def parse_message(message: Any, source_file: str) -> dict[str, Any] | None:
    message_id_match = MESSAGE_ID_RE.match(message.get("id", ""))
    if message_id_match is None:
        return None

    classes = set(message.get("class", []))
    body = message.select_one(":scope > .body")
    text_node = body.select_one(":scope > .text") if body else None
    date_node = body.select_one(":scope > .date[title]") if body else None
    raw_timestamp, timestamp = parse_timestamp(date_node.get("title") if date_node else None)
    reply_link = body.select_one(".reply_to a[href]") if body else None
    reply_match = REPLY_ID_RE.search(reply_link.get("href", "")) if reply_link else None

    event_type = "service" if "service" in classes else "message"
    sender = normalize_text(body.select_one(":scope > .from_name")) if body else ""
    text = normalize_text(text_node)
    if event_type == "service":
        text = normalize_text(body)

    # Some Telegram messages consist only of media, links, polls, or stickers.
    # Preserve a short machine-readable label instead of silently dropping them.
    media_types = [node.get("class", [""])[0] for node in message.select(".media_wrap > div")]
    if not text and media_types:
        text = f"[{', '.join(media_types)}]"

    return {
        "message_id": int(message_id_match.group("id")),
        "source_file": source_file,
        "event_type": event_type,
        "sent_at_raw": raw_timestamp,
        "sent_at": timestamp,
        "sender_name": sender or None,
        "text": text or None,
        "reply_to_message_id": int(reply_match.group("id")) if reply_match else None,
        "has_media": bool(media_types),
        "media_types": media_types,
    }


def convert(export_dir: Path, output_dir: Path) -> tuple[int, int]:
    html_files = message_files(export_dir)
    if not html_files:
        raise FileNotFoundError("No messages*.html files found in the export directory.")

    output_dir.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, Any]] = []
    chat_title: str | None = None

    for html_file in html_files:
        soup = BeautifulSoup(html_file.read_text(encoding="utf-8"), "html.parser")
        if chat_title is None:
            title_node = soup.select_one(".page_header .text.bold")
            chat_title = normalize_text(title_node) or None
        for message in soup.select(".history > .message"):
            record = parse_message(message, html_file.name)
            if record is not None:
                records.append(record)

    records.sort(key=lambda record: record["message_id"])
    metadata = {
        "chat_title": chat_title,
        "source_directory": str(export_dir),
        "source_files": [path.name for path in html_files],
        "record_count": len(records),
        "message_count": sum(record["event_type"] == "message" for record in records),
        "service_event_count": sum(record["event_type"] == "service" for record in records),
        "generated_at": datetime.now().astimezone().isoformat(),
    }

    (output_dir / "messages.json").write_text(
        json.dumps({"metadata": metadata, "messages": records}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (output_dir / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    columns = [
        "message_id",
        "source_file",
        "event_type",
        "sent_at_raw",
        "sent_at",
        "sender_name",
        "text",
        "reply_to_message_id",
        "has_media",
        "media_types",
    ]
    with (output_dir / "messages.csv").open("w", encoding="utf-8-sig", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=columns)
        writer.writeheader()
        for record in records:
            csv_record = record | {"media_types": ", ".join(record["media_types"])}
            writer.writerow(csv_record)

    return len(records), len(html_files)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("export_dir", type=Path, help="Telegram Desktop export folder")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Output folder (default: <export_dir>/json_output)",
    )
    args = parser.parse_args()
    output_dir = args.output_dir or args.export_dir / "json_output"
    record_count, file_count = convert(args.export_dir, output_dir)
    print(f"Converted {record_count} records from {file_count} HTML files into {output_dir}")


if __name__ == "__main__":
    main()
