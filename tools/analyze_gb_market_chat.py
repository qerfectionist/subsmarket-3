"""Analyze a converted Telegram chat about mobile-data trading.

Input is the messages.json produced by scripts/convert_telegram_export.py.
The analyzer intentionally reports aggregate counts and redacted examples only.
Regular-expression classifications are market-research signals, not ground truth.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any


SPACE_RE = re.compile(r"\s+")
PHONE_RE = re.compile(r"(?<!\d)(?:\+?7|8)[\s()\-]*\d(?:[\s()\-]*\d){9}(?!\d)")
USERNAME_RE = re.compile(r"(?<!\w)@[A-Za-z0-9_]{4,}")
URL_RE = re.compile(r"https?://\S+|t\.me/\S+", re.IGNORECASE)

GB_TOKEN = r"(?:\u0433\u0431|gb|\u0433\u0438\u0433(?:\u0430\u0431\u0430\u0439\u0442\w*|\u0430|\u0438|\u043e\u0432)?)"
GB_AMOUNT_RE = re.compile(rf"(?<!\d)(\d+(?:[.,]\d+)?)\s*{GB_TOKEN}\b", re.IGNORECASE)
CURRENCY_TOKEN = r"(?:\u20b8|\u0442\u0433|\u0442\u0435\u043d\u0433\u0435|\u0442\u043d\u0433|\u043a\u0437\u0442|kzt)"
PRICE_RE = re.compile(rf"(?<!\d)(\d{{2,6}})\s*{CURRENCY_TOKEN}", re.IGNORECASE)

OFFER_RE = re.compile(
    r"(?:\u043f\u0440\u043e\u0434\u0430\u043c|\u043f\u0440\u043e\u0434\u0430\u044e|\u043f\u0440\u043e\u0434\u0430\u0436\u0430|"
    r"\u0435\u0441\u0442\u044c|\u043b\u0438\u0448\u043d\w*|\u043e\u0442\u0434\u0430\u043c|\u0441\u0430\u0442\u0430\w*)",
    re.IGNORECASE,
)
DEMAND_RE = re.compile(
    r"(?:\u043a\u0443\u043f\u043b\u044e|\u043a\u0443\u043f\u0438\u0442\u044c|\u043a\u0443\u043f\u0438\u043b\w*|"
    r"\u043d\u0443\u0436\u043d\w*|\u0438\u0449\u0443|\u0430\u043b\u0430\u043c|\u0430\u043b\u0430\u0442\w*)",
    re.IGNORECASE,
)
UNIT_PRICE_RE = re.compile(
    rf"(?:"
    rf"(?<!\d)1\s*{GB_TOKEN}\s*(?:[-\u2014:=]|\u043f\u043e|\u0437\u0430)?\s*\d{{2,5}}|"
    rf"\d{{2,5}}\s*{CURRENCY_TOKEN}?\s*(?:/|\u0437\u0430|\u043f\u043e)\s*(?:1\s*)?{GB_TOKEN}|"
    rf"(?:\u0437\u0430|\u043f\u043e)\s*(?:1\s*)?{GB_TOKEN}\s*[-\u2014:=]?\s*\d{{2,5}}|"
    rf"{GB_TOKEN}\s*(?:\u043f\u043e|\u0437\u0430|[-\u2014:=])\s*\d{{2,5}}"
    rf")",
    re.IGNORECASE,
)
COMMISSION_RE = re.compile(r"\u043a\u043e\u043c\u0438\u0441\w*", re.IGNORECASE)
DURATION_RE = re.compile(
    r"(?:\u0441\u0440\u043e\u043a|\u0441\u0433\u043e\u0440\w*|\u0434\u043d(?:\u044f|\u0435\u0439)|\u0441\u0443\u0442(?:\u043a\u0438|\u043e\u043a)|\u0447\u0430\u0441\w*)",
    re.IGNORECASE,
)
PAYMENT_FIRST_RE = re.compile(
    r"(?:\u0441\u043d\u0430\u0447\u0430\s+\u043e\u043f\u043b\u0430\u0442|\u043f\u0440\u0435\u0434\u043e\u043f\u043b\u0430\u0442|\u0434\u0435\u043d\u044c\u0433\w*\s+\u0441\u043d\u0430\u0447\u0430)",
    re.IGNORECASE,
)
TRANSFER_FIRST_RE = re.compile(
    r"(?:\u0441\u043d\u0430\u0447\u0430\s+(?:\u0433\u0431|\u0433\u0438\u0433|\u043f\u0435\u0440\u0435\u0432\u043e\u0434)|\u043f\u043e\u0441\u043b\u0435\s+(?:\u043f\u043e\u043b\u0443\u0447\u0435\u043d|\u043f\u0435\u0440\u0435\u0432\u043e\u0434)\w*\s+\u043e\u043f\u043b\u0430\u0442)",
    re.IGNORECASE,
)

OPERATOR_PATTERNS = {
    "tele2": re.compile(r"\b(?:tele2|\u0442\u0435\u043b\u0435\s*2|\u0442\u0435\u043b\u0435\u0434\u0432\u0430)\b", re.IGNORECASE),
    "altel": re.compile(r"\b(?:altel|\u0430\u043b\u0442\u0435\u043b)\b", re.IGNORECASE),
    "activ": re.compile(r"\b(?:activ|active|\u0430\u043a\u0442\u0438\u0432)\b", re.IGNORECASE),
    "beeline": re.compile(r"\b(?:beeline|\u0431\u0438\u043b\u0430\u0439\u043d|\u0431\u0438\u043b\u0430\u0439\u043d\u0430|\u0431\u0438\u043b\u0430\u0439\u043d\u0435)\b", re.IGNORECASE),
    "kcell": re.compile(r"\b(?:kcell|kcel|\u043a\u0441\u0435\u043b\u043b|\u043a\u0441\u0435\u043b)\b", re.IGNORECASE),
    "izi": re.compile(r"\b(?:izi|\u0438\u0437\u0438)\b", re.IGNORECASE),
}


def compact(text: str) -> str:
    return SPACE_RE.sub(" ", text).strip()


def redact(text: str) -> str:
    value = PHONE_RE.sub("[phone]", text)
    value = USERNAME_RE.sub("[username]", value)
    value = URL_RE.sub("[link]", value)
    return compact(value)


def sender_hash(sender: str | None) -> str | None:
    if not sender:
        return None
    return hashlib.sha256(sender.encode("utf-8")).hexdigest()[:12]


def classify(message: dict[str, Any]) -> dict[str, Any]:
    text = compact(str(message.get("text") or ""))
    lowered = text.casefold()
    quantity_text = lowered
    for operator in ("tele2", "\u0442\u0435\u043b\u04352", "\u0442\u0435\u043b\u0435 2", "\u0442\u0435\u043b\u0435\u0434\u0432\u0430"):
        quantity_text = quantity_text.replace(operator, " operator ")
    quantities = [
        float(value.replace(",", ".")) for value in GB_AMOUNT_RE.findall(quantity_text)
    ]
    prices = [int(value) for value in PRICE_RE.findall(lowered)]
    strong_offer = bool(
        re.search(
            r"(?:\u043f\u0440\u043e\u0434\u0430\u043c|\u043f\u0440\u043e\u0434\u0430\u044e|\u043f\u0440\u043e\u0434\u0430\u0436\u0430|"
            r"\u043b\u0438\u0448\u043d\w*|\u043e\u0442\u0434\u0430\u043c|\u0441\u0430\u0442\u0430\w*)",
            lowered,
            re.IGNORECASE,
        )
    )
    availability_offer = bool(re.search(r"\u0435\u0441\u0442\u044c", lowered, re.IGNORECASE)) and "?" not in lowered
    is_offer = strong_offer or availability_offer
    is_demand = bool(DEMAND_RE.search(lowered))
    has_unit_price = bool(UNIT_PRICE_RE.search(lowered))

    if is_offer and is_demand:
        intent = "mixed"
    elif is_offer:
        intent = "offer"
    elif is_demand:
        intent = "demand"
    else:
        intent = "other"

    is_multi_tier = is_offer and len(quantities) >= 2 and len(prices) >= 2
    if not is_offer:
        offer_format = None
    elif is_multi_tier:
        offer_format = "multiple_tiers"
    elif has_unit_price:
        offer_format = "unit_price"
    elif quantities and prices:
        offer_format = "fixed_lot"
    elif quantities:
        offer_format = "quantity_no_price"
    elif prices:
        offer_format = "price_no_quantity"
    else:
        offer_format = "negotiated_or_unspecified"

    return {
        "message_id": message.get("message_id"),
        "sent_at": message.get("sent_at"),
        "sender_hash": sender_hash(message.get("sender_name")),
        "text_redacted": redact(text),
        "intent": intent,
        "offer_format": offer_format,
        "quantities_gb": quantities,
        "prices_kzt": prices,
        "is_multi_tier": is_multi_tier,
        "operators": [key for key, pattern in OPERATOR_PATTERNS.items() if pattern.search(lowered)],
        "mentions_commission": bool(COMMISSION_RE.search(lowered)),
        "mentions_duration": bool(DURATION_RE.search(lowered)),
        "payment_first": bool(PAYMENT_FIRST_RE.search(lowered)),
        "transfer_first": bool(TRANSFER_FIRST_RE.search(lowered)),
    }


def examples(rows: list[dict[str, Any]], predicate: Any, limit: int = 15) -> list[dict[str, Any]]:
    selected = []
    for row in rows:
        if predicate(row):
            selected.append(
                {
                    "message_id": row["message_id"],
                    "sent_at": row["sent_at"],
                    "text": row["text_redacted"][:360],
                    "quantities_gb": row["quantities_gb"],
                    "prices_kzt": row["prices_kzt"],
                    "operators": row["operators"],
                }
            )
        if len(selected) >= limit:
            break
    return selected


def analyze(input_path: Path) -> dict[str, Any]:
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    source_messages = [
        item
        for item in payload["messages"]
        if item.get("event_type") == "message" and item.get("text")
    ]
    rows = [classify(message) for message in source_messages]
    offers = [row for row in rows if row["intent"] in {"offer", "mixed"}]
    demands = [row for row in rows if row["intent"] in {"demand", "mixed"}]
    unique_offers_by_text = {
        re.sub(r"\W+", " ", row["text_redacted"].casefold()).strip(): row
        for row in offers
    }
    unique_offers_by_seller_and_text = {
        (
            row["sender_hash"],
            re.sub(r"\W+", " ", row["text_redacted"].casefold()).strip(),
        ): row
        for row in offers
    }
    unique_offer_rows = list(unique_offers_by_seller_and_text.values())

    operator_messages = Counter(operator for row in rows for operator in row["operators"])
    operator_offers = Counter(operator for row in offers for operator in row["operators"])
    offer_formats = Counter(row["offer_format"] for row in offers)
    unique_offer_formats = Counter(row["offer_format"] for row in unique_offer_rows)

    quantities = Counter(
        quantity
        for row in offers
        for quantity in row["quantities_gb"]
        if 0 < quantity <= 1000
    )

    return {
        "methodology": {
            "note": "Regex classifications are approximate and require manual sample review.",
            "input": str(input_path),
        },
        "source": payload.get("metadata", {}),
        "counts": {
            "text_messages": len(rows),
            "unique_identified_senders": len(
                {row["sender_hash"] for row in rows if row["sender_hash"]}
            ),
            "offer_messages": len(offers),
            "offer_senders": len({row["sender_hash"] for row in offers if row["sender_hash"]}),
            "unique_offer_texts": len(unique_offers_by_text),
            "unique_seller_offer_texts": len(unique_offer_rows),
            "demand_messages": len(demands),
            "commission_mentions": sum(row["mentions_commission"] for row in rows),
            "duration_mentions": sum(row["mentions_duration"] for row in rows),
            "payment_first_mentions": sum(row["payment_first"] for row in rows),
            "transfer_first_mentions": sum(row["transfer_first"] for row in rows),
        },
        "offer_formats": dict(offer_formats.most_common()),
        "unique_offer_formats": dict(unique_offer_formats.most_common()),
        "operator_messages": dict(operator_messages.most_common()),
        "operator_offers": dict(operator_offers.most_common()),
        "top_offer_quantities_gb": [
            {"quantity": quantity, "messages": count}
            for quantity, count in quantities.most_common(20)
        ],
        "examples": {
            "unit_price": examples(rows, lambda row: row["offer_format"] == "unit_price"),
            "fixed_lot": examples(rows, lambda row: row["offer_format"] == "fixed_lot"),
            "quantity_no_price": examples(
                rows, lambda row: row["offer_format"] == "quantity_no_price"
            ),
            "unspecified_offer": examples(
                rows, lambda row: row["offer_format"] == "negotiated_or_unspecified"
            ),
            "demand": examples(rows, lambda row: row["intent"] in {"demand", "mixed"}),
            "commission": examples(rows, lambda row: row["mentions_commission"]),
            "duration": examples(rows, lambda row: row["mentions_duration"]),
        },
        "rows": rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    result = analyze(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    summary = {key: value for key, value in result.items() if key != "rows"}
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
