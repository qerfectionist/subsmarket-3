import {
  type ReactNode
} from "react";
import { SystemSymbol } from "../SystemSymbol";
import { triggerTelegramSelection } from "../../telegram";
import type { FamilyType } from "../../types";
import {
  type CatalogFilter,
  type FilterMenuOption,
  type Offer,
  type PriceSort,
  type ScreenPulseHandle,
  ScreenEventPulse,
  CatalogResultsPane
} from "./index";
import { useFeedCardSnap } from "./useFeedCardSnap";
import { useCatalogSwipePager } from "./useCatalogSwipePager";
import { MarketCatalogFilterBar } from "./MarketCatalogFilterBar";
import { MarketPopularFeed } from "./MarketPopularFeed";

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
  const term = searchTerm.trim().toLocaleLowerCase("ru-RU");

  const {
    isFeedDraggingRef,
    snapTimeoutRef,
    snapToNearestCard,
    handleFeedTouchStart,
    handleFeedTouchMove,
    handleFeedTouchEnd,
    handleFeedWheel
  } = useFeedCardSnap({
    isCatalog,
    scrollRef,
    displayedLength: displayed.length,
    familyType
  });

  const {
    catalogViewportRef,
    catalogTrackRef,
    catalogPositionRef,
    catalogPointerRef,
    catalogAnimationFrame,
    familyTypeSwitchRef,
    catalogWasSwiped,
    handleCatalogPointerDown,
    handleCatalogPointerMove,
    handleCatalogPointerEnd
  } = useCatalogSwipePager({
    familyType,
    isCatalog,
    scrollRef,
    onSelectCatalogFilter,
    onOpenFamilyCatalog
  });

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
        <MarketCatalogFilterBar
          isCatalog={isCatalog}
          isSearching={isSearching}
          catalogSectionTitle={catalogSectionTitle}
          catalogSectionCount={catalogSectionCount}
          hasMoreFamilies={hasMoreFamilies}
          familyType={familyType}
          catalogFilterMenuOptions={catalogFilterMenuOptions}
          effectiveCatalogFilter={effectiveCatalogFilter}
          onSelectCatalogFilter={onSelectCatalogFilter}
          priceSort={priceSort}
          onSelectPriceSort={onSelectPriceSort}
          activeCatalogFilter={activeCatalogFilter}
          activePriceSort={activePriceSort}
          showPriceSort={showPriceSort}
          scrollRef={scrollRef}
        />

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
            <MarketPopularFeed
              displayed={displayed}
              isLoading={isLoading}
              error={error}
              pending={pending}
              joined={joined}
              hasMoreFamilies={!isCatalog && Boolean(hasMoreFamilies)}
              isLoadingMoreFamilies={isLoadingMoreFamilies}
              onRefresh={onRefresh}
              onSearchTermChange={onSearchTermChange}
              onLoadMoreFamilies={onLoadMoreFamilies}
              onOpenFamily={onOpenFamily}
              onOpenGigabytes={onOpenGigabytes}
              onOpenAccounts={onOpenAccounts}
            />
          </div>
        )}
      </section>
    </div>
  );
}
