import type {
  AccountRequest,
  Family,
  FamilyRequest,
  MarketplaceListingRequest,
  OwnerFamilyRequest
} from "../types";
import {
  createRandomDevCandidate,
  createRandomDevAccountRequest,
  createRandomDevGbRequest,
  createRandomDevBuyerFamilyRequest,
  type DevCardCandidateOptions,
  type DevCardAccountOptions,
  type DevCardGbOptions,
  type DevCardBuyerFamilyOptions
} from "./devTestCards";
import { cleanAllCardsApi, clearArchiveApi, resetAndSeedAllApi } from "../api/dev";

export const DEV_TEST_CARDS_STORAGE_KEY = "sm_dev_test_cards_v3";
export const DEV_CARDS_UPDATE_EVENT = "subsmarket:dev-cards-updated";

export interface DevTestCardsState {
  candidates: Array<{ family: Family; request: OwnerFamilyRequest }>;
  sellerAccounts: AccountRequest[];
  buyerAccounts: AccountRequest[];
  sellerGb: MarketplaceListingRequest[];
  buyerGb: MarketplaceListingRequest[];
  buyerFamilies: FamilyRequest[];
}

export function createEmptyDevCardsState(): DevTestCardsState {
  return {
    candidates: [],
    sellerAccounts: [],
    buyerAccounts: [],
    sellerGb: [],
    buyerGb: [],
    buyerFamilies: []
  };
}

export function loadDevCards(): DevTestCardsState {
  if (typeof window === "undefined") {
    return createEmptyDevCardsState();
  }
  try {
    const raw = window.localStorage.getItem(DEV_TEST_CARDS_STORAGE_KEY);
    if (!raw) return createEmptyDevCardsState();
    const parsed = JSON.parse(raw);
    return {
      candidates: Array.isArray(parsed.candidates) ? parsed.candidates : [],
      sellerAccounts: Array.isArray(parsed.sellerAccounts) ? parsed.sellerAccounts : [],
      buyerAccounts: Array.isArray(parsed.buyerAccounts) ? parsed.buyerAccounts : [],
      sellerGb: Array.isArray(parsed.sellerGb) ? parsed.sellerGb : [],
      buyerGb: Array.isArray(parsed.buyerGb) ? parsed.buyerGb : [],
      buyerFamilies: Array.isArray(parsed.buyerFamilies) ? parsed.buyerFamilies : []
    };
  } catch {
    return createEmptyDevCardsState();
  }
}

export function notifyDevCardsUpdated(cards: DevTestCardsState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEV_TEST_CARDS_STORAGE_KEY, JSON.stringify(cards));
    window.dispatchEvent(new CustomEvent(DEV_CARDS_UPDATE_EVENT, { detail: cards }));
  } catch {
    // ignore
  }
}

export function countDevCards(state?: DevTestCardsState) {
  const cards = state ?? loadDevCards();
  const inbox = cards.candidates.length + cards.sellerAccounts.length + cards.sellerGb.length;
  const outbox = cards.buyerFamilies.length + cards.buyerAccounts.length + cards.buyerGb.length;
  return {
    total: inbox + outbox,
    inbox,
    outbox,
    candidates: cards.candidates.length,
    sellerAccounts: cards.sellerAccounts.length,
    buyerAccounts: cards.buyerAccounts.length,
    sellerGb: cards.sellerGb.length,
    buyerGb: cards.buyerGb.length,
    buyerFamilies: cards.buyerFamilies.length
  };
}

export function addDevCandidateCard(options?: DevCardCandidateOptions): DevTestCardsState {
  const current = loadDevCards();
  const item = createRandomDevCandidate(options);
  const updated: DevTestCardsState = {
    ...current,
    candidates: [item, ...current.candidates]
  };
  notifyDevCardsUpdated(updated);
  return updated;
}

export function addDevBuyerFamilyCard(options?: DevCardBuyerFamilyOptions): DevTestCardsState {
  const current = loadDevCards();
  const item = createRandomDevBuyerFamilyRequest(options);
  const updated: DevTestCardsState = {
    ...current,
    buyerFamilies: [item, ...current.buyerFamilies]
  };
  notifyDevCardsUpdated(updated);
  return updated;
}

export function addDevAccountCard(
  role: "seller" | "buyer",
  options?: DevCardAccountOptions
): DevTestCardsState {
  const current = loadDevCards();
  const item = createRandomDevAccountRequest(role, options);
  const updated: DevTestCardsState = {
    ...current,
    ...(role === "seller"
      ? { sellerAccounts: [item, ...current.sellerAccounts] }
      : { buyerAccounts: [item, ...current.buyerAccounts] })
  };
  notifyDevCardsUpdated(updated);
  return updated;
}

export function addDevGbCard(
  role: "seller" | "buyer",
  options?: DevCardGbOptions
): DevTestCardsState {
  const current = loadDevCards();
  const item = createRandomDevGbRequest(role, options);
  const updated: DevTestCardsState = {
    ...current,
    ...(role === "seller"
      ? { sellerGb: [item, ...current.sellerGb] }
      : { buyerGb: [item, ...current.buyerGb] })
  };
  notifyDevCardsUpdated(updated);
  return updated;
}

export function addAllDevCategoriesSet(
  scope: "inbox" | "outbox",
  timerSeconds?: number
): DevTestCardsState {
  const current = loadDevCards();
  if (scope === "inbox") {
    const cand = createRandomDevCandidate({ expiresInSeconds: timerSeconds });
    const acc = createRandomDevAccountRequest("seller");
    const gb = createRandomDevGbRequest("seller");
    const updated: DevTestCardsState = {
      ...current,
      candidates: [cand, ...current.candidates],
      sellerAccounts: [acc, ...current.sellerAccounts],
      sellerGb: [gb, ...current.sellerGb]
    };
    notifyDevCardsUpdated(updated);
    return updated;
  }

  const fam = createRandomDevBuyerFamilyRequest({ expiresInSeconds: timerSeconds });
  const acc = createRandomDevAccountRequest("buyer");
  const gb = createRandomDevGbRequest("buyer");
  const updated: DevTestCardsState = {
    ...current,
    buyerFamilies: [fam, ...current.buyerFamilies],
    buyerAccounts: [acc, ...current.buyerAccounts],
    buyerGb: [gb, ...current.buyerGb]
  };
  notifyDevCardsUpdated(updated);
  return updated;
}

export function clearLocalDevCards(): DevTestCardsState {
  const empty = createEmptyDevCardsState();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(DEV_TEST_CARDS_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  notifyDevCardsUpdated(empty);
  return empty;
}

export async function resetAndSeedServerCards(): Promise<void> {
  clearLocalDevCards();
  await resetAndSeedAllApi();
}

export async function cleanAllServerCards(): Promise<void> {
  clearLocalDevCards();
  await cleanAllCardsApi();
}

export async function clearServerArchive(): Promise<void> {
  await clearArchiveApi();
}
