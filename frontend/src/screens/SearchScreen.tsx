import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { AccountListingCard, FamilyListingCard, GigabytesListingCard } from "../components/ListingCard";
import { Ios27CategoryMenu } from "../components/Ios27CategoryMenu";
import { getListingPresence } from "../components/ListingAuthor";
import { resolveServiceBrand, ServiceLogo } from "../components/branding";
import { SystemSymbol } from "../components/SystemSymbol";
import { formatDate } from "../format";
import { triggerTelegramSelection } from "../telegram";
import type { AccountListing, Family, FamilyRequest, FamilyType, MarketplaceListing, MyFamily } from "../types";

const FIRST_RUN_BANNER_KEY = "subsmarket.firstRunBannerSeen.v1";
const MAX_MARKET_BANNERS = 5;

type Props = {
  view?: "market" | "family-catalog";
  userName: string;
  firstName?: string;
  familyType: FamilyType;
  filteredFamilies: Family[];
  subscriptionFamilies: Family[];
  tariffFamilies: Family[];
  familyLoading?: { subscription: boolean; tariff: boolean };
  marketplaceListings: MarketplaceListing[];
  accountListings: AccountListing[];
  myFamilies: MyFamily[];
  myRequests: FamilyRequest[];
  isLoading?: boolean;
  error?: string;
  hasMoreFamilies?: boolean;
  isLoadingMoreFamilies?: boolean;
  onOpenFamilyCatalog: (type: FamilyType) => void;
  onBack?: () => void;
  onRefresh?: () => void;
  onLoadMoreFamilies?: () => void;
  onOpenFamily: (id: string) => void;
  onOpenInvite: (code: string) => void;
  onCreateFamily: (type: FamilyType) => void;
  resetToken?: number;
  pendingActionsCount?: number;
  marketplaceSalesActionCount?: number;
  marketplacePurchaseActionCount?: number;
  accountSalesActionCount?: number;
  accountPurchaseActionCount?: number;
  onOpenMine?: () => void;
  onOpenActions?: () => void;
  onOpenGigabytes: (id?: string) => void;
  onOpenAccounts: (id?: string) => void;
};

type Offer =
  | { kind: "family"; item: Family }
  | { kind: "gigabytes"; item: MarketplaceListing }
  | { kind: "account"; item: AccountListing };

type MarketFilter = "all" | "families" | "gigabytes" | "accounts";
type PriceSort = "fast" | "asc" | "desc";
type SubscriptionCategoryFilter = "all" | "video" | "ai" | "music" | "other";
type TariffOperatorFilter = "all" | "tele2" | "activ" | "beeline" | "altel" | "other";
type CatalogFilter = SubscriptionCategoryFilter | TariffOperatorFilter;
type FilterMenuKey = "catalog" | "price";

type FilterMenuOption = {
  value: string;
  label: string;
  count?: number;
  disabled?: boolean;
};

type MarketBanner = {
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
};

type ScreenPulse = {
  kind: NonNullable<MarketBanner["pulse"]>;
  tone: MarketBanner["tone"];
};

type BannerPointerState = {
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

type CatalogPointerState = {
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

const marketFilterOptions: { value: MarketFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "families", label: "Семьи" },
  { value: "gigabytes", label: "Гигабайты" },
  { value: "accounts", label: "Аккаунты" }
];

const priceSortOptions: { value: PriceSort; label: string }[] = [
  { value: "fast", label: "Быстро" },
  { value: "asc", label: "Дешевле" },
  { value: "desc", label: "Дороже" }
];

const subscriptionCategoryOptions: { value: SubscriptionCategoryFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "video", label: "Видео" },
  { value: "ai", label: "AI" },
  { value: "music", label: "Музыка" },
  { value: "other", label: "Другое" }
];

const tariffOperatorOptions: { value: TariffOperatorFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "tele2", label: "Tele2" },
  { value: "activ", label: "activ" },
  { value: "beeline", label: "Beeline" },
  { value: "altel", label: "Altel" },
  { value: "other", label: "Другие" }
];

const MARKET_VIEW_STATE_KEY = "subsmarket.marketViewState.v1";

type MarketViewState = {
  searchTerm: string;
  marketFilter: MarketFilter;
  scrollTop: number;
};

function readMarketViewState(): MarketViewState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(MARKET_VIEW_STATE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<MarketViewState>;
    if (typeof value.searchTerm !== "string") return null;
    const marketFilter = marketFilterOptions.some(option => option.value === value.marketFilter)
      ? value.marketFilter as MarketFilter
      : "all";
    const scrollTop = typeof value.scrollTop === "number" && Number.isFinite(value.scrollTop)
      ? Math.max(0, value.scrollTop)
      : 0;
    return { searchTerm: value.searchTerm, marketFilter, scrollTop };
  } catch {
    return null;
  }
}

function writeMarketViewState(state: MarketViewState) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(MARKET_VIEW_STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}

function clearMarketViewState() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(MARKET_VIEW_STATE_KEY);
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}

function offerPrice(offer: Offer) {
  if (offer.kind === "family") return offer.item.member_share_kzt;
  if (offer.kind === "gigabytes") return offer.item.price_per_gb_kzt;
  return offer.item.price_kzt;
}

function offerResponsePriority(offer: Offer) {
  return getListingPresence(offer.item.owner.avatar_name) === "online" ? 1 : 0;
}

function offerServiceCategory(offer: Offer): Exclude<SubscriptionCategoryFilter, "all"> {
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

  if (slug === "chatgpt" || name.includes("chatgpt")) return "ai";

  switch (resolveServiceBrand(input).category) {
    case "video_streaming":
      return "video";
    case "music_audio":
      return "music";
    default:
      return "other";
  }
}

function offerTariffOperator(offer: Offer): Exclude<TariffOperatorFilter, "all"> {
  if (offer.kind !== "family") return "other";
  const slug = offer.item.service_slug?.toLocaleLowerCase("en-US") ?? "";
  const name = offer.item.service_name?.toLocaleLowerCase("ru-RU") ?? "";
  if (slug.includes("tele2") || name.includes("tele2") || name.includes("теле2")) return "tele2";
  if (slug.includes("activ") || name.includes("activ") || name.includes("актив")) return "activ";
  if (slug.includes("beeline") || name.includes("beeline") || name.includes("билайн")) return "beeline";
  if (slug.includes("altel") || name.includes("altel") || name.includes("алтел")) return "altel";
  return "other";
}

function matchesCatalogFilter(offer: Offer, filter: CatalogFilter, familyType: FamilyType) {
  if (filter === "all") return true;
  return familyType === "tariff"
    ? offerTariffOperator(offer) === filter
    : offerServiceCategory(offer) === filter;
}

const SEARCH_PLACEHOLDER_MESSAGES = [
  "Теле2 5 ГБ",
  "Active семья",
  "Tele2 семья",
  "Beeline семья",
  "ChatGPT Plus",
  "Яндекс Плюс",
  "YouTube Premium",
  "Spotify Premium"
] as const;

const SEARCH_PLACEHOLDER_START_DELAY = 220;
const SEARCH_PLACEHOLDER_TYPE_INTERVAL = 55;
const SEARCH_PLACEHOLDER_DELETE_INTERVAL = 34;
const SEARCH_PLACEHOLDER_HOLD_DELAY = 1700;
const SEARCH_PLACEHOLDER_NEXT_DELAY = 420;

function useTypingPlaceholder(
  inputRef: { current: HTMLInputElement | null },
  enabled: boolean,
  fallback: string
) {
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const searchInput = input;

    searchInput.placeholder = fallback;
    if (!enabled) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) return;

    let messageIndex = 0;
    let characterIndex = 0;
    let deleting = false;
    let timeoutId: number | null = null;

    const clearScheduledStep = () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      timeoutId = null;
    };

    const scheduleStep = (delay: number) => {
      timeoutId = window.setTimeout(step, delay);
    };

    function step() {
      timeoutId = null;
      const message = SEARCH_PLACEHOLDER_MESSAGES[messageIndex];

      if (!deleting) {
        characterIndex += 1;
        searchInput.placeholder = message.slice(0, characterIndex);
        if (characterIndex === message.length) {
          deleting = true;
          scheduleStep(SEARCH_PLACEHOLDER_HOLD_DELAY);
        } else {
          scheduleStep(SEARCH_PLACEHOLDER_TYPE_INTERVAL);
        }
        return;
      }

      characterIndex -= 1;
      searchInput.placeholder = message.slice(0, characterIndex);
      if (characterIndex === 0) {
        deleting = false;
        messageIndex = (messageIndex + 1) % SEARCH_PLACEHOLDER_MESSAGES.length;
        scheduleStep(SEARCH_PLACEHOLDER_NEXT_DELAY);
      } else {
        scheduleStep(SEARCH_PLACEHOLDER_DELETE_INTERVAL);
      }
    }

    searchInput.placeholder = "";
    scheduleStep(SEARCH_PLACEHOLDER_START_DELAY);

    const handleMotionChange = () => {
      if (!motionQuery.matches) return;
      clearScheduledStep();
      searchInput.placeholder = fallback;
    };
    motionQuery.addEventListener("change", handleMotionChange);

    return () => {
      clearScheduledStep();
      motionQuery.removeEventListener("change", handleMotionChange);
      searchInput.placeholder = fallback;
    };
  }, [enabled, fallback, inputRef]);
}

const DEV_BANNER_ITEMS: MarketBanner[] = [
  {
    id: "test-raspberry-banner",
    priority: 3,
    title: "Тест: действие требуется",
    detail: "Проверьте заявку",
    detailNote: "Без этого продолжить нельзя",
    meta: "Важно",
    icon: "alert",
    tone: "raspberry"
  },
  {
    id: "test-status-banner",
    priority: 3,
    title: "Тест: короткий статус",
    detail: "Состояние уведомления",
    detailNote: "Ожидает обновления",
    meta: "Ожидает",
    icon: "clock",
    tone: "warning",
    pulse: "notification"
  },
  {
    id: "test-long-banner",
    priority: 3,
    title: "Тест: длинный текст",
    detail: "Адаптивная типографика",
    detailNote: "Для разных экранов",
    meta: "Тест",
    icon: "message",
    tone: "success"
  }
];

type ScreenPulseHandle = {
  trigger: (kind: ScreenPulse["kind"], tone: ScreenPulse["tone"]) => void;
};

const SCREEN_PULSE_EDGES = ["top", "right", "bottom", "left"] as const;

const SCREEN_PULSE_KEYFRAMES: Keyframe[] = [
  { opacity: 0, offset: 0 },
  { opacity: 0.38, offset: 0.12 },
  { opacity: 0.72, offset: 0.24 },
  { opacity: 0.93, offset: 0.36 },
  { opacity: 1, offset: 0.48 },
  { opacity: 0.88, offset: 0.6 },
  { opacity: 0.68, offset: 0.72 },
  { opacity: 0.34, offset: 0.84 },
  { opacity: 0, offset: 1 }
];

const SCREEN_PULSE_ANIMATION_OPTIONS: KeyframeAnimationOptions = {
  duration: 1350,
  easing: "linear",
  fill: "both"
};

const ScreenEventPulse = memo(forwardRef<ScreenPulseHandle, object>(function ScreenEventPulse(_, ref) {
  const edgeRefs = useRef<HTMLSpanElement[]>([]);
  const animationsRef = useRef<Animation[]>([]);
  const timeoutRef = useRef<number | null>(null);
  const activationFrameRef = useRef<number | null>(null);

  const clearPulse = useCallback(() => {
    if (activationFrameRef.current !== null) {
      window.cancelAnimationFrame(activationFrameRef.current);
      activationFrameRef.current = null;
    }
    animationsRef.current.forEach(animation => animation.cancel());
    animationsRef.current = [];
    edgeRefs.current.forEach(edge => {
      edge.dataset.active = "false";
      edge.style.opacity = "";
    });
  }, []);

  useImperativeHandle(ref, () => ({
    trigger(kind, tone) {
      clearPulse();
      const edges = edgeRefs.current;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      edges.forEach(edge => {
        edge.dataset.active = "true";
        edge.dataset.event = kind;
        edge.dataset.tone = tone;
      });

      if (reducedMotion) {
        edges.forEach(edge => { edge.style.opacity = ".75"; });
      } else {
        // Start the compositor animation on the next frame without re-rendering the screen.
        const keyframes = SCREEN_PULSE_KEYFRAMES;
        activationFrameRef.current = window.requestAnimationFrame(() => {
          activationFrameRef.current = null;
          animationsRef.current = edges.map(edge => edge.animate(keyframes, SCREEN_PULSE_ANIMATION_OPTIONS));
        });
      }

      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        clearPulse();
      }, 1400);
    }
  }), [clearPulse]);

  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    clearPulse();
  }, [clearPulse]);

  return (
    <>
      {SCREEN_PULSE_EDGES.map(edge => (
        <span
          key={edge}
          ref={element => {
            if (element) edgeRefs.current[SCREEN_PULSE_EDGES.indexOf(edge)] = element;
          }}
          className={`sm-market-screen-event-pulse sm-market-screen-event-pulse-${edge}`}
          data-active="false"
          data-tone="info"
          aria-hidden="true"
        />
      ))}
    </>
  );
}));

export function SearchScreen({
  view = "market", userName, firstName, familyType, filteredFamilies,
  subscriptionFamilies, tariffFamilies, marketplaceListings, accountListings,
  familyLoading, myFamilies, myRequests, isLoading = false, error, hasMoreFamilies,
  isLoadingMoreFamilies, onOpenFamilyCatalog, onBack, onRefresh, onLoadMoreFamilies,
  onOpenFamily, onOpenInvite, onCreateFamily, resetToken, pendingActionsCount = 0,
  marketplaceSalesActionCount = 0, marketplacePurchaseActionCount = 0,
  accountSalesActionCount = 0, accountPurchaseActionCount = 0,
  onOpenMine, onOpenActions, onOpenGigabytes, onOpenAccounts
}: Props) {
  const [savedMarketViewState] = useState<MarketViewState | null>(
    () => view === "market" ? readMarketViewState() : null
  );
  const [searchTerm, setSearchTerm] = useState(savedMarketViewState?.searchTerm ?? "");
  const [marketFilter, setMarketFilter] = useState<MarketFilter>(savedMarketViewState?.marketFilter ?? "all");
  const [priceSort, setPriceSort] = useState<PriceSort>("fast");
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>("all");
  const [openFilterMenu, setOpenFilterMenu] = useState<FilterMenuKey | null>(null);
  const [menuVariant, setMenuVariant] = useState<"classic" | "ios27">(() => {
    const param = new URLSearchParams(window.location.search).get("menu");
    if (param === "ios27") return "ios27";
    if (param === "classic") return "classic";
    return localStorage.getItem("subsmarket.menuVariant") === "classic" ? "classic" : "ios27";
  });
  const [showIntro, setShowIntro] = useState(() => localStorage.getItem(FIRST_RUN_BANNER_KEY) !== "true");
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const bannerViewportRef = useRef<HTMLDivElement | null>(null);
  const bannerTrackRef = useRef<HTMLDivElement | null>(null);
  const bannerDotsRef = useRef<HTMLDivElement | null>(null);
  const bannerPositionRef = useRef(0);
  const bannerPointerRef = useRef<BannerPointerState | null>(null);
  const bannerAnimationFrame = useRef<number | null>(null);
  const bannerWasSwiped = useRef(false);
  const catalogViewportRef = useRef<HTMLDivElement | null>(null);
  const catalogTrackRef = useRef<HTMLDivElement | null>(null);
  const catalogPositionRef = useRef(familyType === "tariff" ? 1 : 0);
  const catalogPointerRef = useRef<CatalogPointerState | null>(null);
  const catalogAnimationFrame = useRef<number | null>(null);
  const catalogWasSwiped = useRef(false);
  const screenPulseRef = useRef<ScreenPulseHandle | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const marketScrollRef = useRef<HTMLDivElement | null>(null);
  const marketScrollTopRef = useRef(savedMarketViewState?.scrollTop ?? 0);
  const searchTermRef = useRef(searchTerm);
  const marketFilterRef = useRef(marketFilter);
  const persistScrollFrameRef = useRef<number | null>(null);
  const pendingMarketViewStateRef = useRef<MarketViewState | null>(savedMarketViewState);
  const hasRestoredScrollRef = useRef(false);
  const isInitialContextRef = useRef(true);
  const previousContextRef = useRef({ familyType, resetToken, view });
  const previousScreenPulseSignatureRef = useRef<string | null>(null);
  const previousBannerItemsRef = useRef<MarketBanner[] | null>(null);

  function persistMarketViewState(overrides: Partial<MarketViewState> = {}) {
    if (view !== "market") return;
    writeMarketViewState({
      searchTerm: overrides.searchTerm ?? searchTermRef.current,
      marketFilter: overrides.marketFilter ?? marketFilterRef.current,
      scrollTop: overrides.scrollTop ?? marketScrollTopRef.current
    });
  }

  function updateSearchTerm(value: string) {
    searchTermRef.current = value;
    setSearchTerm(value);
    persistMarketViewState({ searchTerm: value });
  }

  function updateMarketFilter(value: MarketFilter) {
    marketFilterRef.current = value;
    setMarketFilter(value);
    persistMarketViewState({ marketFilter: value });
  }

  function cycleMarketFilter() {
    triggerTelegramSelection();
    const currentIndex = marketFilterOptions.findIndex(option => option.value === marketFilterRef.current);
    const nextIndex = (currentIndex + 1) % marketFilterOptions.length;
    updateMarketFilter(marketFilterOptions[nextIndex].value);
    setOpenFilterMenu(null);
  }

  function toggleFilterMenu(menu: FilterMenuKey) {
    triggerTelegramSelection();
    setOpenFilterMenu(current => current === menu ? null : menu);
  }

  function scheduleMarketScrollPersistence(scrollTop: number) {
    marketScrollTopRef.current = scrollTop;
    if (persistScrollFrameRef.current !== null) return;
    persistScrollFrameRef.current = window.requestAnimationFrame(() => {
      persistScrollFrameRef.current = null;
      persistMarketViewState({ scrollTop: marketScrollTopRef.current });
    });
  }

  useEffect(() => {
    const previous = previousContextRef.current;
    previousContextRef.current = { familyType, resetToken, view };
    if (isInitialContextRef.current) {
      isInitialContextRef.current = false;
      return;
    }
    if (previous.familyType === familyType && previous.resetToken === resetToken && previous.view === view) return;
    if (bannerAnimationFrame.current !== null) cancelAnimationFrame(bannerAnimationFrame.current);
    bannerAnimationFrame.current = null;
    bannerPointerRef.current = null;
    bannerPositionRef.current = 0;
    bannerWasSwiped.current = false;
    const shouldClearSavedState = previous.resetToken !== resetToken ||
      (view === "market" && previous.familyType !== familyType);
    if (shouldClearSavedState) {
      clearMarketViewState();
      pendingMarketViewStateRef.current = null;
      marketScrollTopRef.current = 0;
    }
    if (view === "market" && previous.view !== "market") {
      const restored = readMarketViewState();
      pendingMarketViewStateRef.current = restored;
      hasRestoredScrollRef.current = false;
      if (restored) {
        searchTermRef.current = restored.searchTerm;
        marketFilterRef.current = restored.marketFilter;
        marketScrollTopRef.current = restored.scrollTop;
        setSearchTerm(restored.searchTerm);
        setMarketFilter(restored.marketFilter);
      } else {
        searchTermRef.current = "";
        marketFilterRef.current = "all";
        setSearchTerm("");
        setMarketFilter("all");
      }
    } else {
      searchTermRef.current = "";
      marketFilterRef.current = "all";
      setSearchTerm("");
      setMarketFilter("all");
    }
    setCatalogFilter("all");
    setPriceSort("fast");
    setOpenFilterMenu(null);
    setActiveBannerIndex(0);
    marketScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [familyType, resetToken, view]);
  useEffect(() => {
    if (view !== "market") return;
    return () => {
      if (persistScrollFrameRef.current !== null) cancelAnimationFrame(persistScrollFrameRef.current);
      persistScrollFrameRef.current = null;
      const scrollTop = hasRestoredScrollRef.current
        ? marketScrollRef.current?.scrollTop ?? marketScrollTopRef.current
        : pendingMarketViewStateRef.current?.scrollTop ?? marketScrollTopRef.current;
      writeMarketViewState({
        searchTerm: searchTermRef.current,
        marketFilter: marketFilterRef.current,
        scrollTop
      });
    };
  }, [view]);
  useEffect(() => () => {
    if (bannerAnimationFrame.current !== null) cancelAnimationFrame(bannerAnimationFrame.current);
  }, []);
  const term = searchTerm.trim().toLocaleLowerCase("ru-RU");
  const isInvite = /^\d{8}$/.test(term);
  const isCatalog = view === "family-catalog";
  const isSearching = Boolean(term) && !isInvite;
  const showPriceSort = isCatalog || isSearching;
  useTypingPlaceholder(searchInputRef, view === "market" && searchTerm.length === 0, "Сервис, оператор или аккаунт");
  useEffect(() => {
    if (!isCatalog) setCatalogFilter("all");
    if (!isSearching || isCatalog) setPriceSort("fast");
  }, [familyType, isCatalog, isSearching]);
  useEffect(() => {
    if (!openFilterMenu) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !filterMenuRef.current?.contains(target)) setOpenFilterMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenFilterMenu(null);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openFilterMenu]);
  const matches = (...values: (string | null | undefined)[]) =>
    !isSearching || values.filter(Boolean).join(" ").toLocaleLowerCase("ru-RU").includes(term);
  const joined = new Set(myFamilies.map(item => item.family.id));
  const pending = new Set(myRequests.filter(item => item.status === "pending").map(item => item.family_id));
  const catalogTitle = familyType === "tariff" ? "Семейные тарифы" : "Семейные подписки";
  const catalogSectionTitle = familyType === "tariff" ? "Доступные тарифы" : "Доступные подписки";
  const catalogSearchPlaceholder = familyType === "tariff" ? "Оператор или тариф" : "Сервис или подписка";
  const catalogEmptyTitle = familyType === "tariff" ? "Доступных тарифов пока нет" : "Доступных подписок пока нет";
  const activeMarketFilterIndex = marketFilterOptions.findIndex(option => option.value === marketFilter);
  const activeMarketFilter = marketFilterOptions[activeMarketFilterIndex] ?? marketFilterOptions[0];
  const activePriceSortIndex = priceSortOptions.findIndex(option => option.value === priceSort);
  const activePriceSort = priceSortOptions[activePriceSortIndex] ?? priceSortOptions[0];
  const catalogFilterOptions = familyType === "tariff" ? tariffOperatorOptions : subscriptionCategoryOptions;
  const activeCatalogFilterIndex = catalogFilterOptions.findIndex(option => option.value === catalogFilter);
  const activeCatalogFilter = catalogFilterOptions[activeCatalogFilterIndex] ?? catalogFilterOptions[0];
  const effectiveCatalogFilter = activeCatalogFilter.value;
  const approvedFamilyRequests = useMemo(
    () => myRequests.filter(request => request.status === "approved"),
    [myRequests]
  );
  const marketSubscriptionFamilies = useMemo(() => {
    const youtubeFamily = subscriptionFamilies.find(item => item.service_slug === "youtube-premium");
    if (!youtubeFamily) return subscriptionFamilies;
    return [youtubeFamily, ...subscriptionFamilies.filter(item => item.id !== youtubeFamily.id)];
  }, [subscriptionFamilies]);

  const allOffers = useMemo<Offer[]>(() => {
    const groups: Offer[][] = [
      marketSubscriptionFamilies.map(item => ({ kind: "family" as const, item })),
      tariffFamilies.map(item => ({ kind: "family" as const, item })),
      marketplaceListings.map(item => ({ kind: "gigabytes" as const, item })),
      accountListings.map(item => ({ kind: "account" as const, item }))
    ];
    const result: Offer[] = [];
    for (let index = 0; index < Math.max(0, ...groups.map(group => group.length)); index++) {
      for (const group of groups) if (group[index]) result.push(group[index]);
    }
    return result;
  }, [marketSubscriptionFamilies, tariffFamilies, marketplaceListings, accountListings]);

  const offers: Offer[] = isCatalog
    ? filteredFamilies.map(item => ({ kind: "family", item }))
    : allOffers.filter(offer =>
      marketFilter === "all" ||
      (marketFilter === "families" && offer.kind === "family") ||
      (marketFilter === "gigabytes" && offer.kind === "gigabytes") ||
      (marketFilter === "accounts" && offer.kind === "account")
    );
  const visible = offers.filter(offer => {
    if (offer.kind === "family") {
      const f = offer.item;
      return matches(f.service_name, f.service_variant, f.plan_name, f.owner.avatar_name);
    }
    if (offer.kind === "gigabytes") return matches(offer.item.operator.name, "Гигабайты", offer.item.description, offer.item.owner.avatar_name);
    return matches(offer.item.title, offer.item.service.name, offer.item.description, offer.item.owner.avatar_name);
  });
  const categoryVisible = isCatalog && effectiveCatalogFilter !== "all"
    ? visible.filter(offer => matchesCatalogFilter(offer, effectiveCatalogFilter, familyType))
    : visible;
  const catalogFilterMenuOptions: FilterMenuOption[] = catalogFilterOptions.map(option => {
    const count = option.value === "all"
      ? visible.length
      : visible.filter(offer => matchesCatalogFilter(offer, option.value, familyType)).length;
    return {
      ...option,
      count,
      disabled: option.value !== "all" && count === 0 && option.value !== effectiveCatalogFilter
    };
  });
  const sortedVisible = showPriceSort
    ? [...categoryVisible].sort((left, right) => {
      if (priceSort === "fast") {
        return offerResponsePriority(right) - offerResponsePriority(left);
      }
      const difference = offerPrice(left) - offerPrice(right);
      return priceSort === "asc" ? difference : -difference;
    })
    : categoryVisible;
  const displayed = isCatalog || isSearching ? sortedVisible : sortedVisible.filter(offer =>
    offer.kind === "family" ? offer.item.status === "active" && offer.item.free_slots > 0 : offer.item.status === "active"
  ).slice(0, 8);

  const catalogDisplayedByType = useMemo<Record<FamilyType, Offer[]>>(() => {
    const buildAdjacentCatalog = (type: FamilyType) => {
      if (type === familyType) return displayed;
      const source = type === "tariff" ? tariffFamilies : subscriptionFamilies;
      const adjacentVisible = source
        .map(item => ({ kind: "family" as const, item }))
        .filter(offer => {
          const f = offer.item;
          return !isSearching || [f.service_name, f.service_variant, f.plan_name, f.owner.avatar_name]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("ru-RU")
            .includes(term);
        });
      return [...adjacentVisible].sort((left, right) => {
        if (priceSort === "fast") return offerResponsePriority(right) - offerResponsePriority(left);
        const difference = offerPrice(left) - offerPrice(right);
        return priceSort === "asc" ? difference : -difference;
      });
    };

    return {
      subscription: buildAdjacentCatalog("subscription"),
      tariff: buildAdjacentCatalog("tariff")
    };
  }, [displayed, familyType, isSearching, priceSort, subscriptionFamilies, tariffFamilies, term]);

  useEffect(() => {
    const saved = pendingMarketViewStateRef.current;
    if (view !== "market" || hasRestoredScrollRef.current || !saved) return;
    if (isLoading && displayed.length === 0) return;
    const frame = window.requestAnimationFrame(() => {
      const scroll = marketScrollRef.current;
      if (!scroll) return;
      const maxScrollTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
      const scrollTop = Math.min(saved.scrollTop, maxScrollTop);
      scroll.scrollTo({ top: scrollTop, behavior: "auto" });
      marketScrollTopRef.current = scrollTop;
      hasRestoredScrollRef.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [displayed.length, isLoading, view]);

  const bannerItems = useMemo<MarketBanner[]>(() => {
    const items: MarketBanner[] = [];
    const ownerRequestCount = myFamilies.reduce((total, item) => total + item.pending_requests_count, 0);
    const outgoingRequests = myRequests.filter(request => request.status === "pending");
    const accessToCheck = myFamilies.filter(item => item.membership.status === "awaiting_confirmation");
    const accessWaiting = myFamilies.filter(item => item.membership.status === "awaiting_access");
    const openPayments = myFamilies.flatMap(item => item.payments
      .filter(payment => ["due", "overdue"].includes(payment.status))
      .map(payment => ({ family: item.family, payment })));
    const reportedPayments = myFamilies.flatMap(item => item.payments
      .filter(payment => payment.status === "payment_reported")
      .map(payment => ({ family: item.family, payment })));
    const overduePayment = openPayments.find(item => item.payment.status === "overdue");
    const duePayment = overduePayment ?? openPayments[0];
    const sellerActionCount = marketplaceSalesActionCount + accountSalesActionCount;
    const buyerActionCount = marketplacePurchaseActionCount + accountPurchaseActionCount;

    if (duePayment) {
      items.push({
        id: "payment-due",
        priority: overduePayment ? 0 : 1,
        title: overduePayment ? "Оплата просрочена" : `Оплата до ${formatDate(duePayment.payment.due_at)}`,
        detail: `${familyLabel(duePayment.family)} · ${formatKzt(duePayment.payment.amount_kzt)}`,
        detailNote: `${overduePayment ? "Требуется оплата" : "Проверьте срок платежа"}${openPayments.length > 1 ? ` · ещё ${openPayments.length - 1}` : ""}`,
        meta: overduePayment ? "Важно" : "Срок",
        serviceName: duePayment.family.service_name,
        serviceSlug: duePayment.family.service_slug,
        icon: overduePayment ? "alert" : "clock",
        tone: overduePayment ? "danger" : "warning",
        pulse: overduePayment ? "error" : undefined
      });
    }
    if (accessToCheck.length > 0) {
      const family = accessToCheck[0].family;
      items.push({
        id: "access-check",
        priority: 1,
        title: "Проверьте доступ",
        detail: familyLabel(family),
        detailNote: "Оплата пока не нужна",
        meta: "Сейчас",
        serviceName: family.service_name,
        serviceSlug: family.service_slug,
        icon: "shield",
        tone: "warning",
        pulse: "notification"
      });
    }
    if (reportedPayments.length > 0) {
      const { family, payment } = reportedPayments[0];
      items.push({
        id: "payment-reported",
        priority: 2,
        title: "Оплата ждёт подтверждения",
        detail: `${familyLabel(family)} · ${formatKzt(payment.amount_kzt)}`,
        detailNote: `Ждём подтверждения владельца${reportedPayments.length > 1 ? ` · ещё ${reportedPayments.length - 1}` : ""}`,
        meta: "Ожидает",
        serviceName: family.service_name,
        serviceSlug: family.service_slug,
        icon: "payment",
        tone: "info",
        pulse: "notification"
      });
    }
    if (ownerRequestCount > 0) {
      const family = myFamilies.find(item => item.pending_requests_count > 0)?.family;
      items.push({
        id: "owner-requests",
        priority: 1,
        title: ownerRequestCount === 1 ? "Новая заявка в семью" : "Новые заявки в семьи",
        detail: `${family ? familyLabel(family) + " · " : ""}${ownerRequestCount} ${pluralRu(ownerRequestCount, "заявка", "заявки", "заявок")} ждут ответа`,
        detailNote: "Откройте заявку и ответьте",
        meta: "Новая",
        serviceName: family?.service_name,
        serviceSlug: family?.service_slug,
        icon: "request",
        tone: "warning",
        pulse: "new-request"
      });
    }
    if (approvedFamilyRequests.length > 0) {
      const request = approvedFamilyRequests[0];
      const variant = request.service_variant ?? request.plan_name;
      items.push({
        id: "family-request-approved",
        priority: 1,
        title: approvedFamilyRequests.length === 1 ? "Заявка принята" : "Заявки приняты",
        detail: `${[request.service_name, variant].filter(Boolean).join(" · ")}${approvedFamilyRequests.length > 1 ? ` · ещё ${approvedFamilyRequests.length - 1}` : ""}`,
        detailNote: "Договоритесь с владельцем и получите доступ",
        meta: "Принято",
        serviceName: request.service_name,
        icon: "payment",
        tone: "success",
        pulse: "accepted"
      });
    }
    if (sellerActionCount > 0) {
      const details = [
        marketplaceSalesActionCount > 0 ? `Гигабайты: ${marketplaceSalesActionCount}` : null,
        accountSalesActionCount > 0 ? `Аккаунты: ${accountSalesActionCount}` : null
      ].filter(Boolean).join(" · ");
      items.push({
        id: "marketplace-sales",
        priority: 1,
        title: sellerActionCount === 1 ? "Заявка на объявление" : "Заявки на объявления",
        detail: details,
        detailNote: "Нужен ваш ответ",
        meta: "Новая",
        icon: "message",
        tone: "warning",
        pulse: "new-request"
      });
    }
    if (buyerActionCount > 0) {
      const details = [
        marketplacePurchaseActionCount > 0 ? `Гигабайты: ${marketplacePurchaseActionCount}` : null,
        accountPurchaseActionCount > 0 ? `Аккаунты: ${accountPurchaseActionCount}` : null
      ].filter(Boolean).join(" · ");
      items.push({
        id: "marketplace-purchases",
        priority: 3,
        title: buyerActionCount === 1 ? "Заявка принята" : "Заявки приняты",
        detail: details,
        detailNote: "Напишите продавцу",
        meta: "Принято",
        icon: "message",
        tone: "success",
        pulse: "accepted"
      });
    }
    if (outgoingRequests.length > 0) {
      const request = outgoingRequests[0];
      const variant = request.service_variant ?? request.plan_name;
      items.push({
        id: "family-request",
        priority: 2,
        title: "Заявка отправлена",
        detail: `${[request.service_name, variant].filter(Boolean).join(" · ")}${outgoingRequests.length > 1 ? ` · ещё ${outgoingRequests.length - 1}` : ""}`,
        detailNote: "На рассмотрении владельца",
        meta: "Ждём ответа",
        serviceName: request.service_name,
        icon: "send",
        tone: "info"
      });
    }
    if (accessWaiting.length > 0) {
      const family = accessWaiting[0].family;
      items.push({
        id: "access-waiting",
        priority: 2,
        title: "Доступ ещё не выдан",
        detail: familyLabel(family),
        detailNote: `Ждём подтверждение владельца${accessWaiting.length > 1 ? ` · ещё ${accessWaiting.length - 1}` : ""}`,
        meta: "Ожидает",
        serviceName: family.service_name,
        serviceSlug: family.service_slug,
        icon: "shield",
        tone: "info"
      });
    }
    if (import.meta.env.DEV) items.push(...DEV_BANNER_ITEMS);
    return items
      .map((item, index) => ({ item, index }))
      .sort((left, right) => left.item.priority - right.item.priority || left.index - right.index)
      .slice(0, MAX_MARKET_BANNERS)
      .map(({ item }) => item);
  }, [accountPurchaseActionCount, accountSalesActionCount, approvedFamilyRequests, marketplacePurchaseActionCount, marketplaceSalesActionCount, myFamilies, myRequests]);
  const screenPulseBanner = bannerItems.find(item => item.pulse === "error")
    ?? bannerItems.find(item => item.pulse === "accepted")
    ?? bannerItems.find(item => item.pulse === "new-request")
    ?? bannerItems.find(item => item.pulse);
  const screenPulseKind: NonNullable<MarketBanner["pulse"]> | undefined = error
    ? "error"
    : screenPulseBanner?.pulse;
  const screenPulseTone: MarketBanner["tone"] | undefined = error
    ? "danger"
    : screenPulseBanner?.tone;
  const screenPulseSignature = error
    ? `error:${error}`
    : bannerItems
      .filter(item => item.pulse)
      .map(item => `${item.id}:${item.pulse}:${item.title}:${item.detail}:${item.meta ?? ""}`)
      .join("|");

  const triggerScreenPulse = useCallback((kind: ScreenPulse["kind"], tone: ScreenPulse["tone"]) => {
    screenPulseRef.current?.trigger(kind, tone);
  }, []);

  useEffect(() => {
    const previousSignature = previousScreenPulseSignatureRef.current;
    previousScreenPulseSignatureRef.current = screenPulseSignature;
    if (view !== "market" || !screenPulseKind || !screenPulseTone) return;
    const isInitialDevPreview = previousSignature === null && import.meta.env.DEV;
    if (!isInitialDevPreview && previousSignature === screenPulseSignature) return;

    triggerScreenPulse(screenPulseKind, screenPulseTone);
  }, [screenPulseKind, screenPulseSignature, screenPulseTone, triggerScreenPulse, view]);

  useEffect(() => {
    const previousBannerItems = previousBannerItemsRef.current;
    previousBannerItemsRef.current = bannerItems;
    if (view !== "market" || !bannerItems.length) return;

    const signature = (item: MarketBanner) => [
      item.id,
      item.priority,
      item.title,
      item.detail,
      item.detailNote,
      item.meta ?? "",
      item.serviceName ?? "",
      item.serviceSlug ?? "",
      item.icon,
      item.tone,
      item.pulse ?? ""
    ].join("|");
    const changedBannerIndexes = bannerItems.reduce<number[]>((indexes, item, index) => {
      const previous = previousBannerItems?.find(previousItem => previousItem.id === item.id);
      if (!previous || signature(previous) !== signature(item)) indexes.push(index);
      return indexes;
    }, []);
    const highPriorityChangedIndex = changedBannerIndexes.find(index => bannerItems[index].pulse === "error")
      ?? changedBannerIndexes.find(index => bannerItems[index].pulse === "accepted")
      ?? changedBannerIndexes.find(index => bannerItems[index].pulse === "new-request");
    const fallbackChangedIndex = changedBannerIndexes.find(index => !bannerItems[index].id.startsWith("test-"))
      ?? (previousBannerItems === null ? undefined : changedBannerIndexes[0]);
    const previousActiveIndex = previousBannerItems
      ? Math.min(Math.max(Math.round(bannerPositionRef.current), 0), previousBannerItems.length - 1)
      : -1;
    const previousActiveBanner = previousBannerItems?.[previousActiveIndex];
    const currentPreviousActiveBannerIndex = previousActiveBanner
      ? bannerItems.findIndex(item => item.id === previousActiveBanner.id)
      : -1;
    const keepCurrentImportantBanner = highPriorityChangedIndex === undefined &&
      currentPreviousActiveBannerIndex >= 0 &&
      ["error", "accepted", "new-request"].includes(previousActiveBanner?.pulse ?? "");
    const changedBannerIndex = highPriorityChangedIndex
      ?? (keepCurrentImportantBanner ? undefined : fallbackChangedIndex);
    if (changedBannerIndex === undefined) return;

    stopBannerAnimation();
    bannerPointerRef.current = null;
    bannerWasSwiped.current = false;
    bannerPositionRef.current = changedBannerIndex;
    setActiveBannerIndex(changedBannerIndex);
  }, [bannerItems, view]);

  const safeBannerIndex = Math.min(activeBannerIndex, Math.max(0, bannerItems.length - 1));
  const activeBanner = bannerItems[safeBannerIndex];
  const activeBannerDetail = activeBanner ? [activeBanner.detail, activeBanner.detailNote].filter(Boolean).join(" · ") : "";
  const activeBannerAnnouncement = activeBanner
    ? [activeBanner.title, activeBannerDetail, activeBanner.meta].filter(Boolean).join(". ")
    : "";

  function setBannerPosition(position: number) {
    bannerPositionRef.current = position;
    const track = bannerTrackRef.current;
    if (track) track.style.transform = `translate3d(${-position * 100}%, 0, 0)`;

    const dots = bannerDotsRef.current;
    if (dots && bannerItems.length > 1) {
      const boundedPosition = Math.min(Math.max(position, 0), bannerItems.length - 1);
      const dotSpacing = document.documentElement.dataset.higReview === "on" ? 44 : 28;
      const centerOffset = (boundedPosition - (bannerItems.length - 1) / 2) * dotSpacing;
      dots.style.setProperty("--sm-banner-dot-offset", `${centerOffset}px`);
    }
  }

  function stopBannerAnimation() {
    if (bannerAnimationFrame.current !== null) cancelAnimationFrame(bannerAnimationFrame.current);
    bannerAnimationFrame.current = null;
  }

  function animateBannerTo(nextIndex: number, initialVelocity = 0) {
    if (bannerItems.length < 1) return;
    stopBannerAnimation();
    const target = Math.min(Math.max(nextIndex, 0), bannerItems.length - 1);
    const start = bannerPositionRef.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || Math.abs(target - start) < 0.001) {
      setBannerPosition(target);
      setActiveBannerIndex(target);
      return;
    }

    let position = start;
    let velocity = Math.max(-4, Math.min(4, initialVelocity));
    let previousTime = performance.now();
    const step = (time: number) => {
      const deltaTime = Math.min((time - previousTime) / 1000, 0.032);
      previousTime = time;
      const acceleration = (target - position) * 260 - velocity * 32;
      velocity += acceleration * deltaTime;
      position += velocity * deltaTime;
      setBannerPosition(position);

      if (Math.abs(target - position) < 0.001 && Math.abs(velocity) < 0.01) {
        setBannerPosition(target);
        bannerAnimationFrame.current = null;
        setActiveBannerIndex(target);
        return;
      }
      bannerAnimationFrame.current = requestAnimationFrame(step);
    };
    bannerAnimationFrame.current = requestAnimationFrame(step);
  }

  function handleBannerPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (bannerItems.length < 2 || (event.pointerType === "mouse" && event.button !== 0)) return;
    stopBannerAnimation();
    bannerWasSwiped.current = false;
    bannerPointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originPosition: bannerPositionRef.current,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocityX: 0,
      isDragging: false,
      cancelled: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleBannerPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const pointer = bannerPointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId || pointer.cancelled) return;
    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    if (!pointer.isDragging) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        pointer.cancelled = true;
        bannerPointerRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        return;
      }
      pointer.isDragging = true;
      bannerWasSwiped.current = true;
    }

    const now = performance.now();
    const elapsed = Math.max(1, now - pointer.lastTime);
    pointer.velocityX = ((event.clientX - pointer.lastX) / elapsed) * 1000;
    pointer.lastX = event.clientX;
    pointer.lastTime = now;
    const width = bannerViewportRef.current?.clientWidth || event.currentTarget.clientWidth || 1;
    const rawPosition = pointer.originPosition - deltaX / width;
    const maxPosition = bannerItems.length - 1;
    const position = rawPosition < 0
      ? rawPosition * 0.25
      : rawPosition > maxPosition
        ? maxPosition + (rawPosition - maxPosition) * 0.25
        : rawPosition;
    setBannerPosition(position);
  }

  function handleBannerPointerEnd(event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) {
    const pointer = bannerPointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    bannerPointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (pointer.cancelled) return;
    if (cancelled) {
      animateBannerTo(Math.round(bannerPositionRef.current));
      return;
    }
    if (!pointer.isDragging) return;

    const deltaX = event.clientX - pointer.startX;
    const width = bannerViewportRef.current?.clientWidth || event.currentTarget.clientWidth || 1;
    const passedDistance = Math.abs(deltaX) >= width * 0.2;
    const passedVelocity = Math.abs(pointer.velocityX) >= 450;
    let target = Math.round(bannerPositionRef.current);
    if (passedDistance || passedVelocity) {
      const direction = deltaX < 0 || pointer.velocityX < 0 ? 1 : -1;
      target = Math.round(pointer.originPosition) + direction;
    }
    target = Math.min(Math.max(target, 0), bannerItems.length - 1);
    animateBannerTo(target, -pointer.velocityX / width);
  }

  function setCatalogPosition(position: number) {
    catalogPositionRef.current = position;
    const track = catalogTrackRef.current;
    if (track) track.style.transform = `translate3d(${-position * 50}%, 0, 0)`;
    document.querySelector<HTMLElement>(".sm-market-family-type-switch")?.style.setProperty("--catalog-type-position", String(position));
  }

  function stopCatalogAnimation() {
    if (catalogAnimationFrame.current !== null) cancelAnimationFrame(catalogAnimationFrame.current);
    catalogAnimationFrame.current = null;
  }

  function animateCatalogTo(nextPosition: number, initialVelocity = 0) {
    const target = Math.min(Math.max(nextPosition, 0), 1);
    stopCatalogAnimation();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCatalogPosition(target);
      return;
    }

    let position = catalogPositionRef.current;
    let velocity = Math.max(-4, Math.min(4, initialVelocity));
    let previousTime = performance.now();
    const step = (time: number) => {
      const deltaTime = Math.min((time - previousTime) / 1000, 0.032);
      previousTime = time;
      const acceleration = (target - position) * 260 - velocity * 32;
      velocity += acceleration * deltaTime;
      position += velocity * deltaTime;
      setCatalogPosition(position);

      if (Math.abs(target - position) < 0.001 && Math.abs(velocity) < 0.01) {
        setCatalogPosition(target);
        catalogAnimationFrame.current = null;
        return;
      }
      catalogAnimationFrame.current = requestAnimationFrame(step);
    };
    catalogAnimationFrame.current = requestAnimationFrame(step);
  }

  function handleCatalogPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    stopCatalogAnimation();
    catalogWasSwiped.current = false;
    catalogPointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originPosition: catalogPositionRef.current,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocityX: 0,
      isDragging: false,
      cancelled: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCatalogPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = catalogPointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId || pointer.cancelled) return;
    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    if (!pointer.isDragging) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        pointer.cancelled = true;
        catalogPointerRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        return;
      }
      pointer.isDragging = true;
      catalogWasSwiped.current = true;
    }

    const now = performance.now();
    const elapsed = Math.max(1, now - pointer.lastTime);
    pointer.velocityX = ((event.clientX - pointer.lastX) / elapsed) * 1000;
    pointer.lastX = event.clientX;
    pointer.lastTime = now;
    const width = catalogViewportRef.current?.clientWidth || 1;
    const rawPosition = pointer.originPosition - deltaX / width;
    const position = rawPosition < 0
      ? rawPosition * 0.25
      : rawPosition > 1
        ? 1 + (rawPosition - 1) * 0.25
        : rawPosition;
    setCatalogPosition(position);
  }

  function handleCatalogPointerEnd(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
    const pointer = catalogPointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    catalogPointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (pointer.cancelled) return;
    if (cancelled) {
      animateCatalogTo(Math.round(catalogPositionRef.current));
      return;
    }
    if (!pointer.isDragging) return;

    const deltaX = event.clientX - pointer.startX;
    const width = catalogViewportRef.current?.clientWidth || 1;
    const passedDistance = Math.abs(deltaX) >= width * 0.18;
    const passedVelocity = Math.abs(pointer.velocityX) >= 450;
    let target = Math.round(catalogPositionRef.current);
    if (passedDistance || passedVelocity) {
      const direction = deltaX < 0 || pointer.velocityX < 0 ? 1 : -1;
      target = Math.round(pointer.originPosition) + direction;
    }
    target = Math.min(Math.max(target, 0), 1);
    animateCatalogTo(target, -pointer.velocityX / width);

    const nextType: FamilyType = target === 1 ? "tariff" : "subscription";
    if (nextType !== familyType) {
      triggerTelegramSelection();
      setCatalogFilter("all");
      onOpenFamilyCatalog(nextType);
    }
  }

  useEffect(() => () => stopCatalogAnimation(), []);
  useEffect(() => {
    if (!isCatalog) return;
    const target = familyType === "tariff" ? 1 : 0;
    if (catalogPointerRef.current) return;
    if (Math.abs(catalogPositionRef.current - target) < 0.001) {
      setCatalogPosition(target);
      return;
    }
    animateCatalogTo(target);
  }, [familyType, isCatalog]);

  useEffect(() => {
    if (bannerPointerRef.current || bannerAnimationFrame.current !== null) return;
    setBannerPosition(safeBannerIndex);
  }, [bannerItems.length, safeBannerIndex]);

  function openInvite() { if (isInvite) onOpenInvite(term); }

  return (
    <div
      ref={marketScrollRef}
      onScroll={event => scheduleMarketScrollPersistence(event.currentTarget.scrollTop)}
      className="subs-screen-scroll sm-market-screen"
      data-testid={isCatalog ? "family-catalog-screen" : "market-screen"}
    >
      {!isCatalog ? <ScreenEventPulse ref={screenPulseRef} /> : null}
      {isCatalog ? (
        <header className="sm-market-catalog-header">
          <h1>{catalogTitle}</h1>
        </header>
      ) : (
        <header className="sm-market-header">
          <div className="sm-market-heading-copy">
            <h1>SubsMarket</h1>
          </div>
          <button type="button" className="sm-market-avatar-button" aria-label="Мой профиль" onClick={() => onOpenMine?.()}>
            {(firstName || userName || "SM").slice(0, 2).toUpperCase()}
          </button>
        </header>
      )}

      <label className="sm-market-search">
          <SystemSymbol name="magnifyingglass" size={20} />
          <input
            ref={searchInputRef}
            type="search"
            aria-label={isCatalog ? `Поиск: ${catalogTitle.toLowerCase()}` : "Поиск сервиса или семьи"}
            data-testid={isCatalog ? "family-catalog-search-input" : "market-search-input"}
            placeholder={isCatalog ? catalogSearchPlaceholder : "Сервис, оператор или аккаунт"}
          value={searchTerm} onChange={e => updateSearchTerm(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") openInvite(); }}
        />
        {searchTerm ? <button type="button" className="sm-market-search-clear" aria-label="Очистить поиск" onClick={() => updateSearchTerm("")}><SystemSymbol name="xmark" size={18} /></button> : null}
      </label>

      {isCatalog ? (
        <nav className="sm-market-family-type-switch" aria-label="Тип семейных предложений" style={{ "--catalog-type-position": familyType === "tariff" ? 1 : 0 } as React.CSSProperties}>
          <button
            type="button"
            data-testid="family-type-subscription"
            aria-pressed={familyType === "subscription"}
            className={familyType === "subscription" ? "is-active" : undefined}
            onClick={() => { triggerTelegramSelection(); onOpenFamilyCatalog("subscription"); }}
          >
            Подписки
          </button>
          <button
            type="button"
            data-testid="family-type-tariff"
            aria-pressed={familyType === "tariff"}
            className={familyType === "tariff" ? "is-active" : undefined}
            onClick={() => { triggerTelegramSelection(); onOpenFamilyCatalog("tariff"); }}
          >
            Тарифы
          </button>
        </nav>
      ) : null}

      {!isCatalog && isInvite ? <button className="sm-market-button sm-market-button-primary" type="button" onClick={openInvite}>Открыть семью по коду {term}</button> : null}

      {!isCatalog && !isSearching ? (
        <>
          {showIntro && pendingActionsCount === 0 ? (
            <section className="sm-market-alert" data-testid="market-first-run-banner">
              <div><span className="sm-market-alert-eyebrow">Для семейных подписок</span><strong>Сначала доступ, потом оплата</strong><p>Проверьте подписку перед переводом владельцу семьи.</p></div>
              <button className="sm-market-button sm-market-button-secondary" type="button" onClick={() => { localStorage.setItem(FIRST_RUN_BANNER_KEY, "true"); setShowIntro(false); }}>Понятно</button>
            </section>
          ) : null}
          {activeBanner ? (
            <section className="sm-market-action-banner" aria-label="Действия и уведомления">
              <span className="sr-only" aria-live="polite" aria-atomic="true" key={activeBanner.id}>
                {activeBannerAnnouncement}
              </span>
              <div className="sm-market-action-banner-viewport" ref={bannerViewportRef}>
                <div
                  className="sm-market-action-banner-track"
                  ref={bannerTrackRef}
                  style={{ transform: `translate3d(${-bannerPositionRef.current * 100}%, 0, 0)` }}
                >
                  {bannerItems.map((banner, index) => {
                    const isActive = index === safeBannerIndex;
                    const bannerDetail = [banner.detail, banner.detailNote].filter(Boolean).join(" · ");
                    return (
                      <button
                        key={banner.id}
                        className={`sm-market-action-banner-button${banner.meta ? "" : " sm-market-action-banner-button-no-meta"}`}
                        data-tone={banner.tone}
                        type="button"
                        data-testid={isActive ? "market-notifications" : undefined}
                        aria-hidden={!isActive}
                        tabIndex={isActive ? 0 : -1}
                        aria-label={[banner.title, bannerDetail, banner.meta, "Открыть"].filter(Boolean).join(". ")}
                        onClick={() => {
                          if (bannerWasSwiped.current) {
                            bannerWasSwiped.current = false;
                            return;
                          }
                          onOpenActions?.();
                        }}
                        onKeyDown={event => {
                          if (event.key === "ArrowRight") {
                            event.preventDefault();
                            if (bannerItems.length > 1) animateBannerTo((safeBannerIndex + 1) % bannerItems.length);
                          } else if (event.key === "ArrowLeft") {
                            event.preventDefault();
                            if (bannerItems.length > 1) animateBannerTo((safeBannerIndex - 1 + bannerItems.length) % bannerItems.length);
                          }
                        }}
                        onPointerDown={handleBannerPointerDown}
                        onPointerMove={handleBannerPointerMove}
                        onPointerUp={event => handleBannerPointerEnd(event)}
                        onPointerCancel={event => handleBannerPointerEnd(event, true)}
                      >
                        <span className="sm-market-action-banner-icon" data-tone={banner.tone} aria-hidden>
                          {!banner.meta ? (
                            <SystemSymbol name="info.circle" size={22} />
                          ) : banner.serviceName ? (
                            <ServiceLogo
                              serviceSlug={banner.serviceSlug}
                              serviceName={banner.serviceName}
                              size={32}
                            />
                          ) : (
                            <BannerIcon icon={banner.icon} />
                          )}
                        </span>
                        <span className="sm-market-action-banner-copy">
                          <strong>{banner.title}</strong>
                          <small>
                            <span className="sm-market-action-banner-detail-main">{banner.detail}</span>
                            {banner.detailNote ? <span className="sm-market-action-banner-detail-note">{banner.detailNote}</span> : null}
                          </small>
                        </span>
                        {banner.meta ? (
                          <span className="sm-market-action-banner-meta">
                            <span data-tone={banner.tone} data-status={banner.id}>
                              <span>{banner.meta}</span>
                            </span>
                          </span>
                        ) : null}
                        {!banner.meta ? (
                          <span className="sm-market-action-banner-indicator sm-market-action-banner-service-indicator" aria-hidden="true">
                            {banner.serviceName ? (
                              <ServiceLogo
                                serviceSlug={banner.serviceSlug}
                                serviceName={banner.serviceName}
                                size={32}
                              />
                            ) : (
                              <SystemSymbol name="info.circle" size={20} />
                            )}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
              {bannerItems.length > 1 ? (
                <div
                  className={`sm-market-action-banner-dots sm-market-action-banner-notification-dots sm-market-action-banner-dots-count-${Math.min(bannerItems.length, 5)}`}
                  ref={bannerDotsRef}
                  role="group"
                  aria-label={`Уведомления, слайд ${safeBannerIndex + 1} из ${bannerItems.length}`}
                >
                  {bannerItems.map((banner, index) => (
                    <button
                      key={banner.id}
                      type="button"
                      className={index === safeBannerIndex ? "is-active" : undefined}
                      aria-label={`Показать уведомление: ${banner.title}`}
                      aria-current={index === safeBannerIndex ? "page" : undefined}
                      onClick={() => animateBannerTo(index)}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
          {menuVariant === "ios27" ? (
            <Ios27CategoryMenu
              onOpenFamilyCatalog={onOpenFamilyCatalog}
              onOpenGigabytes={onOpenGigabytes}
              onOpenAccounts={onOpenAccounts}
            />
          ) : (
            <section className="sm-market-service-grid sm-market-category-hub" aria-label="Категории">
              <CategoryIconGradientDefs />
              <div className="sm-market-category-heading">
                <div>
                  <span>Каталог</span>
                  <strong>Выберите направление</strong>
                </div>
                <small>4 раздела</small>
              </div>
              <div className="sm-market-category-family-group">
                <div className="sm-market-category-family-heading">
                  <span className="sm-market-category-family-icon" aria-hidden>
                    <SystemSymbol name="person.2.badge.plus" size={22} />
                  </span>
                  <span className="sm-market-category-family-copy">
                    <small>Семьи</small>
                    <strong>Тарифы и подписки</strong>
                  </span>
                  <span className="sm-market-category-family-count">2 раздела</span>
                </div>
                <div className="sm-market-category-family-actions">
                  <MarketTile
                    category="tariff"
                    title="Семейные тарифы"
                    subtitle="SIM и связь"
                    ariaLabel="Семейные тарифы"
                    icon={<SystemSymbol name="antenna.radiowaves.left.and.right" />}
                    testId="family-type-tariff"
                    onClick={() => onOpenFamilyCatalog("tariff")}
                  />
                  <MarketTile
                    category="subscription"
                    title="Семейные подписки"
                    subtitle="Сервисы"
                    ariaLabel="Семейные подписки"
                    icon={<SystemSymbol name="person.2" />}
                    testId="family-type-subscription"
                    onClick={() => onOpenFamilyCatalog("subscription")}
                  />
                </div>
              </div>
              <div className="sm-market-category-direct-actions">
                <MarketTile
                  category="gigabytes"
                  title="Гигабайты"
                  subtitle="Интернет"
                  icon={<SystemSymbol name="globe" />}
                  testId="market-buy-gigabytes"
                  onClick={() => onOpenGigabytes()}
                />
                <MarketTile
                  category="accounts"
                  title="Аккаунты"
                  subtitle="Доступы"
                  icon={<SystemSymbol name="key" />}
                  testId="market-buy-accounts"
                  onClick={() => onOpenAccounts()}
                />
              </div>
            </section>
          )}
        </>
      ) : null}

      <section className="sm-market-family-section" aria-label={isSearching ? "Результаты поиска" : isCatalog ? catalogSectionTitle : "Популярные предложения"}>
          <div className={`sm-market-section-heading${isCatalog ? " sm-market-section-heading-catalog" : ""}`}>
          <div className="sm-market-section-heading-copy">
            <h2>{isSearching ? "Результаты поиска" : isCatalog ? catalogSectionTitle : "Популярное сейчас"}</h2>
          </div>
          <div className="sm-market-filter-actions" ref={filterMenuRef}>
          {!isCatalog && !isSearching ? (
            <button
              type="button"
              data-testid="market-filter-button"
              className={`sm-market-filter-chip${marketFilter !== "all" ? " is-active" : ""}`}
              aria-label={`Фильтр объявлений: ${activeMarketFilter.label}`}
              title="Сменить тип объявлений"
              onClick={cycleMarketFilter}
            >
              <SystemSymbol name="sort" size={14} />
              <span data-testid="market-filter-label">{activeMarketFilter.label}</span>
            </button>
          ) : null}
          {isCatalog ? (
            <button
              type="button"
              data-testid="market-category-filter-button"
              className={`sm-market-filter-chip${effectiveCatalogFilter !== "all" ? " is-active" : ""}`}
              aria-haspopup="menu"
              aria-expanded={openFilterMenu === "catalog"}
              aria-controls="market-category-filter-menu"
              aria-label={`Фильтр каталога: ${activeCatalogFilter.label}`}
              title="Выбрать категорию"
              onClick={() => toggleFilterMenu("catalog")}
            >
              <SystemSymbol name="sort" size={14} />
              <span data-testid="market-category-filter-label">{activeCatalogFilter.label}</span>
            </button>
          ) : null}
          {showPriceSort ? (
            <button
              type="button"
              data-testid="market-price-sort-button"
              className={`sm-market-filter-chip${priceSort !== "fast" ? " is-active" : ""}`}
              aria-haspopup="menu"
              aria-expanded={openFilterMenu === "price"}
              aria-controls="market-price-sort-menu"
              aria-label={`Сортировка: ${activePriceSort.label}`}
              title="Выбрать сортировку"
              onClick={() => toggleFilterMenu("price")}
            >
              <SystemSymbol name="round-sort-vertical" size={14} className="sm-market-filter-icon-price" />
              <span data-testid="market-price-sort-label">{activePriceSort.label}</span>
            </button>
          ) : null}
          {openFilterMenu === "catalog" ? (
            <FilterMenu
              id="market-category-filter-menu"
              label={familyType === "tariff" ? "Оператор" : "Категория сервиса"}
              options={catalogFilterMenuOptions}
              selectedValue={effectiveCatalogFilter}
              testIdPrefix="market-category-option"
              onSelect={value => { setCatalogFilter(value as CatalogFilter); setOpenFilterMenu(null); }}
            />
          ) : null}
          {openFilterMenu === "price" ? (
            <FilterMenu
              id="market-price-sort-menu"
              label="Порядок объявлений"
              options={priceSortOptions}
              selectedValue={priceSort}
              testIdPrefix="market-price-option"
              onSelect={value => { setPriceSort(value as PriceSort); setOpenFilterMenu(null); }}
            />
          ) : null}
          </div>
        </div>
        {isCatalog ? (
          <div
            className="sm-market-catalog-swipe-viewport"
            ref={catalogViewportRef}
            role="group"
            aria-label="Каталоги подписок и тарифов"
            onPointerDown={handleCatalogPointerDown}
            onPointerMove={handleCatalogPointerMove}
            onPointerUp={event => handleCatalogPointerEnd(event)}
            onPointerCancel={event => handleCatalogPointerEnd(event, true)}
            onClickCapture={event => {
              if (!catalogWasSwiped.current) return;
              event.preventDefault();
              event.stopPropagation();
              catalogWasSwiped.current = false;
            }}
          >
            <div
              className="sm-market-catalog-swipe-track"
              ref={catalogTrackRef}
              style={{ transform: `translate3d(${-catalogPositionRef.current * 50}%, 0, 0)` }}
            >
              {(["subscription", "tariff"] as const).map(paneType => (
                <div
                  key={paneType}
                  className="sm-market-catalog-swipe-pane"
                  aria-hidden={paneType !== familyType}
                  data-catalog-type={paneType}
                >
                  <CatalogResultsPane
                    displayed={catalogDisplayedByType[paneType]}
                    isActive={paneType === familyType}
                    isLoading={Boolean(familyLoading?.[paneType] ?? (paneType === familyType && isLoading))}
                    error={paneType === familyType ? error : undefined}
                    isSearching={isSearching}
                    emptyTitle={paneType === "tariff" ? "Доступных тарифов пока нет" : "Доступных подписок пока нет"}
                    pending={pending}
                    joined={joined}
                    showTestIds={paneType === familyType}
                    hasMoreFamilies={paneType === familyType && Boolean(hasMoreFamilies)}
                    isLoadingMoreFamilies={Boolean(isLoadingMoreFamilies)}
                    onRefresh={onRefresh}
                    onResetSearch={() => setSearchTerm("")}
                    onCreateFamily={() => onCreateFamily(paneType)}
                    onLoadMoreFamilies={onLoadMoreFamilies}
                    onOpenFamily={onOpenFamily}
                    onOpenGigabytes={onOpenGigabytes}
                    onOpenAccounts={onOpenAccounts}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="sm-market-empty" role="alert"><h3>Не удалось загрузить предложения</h3><p>{error}</p><button className="sm-market-button sm-market-button-secondary" type="button" onClick={onRefresh}>Повторить</button></div>
        ) : isLoading && displayed.length === 0 ? (
          <div className="sm-market-family-list" aria-label="Загружаем предложения" role="status">
            {[0, 1, 2].map(n => <div key={n} className="sm-listing-skeleton" aria-hidden><span /><div /><span /></div>)}
          </div>
        ) : displayed.length === 0 ? (
          <div className="sm-market-empty" data-testid="market-empty-state">
            <SystemSymbol name="magnifyingglass" size={28} />
            <h3>{isSearching ? "Ничего не найдено" : "Предложений пока нет"}</h3>
            <p>{isSearching ? "Попробуйте другое название сервиса или оператора." : "Можно создать своё предложение или вернуться позже."}</p>
            <div className="sm-market-empty-actions">
              <button type="button" className="sm-market-button sm-market-button-secondary" onClick={() => isSearching ? setSearchTerm("") : onRefresh?.()}>{isSearching ? "Сбросить поиск" : "Обновить"}</button>
            </div>
          </div>
        ) : (
          <div className="sm-market-family-list">
            {displayed.map(offer => {
              if (offer.kind === "family") {
                const f = offer.item;
                const status = pending.has(f.id) ? "Заявка отправлена" : joined.has(f.id) ? "Вы в семье" : f.free_slots <= 0 ? "Мест нет" : null;
                return <FamilyListingCard key={f.id} family={f} status={status} onClick={() => onOpenFamily(f.id)} />;
              }
              if (offer.kind === "gigabytes") return <GigabytesListingCard key={offer.item.id} listing={offer.item} testId="market-popular-gigabytes" onClick={() => onOpenGigabytes(offer.item.id)} />;
              return <AccountListingCard key={offer.item.id} listing={offer.item} testId="market-popular-account" onClick={() => onOpenAccounts(offer.item.id)} />;
            })}
          </div>
        )}
        {!isCatalog && hasMoreFamilies ? <button className="sm-market-button sm-market-button-secondary sm-market-button-full" type="button" disabled={isLoadingMoreFamilies} onClick={onLoadMoreFamilies}>{isLoadingMoreFamilies ? "Загружаем…" : "Показать ещё"}</button> : null}
      </section>
    </div>
  );
}

function FilterMenu({
  id,
  label,
  options,
  selectedValue,
  testIdPrefix,
  onSelect
}: {
  id: string;
  label: string;
  options: FilterMenuOption[];
  selectedValue: string;
  testIdPrefix: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div id={id} className="sm-market-filter-menu" role="menu" aria-label={label}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="menuitemradio"
          aria-checked={option.value === selectedValue}
          data-testid={`${testIdPrefix}-${option.value}`}
          disabled={option.disabled}
          onClick={() => { triggerTelegramSelection(); onSelect(option.value); }}
        >
          <span className="sm-market-filter-menu-label">{option.label}</span>
          {typeof option.count === "number" ? <span className="sm-market-filter-menu-count">{option.count}</span> : null}
          {option.value === selectedValue ? <SystemSymbol name="checkmark" size={16} /> : null}
        </button>
      ))}
    </div>
  );
}

function CatalogResultsPane({
  displayed,
  isActive,
  isLoading,
  error,
  isSearching,
  emptyTitle,
  pending,
  joined,
  showTestIds,
  hasMoreFamilies,
  isLoadingMoreFamilies,
  onRefresh,
  onResetSearch,
  onCreateFamily,
  onLoadMoreFamilies,
  onOpenFamily,
  onOpenGigabytes,
  onOpenAccounts
}: {
  displayed: Offer[];
  isActive: boolean;
  isLoading: boolean;
  error?: string;
  isSearching: boolean;
  emptyTitle: string;
  pending: Set<string>;
  joined: Set<string>;
  showTestIds: boolean;
  hasMoreFamilies: boolean;
  isLoadingMoreFamilies: boolean;
  onRefresh?: () => void;
  onResetSearch: () => void;
  onCreateFamily: () => void;
  onLoadMoreFamilies?: () => void;
  onOpenFamily: (id: string) => void;
  onOpenGigabytes: (id?: string) => void;
  onOpenAccounts: (id?: string) => void;
}) {
  return (
    <div className="sm-market-catalog-results" aria-live={isActive ? "polite" : undefined}>
      {error ? (
        <div className="sm-market-empty" role="alert"><h3>Не удалось загрузить предложения</h3><p>{error}</p><button className="sm-market-button sm-market-button-secondary" type="button" onClick={onRefresh}>Повторить</button></div>
      ) : isLoading && displayed.length === 0 ? (
        <div className="sm-market-family-list" aria-label="Загружаем предложения" role="status">
          {[0, 1, 2].map(n => <div key={n} className="sm-listing-skeleton" aria-hidden><span /><div /><span /></div>)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="sm-market-empty" data-testid={showTestIds ? "market-empty-state" : undefined}>
          <SystemSymbol name="magnifyingglass" size={28} />
          <h3>{isSearching ? "Ничего не найдено" : emptyTitle}</h3>
          <p>{isSearching ? "Попробуйте другое название сервиса или оператора." : "Можно создать свою семью или вернуться позже."}</p>
          <div className="sm-market-empty-actions">
            <button type="button" className="sm-market-button sm-market-button-secondary" onClick={() => isSearching ? onResetSearch() : onRefresh?.()}>{isSearching ? "Сбросить поиск" : "Обновить"}</button>
            {!isSearching ? <button type="button" data-testid={showTestIds ? "empty-create-family-button" : undefined} className="sm-market-button sm-market-button-primary" onClick={onCreateFamily}>Создать семью</button> : null}
          </div>
        </div>
      ) : (
        <div className="sm-market-family-list">
          {displayed.map(offer => {
            if (offer.kind === "family") {
              const f = offer.item;
              const status = pending.has(f.id) ? "Заявка отправлена" : joined.has(f.id) ? "Вы в семье" : f.free_slots <= 0 ? "Мест нет" : null;
              return <FamilyListingCard key={f.id} family={f} status={status} onClick={() => onOpenFamily(f.id)} />;
            }
            if (offer.kind === "gigabytes") return <GigabytesListingCard key={offer.item.id} listing={offer.item} testId={showTestIds ? "market-popular-gigabytes" : undefined} onClick={() => onOpenGigabytes(offer.item.id)} />;
            return <AccountListingCard key={offer.item.id} listing={offer.item} testId={showTestIds ? "market-popular-account" : undefined} onClick={() => onOpenAccounts(offer.item.id)} />;
          })}
        </div>
      )}
      {hasMoreFamilies ? <button className="sm-market-button sm-market-button-secondary sm-market-button-full" type="button" disabled={isLoadingMoreFamilies} onClick={onLoadMoreFamilies}>{isLoadingMoreFamilies ? "Загружаем…" : "Показать ещё"}</button> : null}
    </div>
  );
}

function familyLabel(family: MyFamily["family"]) {
  return [family.service_name, family.service_variant ?? family.plan_name].filter(Boolean).join(" · ");
}

function formatKzt(value: number) {
  return `${value.toLocaleString("ru-KZ")} ₸`;
}

function pluralRu(value: number, one: string, few: string, many: string) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function BannerIcon({ icon }: { icon: MarketBanner["icon"] }) {
  const props = { size: 22, strokeWidth: 1.9 };
  if (icon === "alert") return <SystemSymbol name="exclamationmark.circle" {...props} />;
  if (icon === "clock") return <SystemSymbol name="clock" {...props} />;
  if (icon === "shield") return <SystemSymbol name="checkmark.shield" {...props} />;
  if (icon === "payment") return <SystemSymbol name="checkmark.circle" {...props} />;
  if (icon === "request") return <SystemSymbol name="person.2.badge.plus" {...props} />;
  if (icon === "message") return <SystemSymbol name="message" {...props} />;
  return <SystemSymbol name="paperplane" {...props} />;
}

function CategoryIconGradientDefs() {
  return (
    <svg aria-hidden="true" className="sm-category-icon-defs" focusable="false">
      <defs>
        <linearGradient id="sm-category-icon-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--app-category-icon-gradient-start)" />
          <stop offset="52%" stopColor="var(--app-category-icon-gradient-mid)" />
          <stop offset="100%" stopColor="var(--app-category-icon-gradient-end)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconButton({ label, testId, onClick, children }: { label: string; testId?: string; onClick: () => void; children: ReactNode }) {
  return <button aria-label={label} data-testid={testId} className="sm-market-icon-button" type="button" onClick={onClick}>{children}</button>;
}

function MarketTile({ category, title, subtitle, ariaLabel, icon, onClick, testId }: { category: "tariff" | "subscription" | "gigabytes" | "accounts"; title: string; subtitle?: string; ariaLabel?: string; icon: ReactNode; onClick: () => void; testId: string }) {
  return (
    <button className={`sm-market-service-tile sm-market-service-tile-${category}`} type="button" aria-label={ariaLabel} data-testid={testId} onClick={() => { triggerTelegramSelection(); onClick(); }}>
      <span className="sm-market-service-icon" aria-hidden>{icon}</span>
      <span className="sm-market-service-copy">
        <strong>{title}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
      <span className="sm-market-service-chevron" aria-hidden>›</span>
    </button>
  );
}
