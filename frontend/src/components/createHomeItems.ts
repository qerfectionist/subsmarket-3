import { formatKzt, matchesServiceQuery, servicePopularity } from "./families/createFamilyForm";
import { matchesServiceSearch } from "./marketplace/accountPlans";
import type { CreateCategory } from "./CreateCategoryPicker";
import type {
  AccountListing,
  AccountService,
  FamilyService,
  MarketplaceListing,
  MarketplaceOperator,
  MyFamily
} from "../types";

/** One row on «Создать»: a search result or something the person created before. */
export type CreateHomeItem = {
  key: string;
  kind: CreateCategory;
  title: string;
  subtitle: string;
  logoSlug: string;
  tariffLogo: boolean;
  open: () => void;
};

export type CreateHomeActions = {
  onPickService: (service: FamilyService) => void;
  onPickAccount: (serviceSlug: string) => void;
  onPickOperator: (operatorSlug: string) => void;
  onRepeatFamily: (family: MyFamily["family"]) => void;
  onRepeatAccount: (listing: AccountListing) => void;
  onRepeatGigabytes: (listing: MarketplaceListing) => void;
};

/** «до 1 места», «до 6 мест». */
function upToSeats(count: number) {
  return `до ${count} ${count % 10 === 1 && count % 100 !== 11 ? "места" : "мест"}`;
}

function byPopularity(a: FamilyService, b: FamilyService) {
  return servicePopularity(a.slug) - servicePopularity(b.slug);
}

function familyItem(service: FamilyService, actions: CreateHomeActions): CreateHomeItem {
  const tariff = service.family_type === "tariff";
  return {
    key: `${tariff ? "tariff" : "subscription"}-${service.slug}`,
    kind: tariff ? "tariff" : "subscription",
    title: service.name,
    subtitle: `${tariff ? "Семейный тариф" : "Семейная подписка"} · ${upToSeats(service.max_members)}`,
    logoSlug: service.slug,
    tariffLogo: tariff,
    open: () => actions.onPickService(service)
  };
}

/**
 * Everything that can be created whose name matches: subscriptions, tariffs,
 * accounts, then operators, each in order of popularity.
 */
export function searchCreateItems(
  query: string,
  data: { services: FamilyService[]; accountServices: AccountService[]; operators: MarketplaceOperator[] },
  actions: CreateHomeActions
): CreateHomeItem[] {
  const needle = query.trim().toLocaleLowerCase("ru-RU");
  if (!needle) return [];
  const families = data.services.filter((service) => matchesServiceQuery(service, query)).sort(byPopularity);
  const subscriptions = families.filter((service) => service.family_type !== "tariff");
  const tariffs = families.filter((service) => service.family_type === "tariff");
  const accounts = data.accountServices.filter((service) => matchesServiceSearch(service, query));
  const operators = data.operators.filter((operator) =>
    [operator.name, operator.slug].some((value) => value.toLocaleLowerCase("ru-RU").includes(needle))
  );
  return [
    ...subscriptions.map((service) => familyItem(service, actions)),
    ...tariffs.map((service) => familyItem(service, actions)),
    ...accounts.map((service) => ({
      key: `accounts-${service.slug}`,
      kind: "accounts" as const,
      title: service.name,
      subtitle: (service.plans ?? []).length
        ? `Аккаунт · ${(service.plans ?? []).map((plan) => plan.name).join(", ")}`
        : "Аккаунт",
      logoSlug: service.slug,
      tariffLogo: false,
      open: () => actions.onPickAccount(service.slug)
    })),
    ...operators.map((operator) => ({
      key: `gigabytes-${operator.slug}`,
      kind: "gigabytes" as const,
      title: operator.name,
      subtitle: "Гигабайты",
      logoSlug: `${operator.slug}-family-tariff`,
      tariffLogo: true,
      open: () => actions.onPickOperator(operator.slug)
    }))
  ];
}

const RECENT_LIMIT = 3;

/**
 * What this person created before, newest first, one row per service and kind,
 * with the terms they used: a row opens the form filled the same way.
 */
export function recentCreateItems(
  data: { families: MyFamily[]; accountListings: AccountListing[]; gigabyteListings: MarketplaceListing[] },
  actions: CreateHomeActions
): CreateHomeItem[] {
  const dated: { at: string; item: CreateHomeItem }[] = [];
  for (const { family, membership } of data.families) {
    if (membership.role !== "owner") continue;
    const tariff = family.family_type === "tariff";
    dated.push({
      at: family.created_at,
      item: {
        key: `${tariff ? "tariff" : "subscription"}-${family.service_slug}`,
        kind: tariff ? "tariff" : "subscription",
        title: family.service_name,
        subtitle: `${tariff ? "Тариф" : "Подписка"} · ${formatKzt(family.member_share_kzt)} за место`,
        logoSlug: family.service_slug,
        tariffLogo: tariff,
        open: () => actions.onRepeatFamily(family)
      }
    });
  }
  for (const listing of data.accountListings) {
    if (!listing.is_owner) continue;
    dated.push({
      at: listing.created_at,
      item: {
        key: `accounts-${listing.service.slug}`,
        kind: "accounts",
        title: listing.service.name,
        subtitle: ["Аккаунт", listing.plan_name, formatKzt(listing.price_kzt)].filter(Boolean).join(" · "),
        logoSlug: listing.service.slug,
        tariffLogo: false,
        open: () => actions.onRepeatAccount(listing)
      }
    });
  }
  for (const listing of data.gigabyteListings) {
    if (!listing.is_owner) continue;
    dated.push({
      at: listing.created_at,
      item: {
        key: `gigabytes-${listing.operator.slug}`,
        kind: "gigabytes",
        title: listing.operator.name,
        subtitle: `Гигабайты · ${formatKzt(listing.price_per_gb_kzt)} за ГБ`,
        logoSlug: `${listing.operator.slug}-family-tariff`,
        tariffLogo: true,
        open: () => actions.onRepeatGigabytes(listing)
      }
    });
  }
  dated.sort((a, b) => b.at.localeCompare(a.at));
  const seen = new Set<string>();
  const recent: CreateHomeItem[] = [];
  for (const { item } of dated) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    recent.push(item);
    if (recent.length === RECENT_LIMIT) break;
  }
  return recent;
}
