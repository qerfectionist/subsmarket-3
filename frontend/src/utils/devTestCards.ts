import type {
  AccountRequest,
  Family,
  FamilyRequest,
  MarketplaceListingRequest,
  OwnerFamilyRequest,
  FamilyType
} from "../types";

export const RANDOM_USERNAMES = [
  "alex_kz",
  "nurbol_88",
  "dina_smart",
  "azamat_almaty",
  "sofia_m",
  "timur_dev",
  "aigerim_k",
  "daniyar_pro",
  "yerassyl_7",
  "kamila_lux"
];

export const RANDOM_FAMILIES = [
  { service_name: "Spotify Premium", service_slug: "spotify", family_type: "subscription" as FamilyType, member_share_kzt: 550, plan_name: "Spotify Family" },
  { service_name: "YouTube Premium", service_slug: "youtube", family_type: "subscription" as FamilyType, member_share_kzt: 750, plan_name: "YouTube Premium Family" },
  { service_name: "Apple One", service_slug: "apple-one", family_type: "subscription" as FamilyType, member_share_kzt: 650, plan_name: "Apple One Family" },
  { service_name: "Netflix Premium", service_slug: "netflix", family_type: "subscription" as FamilyType, member_share_kzt: 1200, plan_name: "Netflix 4K Ultra" },
  { service_name: "ChatGPT Plus", service_slug: "chatgpt", family_type: "subscription" as FamilyType, member_share_kzt: 1500, plan_name: "ChatGPT Team" },
  { service_name: "Яндекс Плюс", service_slug: "yandex-plus", family_type: "subscription" as FamilyType, member_share_kzt: 490, plan_name: "Плюс Мульти" },
  { service_name: "Beeline Семья", service_slug: "beeline-family-tariff", family_type: "tariff" as FamilyType, member_share_kzt: 1800, plan_name: "Супер Семья 4" },
  { service_name: "Tele2 Выгодно", service_slug: "tele2-family-tariff", family_type: "tariff" as FamilyType, member_share_kzt: 1600, plan_name: "Вместе Ярче" }
];

export const RANDOM_ACCOUNTS = [
  { service_name: "Canva Pro", service_slug: "canva", title: "Подписка Canva Pro на 12 мес.", price_kzt: 1990 },
  { service_name: "Telegram Premium", service_slug: "telegram", title: "Telegram Premium 1 год", price_kzt: 3490 },
  { service_name: "PlayStation Plus", service_slug: "playstation", title: "PS Plus Deluxe (12 мес.)", price_kzt: 4800 },
  { service_name: "Steam", service_slug: "steam", title: "Аккаунт с CS2 Prime", price_kzt: 2800 },
  { service_name: "Duolingo Super", service_slug: "duolingo", title: "Duolingo Super на 1 год", price_kzt: 1200 },
  { service_name: "Discord Nitro", service_slug: "discord", title: "Discord Nitro Full 1 мес.", price_kzt: 990 }
];

export const RANDOM_GB = [
  { operator_name: "Tele2", operator_slug: "tele2", amount_gb: 15, price_per_gb_kzt: 70, total_price_kzt: 1050 },
  { operator_name: "Altel", operator_slug: "altel", amount_gb: 25, price_per_gb_kzt: 65, total_price_kzt: 1625 },
  { operator_name: "Beeline", operator_slug: "beeline", amount_gb: 10, price_per_gb_kzt: 80, total_price_kzt: 800 },
  { operator_name: "Kcell", operator_slug: "kcell", amount_gb: 30, price_per_gb_kzt: 60, total_price_kzt: 1800 }
];

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function generateUid(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function createRandomDevCandidate(): { family: Family; request: OwnerFamilyRequest } {
  const uid = generateUid();
  const srv = pickRandom(RANDOM_FAMILIES);
  const username = pickRandom(RANDOM_USERNAMES);

  const family: Family = {
    id: `test-fam-${uid}`,
    service_id: `test-srv-${uid}`,
    service_name: srv.service_name,
    service_slug: srv.service_slug,
    family_type: srv.family_type,
    plan_name: srv.plan_name,
    period: "monthly",
    total_price_kzt: srv.member_share_kzt * 4,
    member_share_kzt: srv.member_share_kzt,
    max_members: 4,
    active_members_count: 2,
    free_slots: 2,
    status: "active",
    rounding_delta_kzt: 0,
    payment_day: 15,
    next_payment_date: new Date().toISOString().slice(0, 10),
    description: "Тестовая семейная подписка",
    owner_rules: "Правила подписки",
    owner: {
      avatar_name: "Demo Owner",
      first_name: "Demo",
      photo_url: null
    },
    is_search_visible: true,
    service_variant: null,
    created_at: new Date().toISOString()
  };

  const request: OwnerFamilyRequest = {
    id: `test-req-${uid}`,
    family_id: family.id,
    family_type: family.family_type,
    service_name: family.service_name,
    service_variant: null,
    plan_name: family.plan_name,
    owner_username: "demo_owner",
    user_id: `test-user-${uid}`,
    status: "pending",
    cancel_reason: null,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    decided_at: null,
    cancelled_at: null,
    expired_at: null,
    candidate: {
      id: `test-cand-${uid}`,
      username,
      first_name: username.split("_")[0],
      photo_url: null
    }
  };

  return { family, request };
}

export function createRandomDevAccountRequest(role: "seller" | "buyer" = "seller"): AccountRequest {
  const uid = generateUid();
  const acc = pickRandom(RANDOM_ACCOUNTS);
  const username = pickRandom(RANDOM_USERNAMES);

  return {
    id: `test-acc-${uid}`,
    listing_id: `test-acc-listing-${uid}`,
    role,
    status: "pending",
    service_name: acc.service_name,
    service_slug: acc.service_slug,
    title: acc.title,
    price_kzt: acc.price_kzt,
    counterparty_username: username,
    created_at: new Date().toISOString(),
    can_remind: false
  };
}

export function createRandomDevGbRequest(role: "seller" | "buyer" = "seller"): MarketplaceListingRequest {
  const uid = generateUid();
  const gb = pickRandom(RANDOM_GB);
  const username = pickRandom(RANDOM_USERNAMES);

  return {
    id: `test-gb-${uid}`,
    listing_id: `test-gb-listing-${uid}`,
    role,
    status: "pending",
    operator_name: gb.operator_name,
    operator_slug: gb.operator_slug,
    amount_gb: String(gb.amount_gb),
    price_per_gb_kzt: gb.price_per_gb_kzt,
    total_price_kzt: gb.total_price_kzt,
    counterparty_username: username,
    created_at: new Date().toISOString(),
    can_remind: false
  };
}

export function createRandomDevBuyerFamilyRequest(): FamilyRequest {
  const uid = generateUid();
  const srv = pickRandom(RANDOM_FAMILIES);
  const owner = pickRandom(RANDOM_USERNAMES);

  return {
    id: `test-fam-out-${uid}`,
    family_id: `test-fam-out-id-${uid}`,
    family_type: srv.family_type,
    service_name: srv.service_name,
    service_variant: null,
    plan_name: srv.plan_name,
    owner_username: owner,
    user_id: "200001",
    status: "pending",
    cancel_reason: null,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    decided_at: null,
    cancelled_at: null,
    expired_at: null,
    member_share_kzt: srv.member_share_kzt,
    price_kzt: srv.member_share_kzt
  };
}
