import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import { AccountListingCard, FamilyListingCard, GigabytesListingCard } from "../ListingCard";
import { SystemSymbol } from "../SystemSymbol";
import { triggerTelegramSelection } from "../../telegram";
import type { FamilyType } from "../../types";
import {
  type CatalogFilter,
  type CatalogPointerState,
  type FilterMenuKey,
  type FilterMenuOption,
  type Offer,
  type PriceSort,
  type ScreenPulseHandle,
  priceSortOptions,
  ScreenEventPulse,
  CatalogResultsPane,
  FilterMenu
} from "./index";

export type MarketCatalogViewProps = {
  userName: string;
  firstName?: string;
  familyType: FamilyType;
  isCatalog: boolean;
  isSearching: boolean;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  isInvite: boolean;
  onOpenInvite: (code: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll?: (scrollTop: number) => void;
  onOpenFamilyCatalog: (type: FamilyType) => void;
  catalogTitle: string;
  catalogSectionTitle: string;
  catalogSearchPlaceholder: string;
  catalogSectionCount: number;
  hasMoreFamilies?: boolean;
  isLoadingMoreFamilies?: boolean;
  catalogFilterMenuOptions: FilterMenuOption[];
  effectiveCatalogFilter: CatalogFilter;
  onSelectCatalogFilter: (filter: CatalogFilter) => void;
  priceSort: PriceSort;
  onSelectPriceSort: (sort: PriceSort) => void;
  activeCatalogFilter: FilterMenuOption;
  activePriceSort: FilterMenuOption;
  showPriceSort: boolean;
  catalogDisplayedByType: Record<FamilyType, Offer[]>;
  familyLoading?: { subscription: boolean; tariff: boolean };
  isLoading?: boolean;
  error?: string;
  displayed: Offer[];
  pending: Set<string>;
  joined: Set<string>;
  onRefresh?: () => void;
  onLoadMoreFamilies?: () => void;
  onCreateFamily: (type: FamilyType) => void;
  onOpenFamily: (id: string) => void;
  onOpenGigabytes: (id?: string) => void;
  onOpenAccounts: (id?: string) => void;
  onOpenMine?: () => void;
  screenPulseRef: React.RefObject<ScreenPulseHandle | null>;
};

const CATALOG_SWIPE_GAP = 16;

export function MarketCatalogView({
  userName,
  firstName,
  familyType,
  isCatalog,
  isSearching,
  searchTerm,
  onSearchTermChange,
  isInvite,
  onOpenInvite,
  searchInputRef,
  scrollRef,
  onScroll,
  onOpenFamilyCatalog,
  catalogTitle,
  catalogSectionTitle,
  catalogSearchPlaceholder,
  catalogSectionCount,
  hasMoreFamilies,
  isLoadingMoreFamilies,
  catalogFilterMenuOptions,
  effectiveCatalogFilter,
  onSelectCatalogFilter,
  priceSort,
  onSelectPriceSort,
  activeCatalogFilter,
  activePriceSort,
  showPriceSort,
  catalogDisplayedByType,
  familyLoading,
  isLoading = false,
  error,
  displayed,
  pending,
  joined,
  onRefresh,
  onLoadMoreFamilies,
  onCreateFamily,
  onOpenFamily,
  onOpenGigabytes,
  onOpenAccounts,
  onOpenMine,
  screenPulseRef
}: MarketCatalogViewProps) {
  const [openFilterMenu, setOpenFilterMenu] = useState<FilterMenuKey | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);

  const catalogViewportRef = useRef<HTMLDivElement | null>(null);
  const catalogTrackRef = useRef<HTMLDivElement | null>(null);
  const catalogPositionRef = useRef(familyType === "tariff" ? 1 : 0);
  const catalogPointerRef = useRef<CatalogPointerState | null>(null);
  const catalogAnimationFrame = useRef<number | null>(null);
  const catalogAnimationTargetRef = useRef<number | null>(null);
  const familyTypeSwitchRef = useRef<HTMLElement | null>(null);
  const catalogWasSwiped = useRef(false);
  const wasCatalogRef = useRef(isCatalog);

  const isFeedDraggingRef = useRef(false);
  const snapTimeoutRef = useRef<number | null>(null);
  const feedTouchStartY = useRef<number | null>(null);
  const feedTouchStartX = useRef<number | null>(null);

  const term = searchTerm.trim().toLocaleLowerCase("ru-RU");

  // Outside click & Escape handlers for filter menus
  useEffect(() => {
    if (!openFilterMenu) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !filterMenuRef.current?.contains(target)) {
        setOpenFilterMenu(null);
      }
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

  // Feed padding calculation
  const updateFeedPadding = useCallback(() => {
    const updateElementPadding = (container: HTMLElement | null) => {
      if (!container) return;
      const cards = container.querySelectorAll<HTMLElement>(".sm-listing");
      if (cards.length === 0) {
        container.style.paddingBottom = "";
        return;
      }
      const firstCard = cards[0];
      const lastCard = cards[cards.length - 1];
      const totalContentHeight = (lastCard.offsetTop + lastCard.offsetHeight) - firstCard.offsetTop;
      if (cards.length <= 3) {
        if (totalContentHeight <= container.clientHeight - 76) {
          container.style.paddingBottom = "0px";
        } else {
          container.style.paddingBottom = "76px";
        }
        return;
      }
      const last3Card = cards[cards.length - 3];
      const last3Height = (lastCard.offsetTop + lastCard.offsetHeight) - last3Card.offsetTop;
      const diff = container.clientHeight - last3Height;
      const targetPadding = Math.max(76, diff);
      container.style.paddingBottom = `${Math.round(targetPadding)}px`;
    };

    if (isCatalog) {
      const panes = document.querySelectorAll<HTMLElement>(".sm-market-catalog-swipe-pane");
      if (panes.length > 0) {
        panes.forEach(pane => updateElementPadding(pane));
      } else {
        updateElementPadding(scrollRef.current);
      }
    } else {
      updateElementPadding(scrollRef.current);
    }
  }, [isCatalog, scrollRef]);

  const snapToNearestCard = useCallback(() => {
    const container = scrollRef.current;
    if (!container || isFeedDraggingRef.current) return;

    updateFeedPadding();

    const currentScrollTop = container.scrollTop;
    if (currentScrollTop > 0 && currentScrollTop < 35) {
      container.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const cards = container.querySelectorAll<HTMLElement>(".sm-listing");
    if (!cards.length) return;

    const maxSnapCardIndex = Math.max(0, cards.length - 3);
    let closestTargetScrollTop = currentScrollTop;
    let minDistance = Infinity;

    cards.forEach((card, index) => {
      if (cards.length >= 3 && index > maxSnapCardIndex) return;

      const cardRect = card.getBoundingClientRect();
      const distance = cardRect.top - containerRect.top;
      if (Math.abs(distance) < Math.abs(minDistance)) {
        minDistance = distance;
        closestTargetScrollTop = currentScrollTop + distance;
      }
    });

    if (Math.abs(minDistance) >= 2 && Math.abs(minDistance) < 120) {
      const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
      const target = Math.min(maxScrollTop, Math.max(0, Math.round(closestTargetScrollTop)));
      container.scrollTo({ top: target, behavior: "smooth" });
    }
  }, [scrollRef, updateFeedPadding]);

  useEffect(() => {
    return () => {
      if (snapTimeoutRef.current) {
        window.clearTimeout(snapTimeoutRef.current);
        snapTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    updateFeedPadding();
    const frame = requestAnimationFrame(() => {
      updateFeedPadding();
    });
    window.addEventListener("resize", updateFeedPadding);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateFeedPadding);
    };
  }, [displayed.length, familyType, updateFeedPadding]);

  // Touch and wheel handlers for feed snap
  const handleFeedTouchStart = (e: React.TouchEvent) => {
    isFeedDraggingRef.current = true;
    if (snapTimeoutRef.current) {
      window.clearTimeout(snapTimeoutRef.current);
      snapTimeoutRef.current = null;
    }
    feedTouchStartY.current = e.touches[0].clientY;
    feedTouchStartX.current = e.touches[0].clientX;
  };

  const handleFeedTouchMove = () => {
    // Just tracks dragging for catalog/search feed
  };

  const handleFeedTouchEnd = () => {
    feedTouchStartY.current = null;
    feedTouchStartX.current = null;
    isFeedDraggingRef.current = false;
    if (snapTimeoutRef.current) {
      window.clearTimeout(snapTimeoutRef.current);
    }
    snapTimeoutRef.current = window.setTimeout(snapToNearestCard, 140);
  };

  const handleFeedWheel = () => {
    if (snapTimeoutRef.current) {
      window.clearTimeout(snapTimeoutRef.current);
    }
    snapTimeoutRef.current = window.setTimeout(snapToNearestCard, 150);
  };

  // Catalog swiper logic
  function setCatalogPosition(position: number) {
    catalogPositionRef.current = position;
    const track = catalogTrackRef.current;
    if (track) {
      const width = catalogViewportRef.current?.clientWidth || 0;
      if (width > 0) {
        track.style.transform = `translate3d(${-position * (width + CATALOG_SWIPE_GAP)}px, 0, 0)`;
      } else {
        track.style.transform = `translate3d(calc(${-position * 50}% - ${position * 8}px), 0, 0)`;
      }
    }
    const switchEl = familyTypeSwitchRef.current || document.querySelector<HTMLElement>(".sm-market-family-type-switch");
    const clampedPosition = Math.min(Math.max(position, 0), 1);
    switchEl?.style.setProperty("--catalog-type-position", String(clampedPosition));
  }

  function stopCatalogAnimation() {
    if (catalogAnimationFrame.current !== null) {
      cancelAnimationFrame(catalogAnimationFrame.current);
      catalogAnimationFrame.current = null;
    }
    catalogTrackRef.current?.classList.remove("is-swiping");
  }

  function animateCatalogTo(
    nextPosition: number,
    initialVelocity = 0,
    interaction: "gesture" | "click" = "gesture"
  ) {
    const target = Math.min(Math.max(nextPosition, 0), 1);
    stopCatalogAnimation();
    catalogAnimationTargetRef.current = target;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCatalogPosition(target);
      catalogAnimationTargetRef.current = null;
      catalogTrackRef.current?.classList.remove("is-swiping");
      return;
    }

    let position = catalogPositionRef.current;
    if (Math.abs(target - position) < 0.001 && Math.abs(initialVelocity) < 0.01) {
      setCatalogPosition(target);
      catalogAnimationTargetRef.current = null;
      catalogTrackRef.current?.classList.remove("is-swiping");
      return;
    }

    catalogTrackRef.current?.classList.add("is-swiping");
    let velocity = Math.max(-4, Math.min(4, initialVelocity));
    const stiffness = 260;
    const damping = 32;
    let previousTime = performance.now();
    const step = (time: number) => {
      const deltaTime = Math.min((time - previousTime) / 1000, 0.032);
      previousTime = time;
      const acceleration = (target - position) * stiffness - velocity * damping;
      velocity += acceleration * deltaTime;
      position += velocity * deltaTime;
      setCatalogPosition(position);

      if (Math.abs(target - position) < 0.001 && Math.abs(velocity) < 0.01) {
        setCatalogPosition(target);
        catalogAnimationTargetRef.current = null;
        catalogAnimationFrame.current = null;
        catalogTrackRef.current?.classList.remove("is-swiping");
        return;
      }
      catalogAnimationFrame.current = requestAnimationFrame(step);
    };
    catalogAnimationFrame.current = requestAnimationFrame(step);
  }

  function handleCatalogPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    stopCatalogAnimation();
    catalogAnimationTargetRef.current = null;
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
  }

  function handleCatalogPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const pointer = catalogPointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId || pointer.cancelled) return;
    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    if (!pointer.isDragging) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (absX < 8 && absY < 8) return;

      if (absY >= 14 && absY > absX * 1.4) {
        pointer.cancelled = true;
        catalogPointerRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        catalogTrackRef.current?.classList.remove("is-swiping");
        const target = familyType === "tariff" ? 1 : 0;
        animateCatalogTo(target, 0, "gesture");
        return;
      }
      if (absX >= 8 && absX * 1.4 >= absY) {
        pointer.isDragging = true;
        catalogWasSwiped.current = true;
        catalogTrackRef.current?.classList.add("is-swiping");
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {}
      } else {
        return;
      }
    }

    const now = performance.now();
    const elapsed = Math.max(1, now - pointer.lastTime);
    pointer.velocityX = ((event.clientX - pointer.lastX) / elapsed) * 1000;
    pointer.lastX = event.clientX;
    pointer.lastTime = now;
    const width = catalogViewportRef.current?.clientWidth || 1;
    const stepSize = width + CATALOG_SWIPE_GAP;
    const rawPosition = pointer.originPosition - deltaX / stepSize;
    const position = rawPosition < 0
      ? rawPosition * 0.25
      : rawPosition > 1
        ? 1 + (rawPosition - 1) * 0.25
        : rawPosition;
    setCatalogPosition(position);
  }

  function handleCatalogPointerEnd(event: ReactPointerEvent<HTMLElement>, cancelled = false) {
    const pointer = catalogPointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    catalogPointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const defaultTarget = familyType === "tariff" ? 1 : 0;
    if (pointer.cancelled || cancelled || !pointer.isDragging) {
      catalogTrackRef.current?.classList.remove("is-swiping");
      animateCatalogTo(defaultTarget, 0, "gesture");
      return;
    }

    const deltaX = event.clientX - pointer.startX;
    const width = catalogViewportRef.current?.clientWidth || 1;
    const stepSize = width + CATALOG_SWIPE_GAP;
    const passedDistance = Math.abs(deltaX) >= width * 0.18;
    const passedVelocity = Math.abs(pointer.velocityX) >= 450;
    let target = Math.round(catalogPositionRef.current);
    if (passedDistance || passedVelocity) {
      const direction = passedVelocity
        ? (pointer.velocityX < 0 ? 1 : -1)
        : (deltaX < 0 ? 1 : -1);
      target = Math.round(pointer.originPosition) + direction;
    }
    target = Math.min(Math.max(target, 0), 1);
    animateCatalogTo(target, -pointer.velocityX / stepSize, "gesture");

    const nextType: FamilyType = target === 1 ? "tariff" : "subscription";
    if (nextType !== familyType) {
      triggerTelegramSelection();
      onSelectCatalogFilter("all");
      onOpenFamilyCatalog(nextType);
    }
  }

  useEffect(() => () => {
    stopCatalogAnimation();
  }, []);

  useEffect(() => {
    const wasCatalog = wasCatalogRef.current;
    wasCatalogRef.current = isCatalog;
    if (!isCatalog) {
      catalogPositionRef.current = familyType === "tariff" ? 1 : 0;
      return;
    }
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    const target = familyType === "tariff" ? 1 : 0;
    if (!wasCatalog) {
      catalogPositionRef.current = target;
      setCatalogPosition(target);
      catalogAnimationTargetRef.current = null;
      stopCatalogAnimation();
      return;
    }
    if (catalogPointerRef.current) return;
    if (catalogAnimationTargetRef.current === target) return;
    if (Math.abs(catalogPositionRef.current - target) < 0.001) {
      setCatalogPosition(target);
      return;
    }
    animateCatalogTo(target, 0, "click");
  }, [familyType, isCatalog, scrollRef]);

  const toggleFilterMenu = (menu: FilterMenuKey) => {
    triggerTelegramSelection();
    setOpenFilterMenu(current => (current === menu ? null : menu));
  };

  const openInvite = () => {
    if (isInvite) onOpenInvite(term);
  };

  return (
    <div
      ref={isCatalog || isSearching ? undefined : scrollRef}
      onScroll={isCatalog || isSearching ? undefined : event => onScroll?.(event.currentTarget.scrollTop)}
      className={`sm-market-screen ${isCatalog || isSearching ? "sm-market-screen-catalog is-searching" : "subs-screen-scroll"}`}
      data-testid={isCatalog ? "family-catalog-screen" : "market-screen"}
    >
      <ScreenEventPulse ref={screenPulseRef} />
      {isCatalog ? (
        <header className="sm-market-catalog-header">
          <h1>{catalogTitle}</h1>
        </header>
      ) : (
        <header className="sm-market-header">
          <div className="sm-market-heading-copy">
            <h1>SubsMarket</h1>
          </div>
          <button
            type="button"
            className="sm-market-avatar-button"
            aria-label="Мой профиль"
            onClick={() => onOpenMine?.()}
          >
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
          value={searchTerm}
          onChange={e => onSearchTermChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") openInvite();
          }}
        />
        {searchTerm ? (
          <button
            type="button"
            className="sm-market-search-clear"
            aria-label="Очистить поиск"
            onClick={() => onSearchTermChange("")}
          >
            <SystemSymbol name="xmark" size={18} />
          </button>
        ) : null}
      </label>

      {isCatalog ? (
        <nav
          ref={familyTypeSwitchRef}
          className="sm-market-family-type-switch"
          aria-label="Тип семейных предложений"
          style={
            catalogPointerRef.current !== null || catalogAnimationFrame.current !== null
              ? undefined
              : ({ "--catalog-type-position": familyType === "tariff" ? 1 : 0 } as React.CSSProperties)
          }
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
          <button
            type="button"
            data-testid="family-type-subscription"
            aria-pressed={familyType === "subscription"}
            className={familyType === "subscription" ? "is-active" : undefined}
            onClick={() => {
              triggerTelegramSelection();
              onOpenFamilyCatalog("subscription");
            }}
          >
            Подписки
          </button>
          <button
            type="button"
            data-testid="family-type-tariff"
            aria-pressed={familyType === "tariff"}
            className={familyType === "tariff" ? "is-active" : undefined}
            onClick={() => {
              triggerTelegramSelection();
              onOpenFamilyCatalog("tariff");
            }}
          >
            Тарифы
          </button>
        </nav>
      ) : null}

      <section
        className="sm-market-family-section"
        aria-label={isSearching ? "Результаты поиска" : isCatalog ? catalogSectionTitle : "Популярные предложения"}
      >
        {isCatalog || isSearching ? (
          <div className={`sm-market-section-heading${isCatalog ? " sm-market-section-heading-catalog" : ""}`}>
            <div className="sm-market-section-heading-copy">
              <h2>{isSearching ? "Результаты поиска" : catalogSectionTitle}</h2>
              {isCatalog && catalogSectionCount > 0 ? (
                <span className="sm-market-section-count">
                  {catalogSectionCount}
                  {hasMoreFamilies ? "+" : ""}
                  <span className="sr-only"> предложений</span>
                </span>
              ) : null}
            </div>
            <div className="sm-market-filter-actions" ref={filterMenuRef}>
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
                  onSelect={value => {
                    onSelectCatalogFilter(value as CatalogFilter);
                    setOpenFilterMenu(null);
                    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
                  }}
                />
              ) : null}
              {openFilterMenu === "price" ? (
                <FilterMenu
                  id="market-price-sort-menu"
                  label="Порядок объявлений"
                  options={priceSortOptions}
                  selectedValue={priceSort}
                  testIdPrefix="market-price-option"
                  onSelect={value => {
                    onSelectPriceSort(value as PriceSort);
                    setOpenFilterMenu(null);
                    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
                  }}
                />
              ) : null}
            </div>
          </div>
        ) : null}

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
              style={{
                transform: `translate3d(calc(${-(catalogPointerRef.current !== null || catalogAnimationFrame.current !== null ? catalogPositionRef.current : (familyType === "tariff" ? 1 : 0)) * 50}% - ${(catalogPointerRef.current !== null || catalogAnimationFrame.current !== null ? catalogPositionRef.current : (familyType === "tariff" ? 1 : 0)) * 8}px), 0, 0)`
              }}
            >
              {(["subscription", "tariff"] as const).map(paneType => (
                <div
                  key={paneType}
                  ref={paneType === familyType ? scrollRef : undefined}
                  onScroll={
                    paneType === familyType
                      ? event => {
                          onScroll?.(event.currentTarget.scrollTop);
                          if (!isFeedDraggingRef.current) {
                            if (snapTimeoutRef.current) {
                              window.clearTimeout(snapTimeoutRef.current);
                            }
                            snapTimeoutRef.current = window.setTimeout(snapToNearestCard, 140);
                          }
                        }
                      : undefined
                  }
                  onTouchStart={paneType === familyType ? handleFeedTouchStart : undefined}
                  onTouchMove={paneType === familyType ? handleFeedTouchMove : undefined}
                  onTouchEnd={paneType === familyType ? handleFeedTouchEnd : undefined}
                  onTouchCancel={paneType === familyType ? handleFeedTouchEnd : undefined}
                  onWheel={paneType === familyType ? handleFeedWheel : undefined}
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
                    onResetSearch={() => onSearchTermChange("")}
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
        ) : (
          <div
            className="sm-market-catalog-feed-scroll"
            ref={scrollRef}
            onScroll={event => {
              onScroll?.(event.currentTarget.scrollTop);
              if (!isFeedDraggingRef.current) {
                if (snapTimeoutRef.current) {
                  window.clearTimeout(snapTimeoutRef.current);
                }
                snapTimeoutRef.current = window.setTimeout(snapToNearestCard, 140);
              }
            }}
            onTouchStart={handleFeedTouchStart}
            onTouchMove={handleFeedTouchMove}
            onTouchEnd={handleFeedTouchEnd}
            onTouchCancel={handleFeedTouchEnd}
            onWheel={handleFeedWheel}
          >
            {error ? (
              <div className="sm-market-empty" role="alert">
                <h3>Не удалось загрузить предложения</h3>
                <p>{error}</p>
                <button className="sm-market-button sm-market-button-secondary" type="button" onClick={onRefresh}>
                  Повторить
                </button>
              </div>
            ) : isLoading && displayed.length === 0 ? (
              <div className="sm-market-family-list" aria-label="Загружаем предложения" role="status">
                {[0, 1, 2].map(n => (
                  <div key={n} className="sm-listing-skeleton" aria-hidden>
                    <span />
                    <div />
                    <span />
                  </div>
                ))}
              </div>
            ) : displayed.length === 0 ? (
              <div className="sm-market-empty" data-testid="market-empty-state">
                <SystemSymbol name="magnifyingglass" size={28} />
                <h3>Ничего не найдено</h3>
                <p>Попробуйте другое название сервиса или оператора.</p>
                <div className="sm-market-empty-actions">
                  <button type="button" className="sm-market-button sm-market-button-secondary" onClick={() => onSearchTermChange("")}>
                    Сбросить поиск
                  </button>
                </div>
              </div>
            ) : (
              <div className="sm-market-family-list">
                {displayed.map(offer => {
                  if (offer.kind === "family") {
                    const f = offer.item;
                    const status = pending.has(f.id)
                      ? "Заявка отправлена"
                      : joined.has(f.id)
                      ? "Вы в семье"
                      : f.free_slots <= 0
                      ? "Мест нет"
                      : null;
                    return (
                      <FamilyListingCard
                        key={f.id}
                        family={f}
                        status={status}
                        onClick={() => onOpenFamily(f.id)}
                      />
                    );
                  }
                  if (offer.kind === "gigabytes") {
                    return (
                      <GigabytesListingCard
                        key={offer.item.id}
                        listing={offer.item}
                        testId="market-popular-gigabytes"
                        onClick={() => onOpenGigabytes(offer.item.id)}
                      />
                    );
                  }
                  return (
                    <AccountListingCard
                      key={offer.item.id}
                      listing={offer.item}
                      testId="market-popular-account"
                      onClick={() => onOpenAccounts(offer.item.id)}
                    />
                  );
                })}
              </div>
            )}
            {!isCatalog && hasMoreFamilies ? (
              <button
                className="sm-market-button sm-market-button-secondary sm-market-button-full"
                type="button"
                disabled={isLoadingMoreFamilies}
                onClick={onLoadMoreFamilies}
              >
                {isLoadingMoreFamilies ? "Загружаем…" : "Показать ещё"}
              </button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
