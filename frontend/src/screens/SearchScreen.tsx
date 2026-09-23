import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { formatDate } from "../format";
import { triggerTelegramSelection } from "../telegram";
import type { AccountListing, Family, FamilyRequest, FamilyType, MarketplaceListing, MyFamily } from "../types";
import {
  FIRST_RUN_BANNER_KEY,
  MAX_MARKET_BANNERS,
  marketFilterOptions,
  priceSortOptions,
  subscriptionCategoryOptions,
  tariffOperatorOptions,
  type Offer,
  type MarketFilter,
  type PriceSort,
  type CatalogFilter,
  type FilterMenuOption,
  type MarketBanner,
  type ScreenPulse,
  type ScreenPulseHandle,
  type MarketViewState,
  readMarketViewState,
  writeMarketViewState,
  clearMarketViewState,
  offerPrice,
  offerResponsePriority,
  offerCreatedAt,
  matchesCatalogFilter,
  familyLabel,
  formatKzt,
  pluralRu,
  DEV_BANNER_ITEMS,
  MarketHomeView,
  MarketCatalogView
} from "../components/market";
import { useTypingPlaceholder } from "../hooks/useTypingPlaceholder";

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
  onOpenActions?: (targetTab?: "inbox" | "outbox") => void;
  onOpenGigabytes: (id?: string) => void;
  onOpenAccounts: (id?: string) => void;
};

export function SearchScreen({
  view = "market",
  userName,
  firstName,
  familyType,
  filteredFamilies,
  subscriptionFamilies,
  tariffFamilies,
  marketplaceListings,
  accountListings,
  familyLoading,
  myFamilies,
  myRequests,
  isLoading = false,
  error,
  hasMoreFamilies,
  isLoadingMoreFamilies,
  onOpenFamilyCatalog,
  onBack,
  onRefresh,
  onLoadMoreFamilies,
  onOpenFamily,
  onOpenInvite,
  onCreateFamily,
  resetToken,
  pendingActionsCount = 0,
  marketplaceSalesActionCount = 0,
  marketplacePurchaseActionCount = 0,
  accountSalesActionCount = 0,
  accountPurchaseActionCount = 0,
  onOpenMine,
  onOpenActions,
  onOpenGigabytes,
  onOpenAccounts
}: Props) {
  const [savedMarketViewState] = useState<MarketViewState | null>(
    () => (view === "market" ? readMarketViewState() : null)
  );
  const [searchTerm, setSearchTerm] = useState(savedMarketViewState?.searchTerm ?? "");
  const [marketFilter, setMarketFilter] = useState<MarketFilter>(savedMarketViewState?.marketFilter ?? "all");
  const [priceSort, setPriceSort] = useState<PriceSort>("fast");
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>("all");
  const [menuVariant] = useState<"classic" | "ios27">(() => {
    const param = new URLSearchParams(window.location.search).get("menu");
    if (param === "ios27") return "ios27";
    if (param === "classic") return "classic";
    return localStorage.getItem("subsmarket.menuVariant") === "classic" ? "classic" : "ios27";
  });
  const [showIntro, setShowIntro] = useState(() => localStorage.getItem(FIRST_RUN_BANNER_KEY) !== "true");

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const screenPulseRef = useRef<ScreenPulseHandle | null>(null);
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

  const isCatalog = view === "family-catalog";
  const term = searchTerm.trim().toLocaleLowerCase("ru-RU");
  const isInvite = /^\d{8}$/.test(term);
  const isSearching = Boolean(term) && !isInvite;
  const isHome = !isCatalog && !isSearching;

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

  const isInitialMarketFilterRef = useRef(true);
  useLayoutEffect(() => {
    if (isInitialMarketFilterRef.current) {
      isInitialMarketFilterRef.current = false;
      return;
    }
    if (view === "market" && marketScrollRef.current) {
      marketScrollRef.current.scrollTop = 0;
    }
  }, [marketFilter, view]);

  function updateMarketFilter(value: MarketFilter) {
    marketFilterRef.current = value;
    setMarketFilter(value);
    persistMarketViewState({ marketFilter: value, scrollTop: 0 });
    if (marketScrollRef.current) {
      marketScrollRef.current.scrollTop = 0;
    }
  }

  function cycleMarketFilter() {
    triggerTelegramSelection();
    const currentIndex = marketFilterOptions.findIndex(option => option.value === marketFilterRef.current);
    const nextIndex = (currentIndex + 1) % marketFilterOptions.length;
    updateMarketFilter(marketFilterOptions[nextIndex].value);
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
    const shouldClearSavedState =
      previous.resetToken !== resetToken || (view === "market" && previous.familyType !== familyType);
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
    if (marketScrollRef.current) {
      marketScrollRef.current.style.paddingBottom = "";
      marketScrollRef.current.scrollTo({ top: 0, behavior: "auto" });
    }
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

  const showPriceSort = isCatalog || isSearching;
  useTypingPlaceholder(searchInputRef, view === "market" && searchTerm.length === 0, "Сервис, оператор или аккаунт");

  useEffect(() => {
    if (!isCatalog) setCatalogFilter("all");
    if (!isSearching || isCatalog) setPriceSort("fast");
  }, [familyType, isCatalog, isSearching]);

  const matches = (...values: (string | null | undefined)[]) =>
    !isSearching || values.filter(Boolean).join(" ").toLocaleLowerCase("ru-RU").includes(term);

  const joined = new Set(myFamilies.map(item => item.family.id));
  const pending = new Set(myRequests.filter(item => item.status === "pending").map(item => item.family_id));
  const catalogTitle = familyType === "tariff" ? "Семейные тарифы" : "Семейные подписки";
  const catalogSectionTitle = "Доступные";
  const catalogSearchPlaceholder = familyType === "tariff" ? "Оператор или тариф" : "Сервис или подписка";

  const activeMarketFilterIndex = marketFilterOptions.findIndex(option => option.value === marketFilter);
  const activeMarketFilter = marketFilterOptions[activeMarketFilterIndex] ?? marketFilterOptions[0];
  const activePriceSortIndex = priceSortOptions.findIndex(option => option.value === priceSort);
  const activePriceSort = priceSortOptions[activePriceSortIndex] ?? priceSortOptions[0];
  const catalogFilterOptions = familyType === "tariff" ? tariffOperatorOptions : subscriptionCategoryOptions;
  const activeCatalogFilterIndex = catalogFilterOptions.findIndex(option => option.value === catalogFilter);
  const activeCatalogFilter = catalogFilterOptions[activeCatalogFilterIndex] ?? catalogFilterOptions[0];
  const effectiveCatalogFilter = activeCatalogFilter.value;

  const approvedFamilyRequests = useMemo(
    () =>
      myRequests.filter(request => {
        if (request.status !== "approved") return false;
        const memberItem = myFamilies.find(item => item.family.id === request.family_id);
        if (memberItem && memberItem.membership.status !== "awaiting_access") {
          return false;
        }
        return true;
      }),
    [myFamilies, myRequests]
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
    : allOffers.filter(
        offer =>
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
    if (offer.kind === "gigabytes") {
      return matches(offer.item.operator.name, "Гигабайты", offer.item.description, offer.item.owner.avatar_name);
    }
    return matches(offer.item.title, offer.item.service.name, offer.item.description, offer.item.owner.avatar_name);
  });

  const categoryVisible =
    isCatalog && effectiveCatalogFilter !== "all"
      ? visible.filter(offer => matchesCatalogFilter(offer, effectiveCatalogFilter, familyType))
      : visible;

  const catalogFilterMenuOptions: FilterMenuOption[] = catalogFilterOptions.map(option => {
    const count =
      option.value === "all"
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
        if (priceSort === "recent") {
          return offerCreatedAt(right) - offerCreatedAt(left);
        }
        if (priceSort === "asc") {
          return offerPrice(left) - offerPrice(right);
        }
        return 0;
      })
    : categoryVisible;

  const displayed =
    isCatalog || isSearching
      ? sortedVisible
      : sortedVisible
          .filter(offer =>
            offer.kind === "family"
              ? offer.item.status === "active" && offer.item.free_slots > 0
              : offer.item.status === "active"
          )
          .slice(0, 8);

  const catalogDisplayedByType = useMemo<Record<FamilyType, Offer[]>>(() => {
    const buildAdjacentCatalog = (type: FamilyType) => {
      if (type === familyType) return displayed;
      const source = type === "tariff" ? tariffFamilies : subscriptionFamilies;
      const adjacentVisible = source
        .map(item => ({ kind: "family" as const, item }))
        .filter(offer => {
          const f = offer.item;
          return (
            !isSearching ||
            [f.service_name, f.service_variant, f.plan_name, f.owner.avatar_name]
              .filter(Boolean)
              .join(" ")
              .toLocaleLowerCase("ru-RU")
              .includes(term)
          );
        });
      return [...adjacentVisible].sort((left, right) => {
        if (priceSort === "fast") return offerResponsePriority(right) - offerResponsePriority(left);
        if (priceSort === "recent") return offerCreatedAt(right) - offerCreatedAt(left);
        if (priceSort === "asc") return offerPrice(left) - offerPrice(right);
        return 0;
      });
    };

    return {
      subscription: buildAdjacentCatalog("subscription"),
      tariff: buildAdjacentCatalog("tariff")
    };
  }, [displayed, familyType, isSearching, priceSort, subscriptionFamilies, tariffFamilies, term]);

  const catalogSectionCount = catalogDisplayedByType[familyType].length;

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
    const accessWaiting = myFamilies.filter(
      item =>
        item.membership.status === "awaiting_access" &&
        !approvedFamilyRequests.some(request => request.family_id === item.family.id)
    );
    const openPayments = myFamilies.flatMap(item =>
      item.payments
        .filter(payment => ["due", "overdue"].includes(payment.status))
        .map(payment => ({ family: item.family, payment }))
    );
    const reportedPayments = myFamilies.flatMap(item =>
      item.payments
        .filter(payment => payment.status === "payment_reported")
        .map(payment => ({ family: item.family, payment }))
    );
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
        detailNote: `${overduePayment ? "Требуется оплата" : "Срок оплаты"}${openPayments.length > 1 ? ` · ещё ${openPayments.length - 1}` : ""}`,
        meta: overduePayment ? "Важно" : "Срок",
        serviceName: duePayment.family.service_name,
        serviceSlug: duePayment.family.service_slug,
        icon: overduePayment ? "alert" : "clock",
        tone: overduePayment ? "danger" : "warning",
        pulse: overduePayment ? "error" : undefined,
        targetTab: "outbox"
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
        pulse: "notification",
        targetTab: "outbox"
      });
    }
    if (reportedPayments.length > 0) {
      const { family, payment } = reportedPayments[0];
      items.push({
        id: "payment-reported",
        priority: 2,
        title: "Оплата ждёт подтверждения",
        detail: `${familyLabel(family)} · ${formatKzt(payment.amount_kzt)}`,
        detailNote: `Ждём подтверждения${reportedPayments.length > 1 ? ` · ещё ${reportedPayments.length - 1}` : ""}`,
        meta: "Ожидает",
        serviceName: family.service_name,
        serviceSlug: family.service_slug,
        icon: "payment",
        tone: "info",
        pulse: "notification",
        targetTab: "inbox"
      });
    }
    if (ownerRequestCount > 0) {
      const family = myFamilies.find(item => item.pending_requests_count > 0)?.family;
      items.push({
        id: "owner-requests",
        priority: 1,
        title: ownerRequestCount === 1 ? "Новая заявка в семью" : "Новые заявки в семьи",
        detail: `${family ? familyLabel(family) + " · " : ""}${ownerRequestCount} ${pluralRu(ownerRequestCount, "заявка", "заявки", "заявок")} ждут ответа`,
        detailNote: "Нужен ваш ответ",
        meta: "Новая",
        serviceName: family?.service_name,
        serviceSlug: family?.service_slug,
        icon: "request",
        tone: "warning",
        pulse: "new-request",
        targetTab: "inbox"
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
        detailNote: "Напишите владельцу",
        meta: "Принято",
        serviceName: request.service_name,
        icon: "payment",
        tone: "success",
        pulse: "accepted",
        targetTab: "outbox"
      });
    }
    if (sellerActionCount > 0) {
      const details = [
        marketplaceSalesActionCount > 0 ? `Гигабайты: ${marketplaceSalesActionCount}` : null,
        accountSalesActionCount > 0 ? `Аккаунты: ${accountSalesActionCount}` : null
      ]
        .filter(Boolean)
        .join(" · ");
      items.push({
        id: "marketplace-sales",
        priority: 1,
        title: sellerActionCount === 1 ? "Заявка на объявление" : "Заявки на объявления",
        detail: details,
        detailNote: "Нужен ваш ответ",
        meta: "Новая",
        icon: "message",
        tone: "warning",
        pulse: "new-request",
        targetTab: "inbox"
      });
    }
    if (buyerActionCount > 0) {
      const details = [
        marketplacePurchaseActionCount > 0 ? `Гигабайты: ${marketplacePurchaseActionCount}` : null,
        accountPurchaseActionCount > 0 ? `Аккаунты: ${accountPurchaseActionCount}` : null
      ]
        .filter(Boolean)
        .join(" · ");
      items.push({
        id: "marketplace-purchases",
        priority: 3,
        title: buyerActionCount === 1 ? "Заявка принята" : "Заявки приняты",
        detail: details,
        detailNote: "Напишите продавцу",
        meta: "Принято",
        icon: "message",
        tone: "success",
        pulse: "accepted",
        targetTab: "outbox"
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
        detailNote: "На рассмотрении",
        meta: "Ждём ответа",
        serviceName: request.service_name,
        icon: "send",
        tone: "info",
        targetTab: "outbox"
      });
    }
    if (accessWaiting.length > 0) {
      const family = accessWaiting[0].family;
      items.push({
        id: "access-waiting",
        priority: 2,
        title: "Доступ ещё не выдан",
        detail: familyLabel(family),
        detailNote: `Ожидайте доступа${accessWaiting.length > 1 ? ` · ещё ${accessWaiting.length - 1}` : ""}`,
        meta: "Ожидает",
        serviceName: family.service_name,
        serviceSlug: family.service_slug,
        icon: "shield",
        tone: "info",
        targetTab: "outbox"
      });
    }
    if (import.meta.env.DEV) items.push(...DEV_BANNER_ITEMS);
    return items
      .map((item, index) => ({ item, index }))
      .sort((left, right) => left.item.priority - right.item.priority || left.index - right.index)
      .slice(0, MAX_MARKET_BANNERS)
      .map(({ item }) => item);
  }, [
    accountPurchaseActionCount,
    accountSalesActionCount,
    approvedFamilyRequests,
    marketplacePurchaseActionCount,
    marketplaceSalesActionCount,
    myFamilies,
    myRequests
  ]);

  const screenPulseBanner =
    bannerItems.find(item => item.pulse === "error") ??
    bannerItems.find(item => item.pulse === "accepted") ??
    bannerItems.find(item => item.pulse === "new-request") ??
    bannerItems.find(item => item.pulse);
  const screenPulseKind: NonNullable<MarketBanner["pulse"]> | undefined = error
    ? "error"
    : screenPulseBanner?.pulse;
  const screenPulseTone: MarketBanner["tone"] | undefined = error ? "danger" : screenPulseBanner?.tone;
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

  if (isHome) {
    return (
      <MarketHomeView
        userName={userName}
        firstName={firstName}
        searchTerm={searchTerm}
        onSearchTermChange={updateSearchTerm}
        isInvite={isInvite}
        onOpenInvite={onOpenInvite}
        searchInputRef={searchInputRef}
        scrollRef={marketScrollRef}
        onScroll={scheduleMarketScrollPersistence}
        showIntro={showIntro}
        onDismissIntro={() => {
          localStorage.setItem(FIRST_RUN_BANNER_KEY, "true");
          setShowIntro(false);
        }}
        pendingActionsCount={pendingActionsCount}
        bannerItems={bannerItems}
        menuVariant={menuVariant}
        marketFilter={marketFilter}
        activeMarketFilterLabel={activeMarketFilter.label}
        onCycleMarketFilter={cycleMarketFilter}
        displayed={displayed}
        isLoading={isLoading}
        error={error}
        pending={pending}
        joined={joined}
        hasMoreFamilies={hasMoreFamilies}
        isLoadingMoreFamilies={isLoadingMoreFamilies}
        onRefresh={onRefresh}
        onLoadMoreFamilies={onLoadMoreFamilies}
        onOpenFamily={onOpenFamily}
        onOpenFamilyCatalog={onOpenFamilyCatalog}
        onOpenGigabytes={onOpenGigabytes}
        onOpenAccounts={onOpenAccounts}
        onOpenMine={onOpenMine}
        onOpenActions={onOpenActions}
        resetToken={resetToken}
        screenPulseRef={screenPulseRef}
      />
    );
  }

  return (
    <MarketCatalogView
      userName={userName}
      firstName={firstName}
      familyType={familyType}
      isCatalog={isCatalog}
      isSearching={isSearching}
      searchTerm={searchTerm}
      onSearchTermChange={updateSearchTerm}
      isInvite={isInvite}
      onOpenInvite={onOpenInvite}
      searchInputRef={searchInputRef}
      scrollRef={marketScrollRef}
      onScroll={scheduleMarketScrollPersistence}
      onOpenFamilyCatalog={onOpenFamilyCatalog}
      catalogTitle={catalogTitle}
      catalogSectionTitle={catalogSectionTitle}
      catalogSearchPlaceholder={catalogSearchPlaceholder}
      catalogSectionCount={catalogSectionCount}
      hasMoreFamilies={hasMoreFamilies}
      isLoadingMoreFamilies={isLoadingMoreFamilies}
      catalogFilterMenuOptions={catalogFilterMenuOptions}
      effectiveCatalogFilter={effectiveCatalogFilter}
      onSelectCatalogFilter={setCatalogFilter}
      priceSort={priceSort}
      onSelectPriceSort={setPriceSort}
      activeCatalogFilter={activeCatalogFilter}
      activePriceSort={activePriceSort}
      showPriceSort={showPriceSort}
      catalogDisplayedByType={catalogDisplayedByType}
      familyLoading={familyLoading}
      isLoading={isLoading}
      error={error}
      displayed={displayed}
      pending={pending}
      joined={joined}
      onRefresh={onRefresh}
      onLoadMoreFamilies={onLoadMoreFamilies}
      onCreateFamily={onCreateFamily}
      onOpenFamily={onOpenFamily}
      onOpenGigabytes={onOpenGigabytes}
      onOpenAccounts={onOpenAccounts}
      onOpenMine={onOpenMine}
      screenPulseRef={screenPulseRef}
    />
  );
}
