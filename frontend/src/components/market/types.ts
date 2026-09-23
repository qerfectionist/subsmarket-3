import type { AccountListing, Family, MarketplaceListing } from "../../types";

export const FIRST_RUN_BANNER_KEY = "subsmarket.firstRunBannerSeen.v1";
export const MAX_MARKET_BANNERS = 5;
export const MARKET_VIEW_STATE_KEY = "subsmarket.marketViewState.v1";

export type Offer =
  | { kind: "family"; item: Family }
  | { kind: "gigabytes"; item: MarketplaceListing }
  | { kind: "account"; item: AccountListing };

export type MarketFilter = "all" | "families" | "gigabytes" | "accounts";
export type PriceSort = "fast" | "asc" | "all" | "recent";
export type SubscriptionCategoryFilter = "all" | "video" | "ai" | "music" | "other";
export type TariffOperatorFilter = "all" | "tele2" | "activ" | "beeline" | "altel" | "other";
export type CatalogFilter = SubscriptionCategoryFilter | TariffOperatorFilter;
export type FilterMenuKey = "catalog" | "price";

export type FilterMenuOption = {
  value: string;
  label: string;
  count?: number;
  disabled?: boolean;
};

export type MarketBanner = {
  id: string;
  priority: 0 | 1 | 2 | 3;
  title: string;
  detail: string;
  detailNote: string;
  meta?: string;
  serviceName?: string;
  serviceSlug?: string | null;
  icon: "alert" | "clock" | "shield" | "payment" | "request" | "message" | "send";
  tone: "danger" | "warning" | "info" | "success" | "raspberry";
  pulse?: "notification" | "error" | "new-request" | "accepted";
  targetTab?: "inbox" | "outbox";
};

export type ScreenPulse = {
  kind: NonNullable<MarketBanner["pulse"]>;
  tone: MarketBanner["tone"];
};

export type ScreenPulseHandle = {
  trigger: (kind: ScreenPulse["kind"], tone: ScreenPulse["tone"]) => void;
};

export type BannerPointerState = {
  pointerId: number;
  startX: number;
  startY: number;
  originPosition: number;
  lastX: number;
  lastTime: number;
  velocityX: number;
  isDragging: boolean;
  cancelled: boolean;
};

export type CatalogPointerState = {
  pointerId: number;
  startX: number;
  startY: number;
  originPosition: number;
  lastX: number;
  lastTime: number;
  velocityX: number;
  isDragging: boolean;
  cancelled: boolean;
};

export type MarketViewState = {
  searchTerm: string;
  marketFilter: MarketFilter;
  scrollTop: number;
};

export const marketFilterOptions: { value: MarketFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "families", label: "Семьи" },
  { value: "gigabytes", label: "Гигабайты" },
  { value: "accounts", label: "Аккаунты" }
];

export const priceSortOptions: { value: PriceSort; label: string }[] = [
  { value: "fast", label: "Быстро" },
  { value: "asc", label: "Дешевле" },
  { value: "all", label: "Все" }
];

export const subscriptionCategoryOptions: { value: SubscriptionCategoryFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "video", label: "Видео" },
  { value: "ai", label: "AI" },
  { value: "music", label: "Музыка" },
  { value: "other", label: "Другое" }
];

export const tariffOperatorOptions: { value: TariffOperatorFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "tele2", label: "Tele2" },
  { value: "activ", label: "activ" },
  { value: "beeline", label: "Beeline" },
  { value: "altel", label: "Altel" },
  { value: "other", label: "Другие" }
];
