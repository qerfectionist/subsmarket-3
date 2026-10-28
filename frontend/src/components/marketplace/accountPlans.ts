import type {
  AccountDelivery,
  AccountListingCreate,
  AccountPlan,
  AccountService
} from "../../types";

/** Mirrors backend account_catalog.py so the preview matches the published title. */
export const DELIVERY_OPTIONS: { value: AccountDelivery; label: string; helper: string }[] = [
  {
    value: "own_account",
    label: "На свой аккаунт",
    helper: "Вы оформляете подписку на аккаунт покупателя."
  },
  {
    value: "ready_account",
    label: "Готовый аккаунт",
    helper: "Покупатель получает аккаунт, на котором уже есть подписка."
  }
];

const DELIVERY_TITLES: Record<AccountDelivery, string> = {
  own_account: "на аккаунт покупателя",
  ready_account: "готовый аккаунт"
};

export function periodTitle(months: number) {
  if (months === 12) return "1 год";
  const mod10 = months % 10;
  const mod100 = months % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? "месяц"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "месяца"
        : "месяцев";
  return `${months} ${word}`;
}

export function planPeriodsLabel(plan: AccountPlan) {
  return plan.periods.map(periodTitle).join(" или ");
}

export function deliveryTitle(delivery: AccountDelivery) {
  return DELIVERY_TITLES[delivery];
}

export function findPlan(service: AccountService | undefined, code: string | null | undefined) {
  return service?.plans?.find((plan) => plan.code === code);
}

/** «ChatGPT Plus · 1 месяц, на аккаунт покупателя». */
export function accountListingTitle(
  service: AccountService,
  plan: AccountPlan,
  months: number,
  delivery: AccountDelivery
) {
  const title = `${plan.full_name} · ${periodTitle(months)}`;
  return (service.deliveries ?? []).length > 1 ? `${title}, ${DELIVERY_TITLES[delivery]}` : title;
}

/** First plan, its first period and a delivery the service allows. */
export function selectionForService(
  form: AccountListingCreate,
  service: AccountService
): AccountListingCreate {
  const plan = service.plans?.[0];
  const deliveries = service.deliveries ?? [];
  return {
    ...form,
    service_slug: service.slug,
    plan_code: plan?.code ?? "",
    period_months: plan?.periods[0] ?? 1,
    delivery: deliveries.includes(form.delivery) ? form.delivery : (deliveries[0] ?? "own_account")
  };
}

export function selectionForPlan(form: AccountListingCreate, plan: AccountPlan): AccountListingCreate {
  return {
    ...form,
    plan_code: plan.code,
    period_months: plan.periods.includes(form.period_months) ? form.period_months : plan.periods[0]
  };
}

function normalize(value: string) {
  return value.toLowerCase().replace(/ё/g, "е").trim();
}

/** Search by name, slug or Russian keywords: «чат» finds ChatGPT. */
export function matchesServiceSearch(service: AccountService, term: string) {
  const query = normalize(term);
  if (!query) return true;
  const haystack = [service.name, service.slug, ...(service.keywords ?? [])].map(normalize);
  return haystack.some((value) => value.includes(query) || (value.length > 1 && query.startsWith(value)));
}
