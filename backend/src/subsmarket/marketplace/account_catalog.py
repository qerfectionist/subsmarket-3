"""Official plans that can be sold in «Аккаунты».

Only plans the service itself sells, for the periods it sells them. Checked
28.10.2026 (docs/product-invariants.md, section 9). Services and names are
mirrored in migration 20261028_0038 for production databases.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

AccountDelivery = Literal["own_account", "ready_account"]

DELIVERIES: tuple[AccountDelivery, ...] = ("own_account", "ready_account")
PERIOD_MONTHS: tuple[int, ...] = (1, 3, 6, 12)

DELIVERY_TITLES: dict[str, str] = {
    "own_account": "на аккаунт покупателя",
    "ready_account": "готовый аккаунт",
}


@dataclass(frozen=True)
class AccountPlan:
    code: str
    name: str
    periods: tuple[int, ...]
    full_name: str | None = None


@dataclass(frozen=True)
class AccountCatalogService:
    slug: str
    name: str
    plans: tuple[AccountPlan, ...]
    deliveries: tuple[AccountDelivery, ...] = DELIVERIES
    keywords: tuple[str, ...] = field(default_factory=tuple)


MONTH = (1,)
MONTH_OR_YEAR = (1, 12)

ACCOUNT_CATALOG: tuple[AccountCatalogService, ...] = (
    AccountCatalogService(
        "chatgpt",
        "ChatGPT",
        (
            AccountPlan("go", "Go", MONTH),
            AccountPlan("plus", "Plus", MONTH),
            AccountPlan("pro-100", "Pro 100", MONTH),
            AccountPlan("pro-200", "Pro 200", MONTH),
            AccountPlan("pro-500", "Pro 500", MONTH),
        ),
        keywords=("чат", "чатгпт", "gpt", "openai", "ии", "ai"),
    ),
    AccountCatalogService(
        "claude",
        "Claude",
        (
            AccountPlan("pro", "Pro", MONTH_OR_YEAR),
            AccountPlan("max-5x", "Max 5x", MONTH),
            AccountPlan("max-20x", "Max 20x", MONTH),
        ),
        keywords=("клод", "anthropic", "ии", "ai"),
    ),
    AccountCatalogService(
        "gemini",
        "Gemini",
        (
            AccountPlan("ai-plus", "AI Plus", MONTH, "Google AI Plus"),
            AccountPlan("ai-pro", "AI Pro", MONTH, "Google AI Pro"),
            AccountPlan("ai-ultra", "AI Ultra", MONTH, "Google AI Ultra"),
        ),
        keywords=("джемини", "гемини", "google", "гугл", "ии", "ai"),
    ),
    AccountCatalogService(
        "grok",
        "Grok",
        (
            AccountPlan("supergrok-lite", "SuperGrok Lite", MONTH, "SuperGrok Lite"),
            AccountPlan("supergrok", "SuperGrok", MONTH_OR_YEAR, "SuperGrok"),
            AccountPlan("supergrok-heavy", "SuperGrok Heavy", MONTH, "SuperGrok Heavy"),
            AccountPlan("x-premium", "X Premium", MONTH, "X Premium"),
            AccountPlan("x-premium-plus", "X Premium+", MONTH, "X Premium+"),
        ),
        keywords=("грок", "x", "twitter", "твиттер", "ии", "ai"),
    ),
    AccountCatalogService(
        "perplexity",
        "Perplexity",
        (
            AccountPlan("pro", "Pro", MONTH_OR_YEAR),
            AccountPlan("max", "Max", MONTH),
        ),
        keywords=("перплексити", "поиск", "ии", "ai"),
    ),
    AccountCatalogService(
        "canva",
        "Canva",
        (
            AccountPlan("pro", "Pro", MONTH_OR_YEAR),
            AccountPlan("business", "Business", MONTH_OR_YEAR),
        ),
        keywords=("канва", "дизайн"),
    ),
    AccountCatalogService(
        "capcut",
        "CapCut",
        (AccountPlan("pro", "Pro", MONTH_OR_YEAR),),
        keywords=("капкут", "монтаж", "видео"),
    ),
    AccountCatalogService(
        "telegram-premium",
        "Telegram Premium",
        (
            AccountPlan("subscription", "Подписка", MONTH_OR_YEAR, "Telegram Premium"),
            AccountPlan("gift", "Подарок", (3, 6, 12), "Telegram Premium в подарок"),
        ),
        deliveries=("own_account",),
        keywords=("телеграм", "телеграмм", "тг", "премиум"),
    ),
    AccountCatalogService(
        "spotify",
        "Spotify",
        (
            AccountPlan(
                "premium-individual", "Premium Individual", MONTH, "Spotify Premium"
            ),
        ),
        keywords=("спотифай", "музыка"),
    ),
    AccountCatalogService(
        "youtube-premium",
        "YouTube Premium",
        (AccountPlan("individual", "Личный", MONTH_OR_YEAR, "YouTube Premium"),),
        keywords=("ютуб", "ютюб", "видео", "музыка"),
    ),
    AccountCatalogService(
        "discord-nitro",
        "Discord Nitro",
        (
            AccountPlan("nitro", "Nitro", MONTH_OR_YEAR, "Discord Nitro"),
            AccountPlan(
                "nitro-basic", "Nitro Basic", MONTH_OR_YEAR, "Discord Nitro Basic"
            ),
        ),
        keywords=("дискорд", "нитро"),
    ),
)

_BY_SLUG = {service.slug: service for service in ACCOUNT_CATALOG}


def catalog_service(slug: str) -> AccountCatalogService | None:
    return _BY_SLUG.get(slug)


def find_plan(slug: str, plan_code: str) -> AccountPlan | None:
    service = catalog_service(slug)
    if service is None:
        return None
    return next((plan for plan in service.plans if plan.code == plan_code), None)


def plan_full_name(service_name: str, plan: AccountPlan) -> str:
    return plan.full_name or f"{service_name} {plan.name}"


def period_title(months: int) -> str:
    if months == 12:
        return "1 год"
    mod10, mod100 = months % 10, months % 100
    if mod10 == 1 and mod100 != 11:
        word = "месяц"
    elif 2 <= mod10 <= 4 and not 12 <= mod100 <= 14:
        word = "месяца"
    else:
        word = "месяцев"
    return f"{months} {word}"


def listing_title(
    service: AccountCatalogService, plan: AccountPlan, months: int, delivery: str
) -> str:
    """«ChatGPT Plus · 1 месяц, на аккаунт покупателя»."""
    title = f"{plan_full_name(service.name, plan)} · {period_title(months)}"
    if len(service.deliveries) > 1:
        title = f"{title}, {DELIVERY_TITLES[delivery]}"
    return title


__all__ = [
    "ACCOUNT_CATALOG",
    "DELIVERIES",
    "DELIVERY_TITLES",
    "PERIOD_MONTHS",
    "AccountCatalogService",
    "AccountDelivery",
    "AccountPlan",
    "catalog_service",
    "find_plan",
    "listing_title",
    "period_title",
    "plan_full_name",
]
