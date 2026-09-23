import { getListingPresence } from "../ListingAuthor";
import { resolveServiceBrand } from "../branding";
import type { FamilyType, MyFamily } from "../../types";
import {
  MARKET_VIEW_STATE_KEY,
  marketFilterOptions,
  type CatalogFilter,
  type MarketFilter,
  type MarketViewState,
  type Offer,
  type SubscriptionCategoryFilter,
  type TariffOperatorFilter
} from "./types";

export function readMarketViewState(): MarketViewState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(MARKET_VIEW_STATE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<MarketViewState>;
    if (typeof value.searchTerm !== "string") return null;
    const marketFilter = marketFilterOptions.some(option => option.value === value.marketFilter)
      ? (value.marketFilter as MarketFilter)
      : "all";
    const scrollTop = typeof value.scrollTop === "number" && Number.isFinite(value.scrollTop)
      ? Math.max(0, value.scrollTop)
      : 0;
    return { searchTerm: value.searchTerm, marketFilter, scrollTop };
  } catch {
    return null;
  }
}

export function writeMarketViewState(state: MarketViewState) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(MARKET_VIEW_STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}

export function clearMarketViewState() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(MARKET_VIEW_STATE_KEY);
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}

export function offerPrice(offer: Offer): number {
  if (offer.kind === "family") return offer.item.member_share_kzt;
  if (offer.kind === "gigabytes") return offer.item.price_per_gb_kzt;
  return offer.item.price_kzt;
}

export function offerResponsePriority(offer: Offer): number {
  return getListingPresence(offer.item.owner.avatar_name) === "online" ? 1 : 0;
}

export function offerCreatedAt(offer: Offer): number {
  const item = offer.item as { created_at?: string; published_at?: string };
  const dateStr = item.published_at || item.created_at;
  return dateStr ? new Date(dateStr).getTime() : 0;
}

export function offerServiceCategory(offer: Offer): Exclude<SubscriptionCategoryFilter, "all"> {
  const input = offer.kind === "family"
    ? {
        serviceSlug: offer.item.service_slug,
        serviceName: offer.item.service_name,
        familyType: offer.item.family_type
      }
    : offer.kind === "gigabytes"
      ? { serviceSlug: offer.item.operator.slug, serviceName: offer.item.operator.name }
      : { serviceSlug: offer.item.service.slug, serviceName: offer.item.service.name };
  const slug = input.serviceSlug?.toLocaleLowerCase("en-US") ?? "";
  const name = input.serviceName?.toLocaleLowerCase("ru-RU") ?? "";

  if (
    slug === "chatgpt" ||
    name.includes("chatgpt") ||
    slug === "gemini" ||
    name.includes("gemini") ||
    slug === "grok" ||
    name.includes("grok") ||
    slug === "claude" ||
    name.includes("claude") ||
    slug.includes("ai") ||
    name.includes("ai")
  ) {
    return "ai";
  }

  switch (resolveServiceBrand(input).category) {
    case "video_streaming":
      return "video";
    case "music_audio":
      return "music";
    default:
      return "other";
  }
}

export function offerTariffOperator(offer: Offer): Exclude<TariffOperatorFilter, "all"> {
  if (offer.kind !== "family") return "other";
  const slug = offer.item.service_slug?.toLocaleLowerCase("en-US") ?? "";
  const name = offer.item.service_name?.toLocaleLowerCase("ru-RU") ?? "";
  if (slug.includes("tele2") || name.includes("tele2") || name.includes("теле2")) return "tele2";
  if (slug.includes("activ") || name.includes("activ") || name.includes("актив")) return "activ";
  if (slug.includes("beeline") || name.includes("beeline") || name.includes("билайн")) return "beeline";
  if (slug.includes("altel") || name.includes("altel") || name.includes("алтел")) return "altel";
  return "other";
}

export function matchesCatalogFilter(offer: Offer, filter: CatalogFilter, familyType: FamilyType): boolean {
  if (filter === "all") return true;
  return familyType === "tariff"
    ? offerTariffOperator(offer) === filter
    : offerServiceCategory(offer) === filter;
}

export function familyLabel(family: MyFamily["family"]): string {
  return [family.service_name, family.service_variant ?? family.plan_name].filter(Boolean).join(" · ");
}

export function formatKzt(value: number): string {
  return `${value.toLocaleString("ru-KZ")} ₸`;
}

export function pluralRu(value: number, one: string, few: string, many: string): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
