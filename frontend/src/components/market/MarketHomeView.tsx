import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import { AccountListingCard, FamilyListingCard, GigabytesListingCard } from "../ListingCard";
import { Ios27CategoryMenu } from "../Ios27CategoryMenu";
import { SystemSymbol } from "../SystemSymbol";
import type { FamilyType } from "../../types";
import {
  type MarketBanner,
  type MarketFilter,
  type Offer,
  type ScreenPulseHandle,
  ScreenEventPulse,
  MarketBannerCarousel,
  MarketTile,
  CategoryIconGradientDefs
} from "./index";

export type MarketHomeViewProps = {
  userName: string;
  firstName?: string;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  isInvite: boolean;
  onOpenInvite: (code: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll?: (scrollTop: number) => void;
  showIntro: boolean;
  onDismissIntro: () => void;
  pendingActionsCount: number;
  bannerItems: MarketBanner[];
  menuVariant: "classic" | "ios27";
  marketFilter: MarketFilter;
  activeMarketFilterLabel: string;
  onCycleMarketFilter: () => void;
  displayed: Offer[];
  isLoading?: boolean;
  error?: string;
  pending: Set<string>;
  joined: Set<string>;
  hasMoreFamilies?: boolean;
  isLoadingMoreFamilies?: boolean;
  onRefresh?: () => void;
  onLoadMoreFamilies?: () => void;
  onOpenFamily: (id: string) => void;
  onOpenFamilyCatalog: (type: FamilyType) => void;
  onOpenGigabytes: (id?: string) => void;
  onOpenAccounts: (id?: string) => void;
  onOpenMine?: () => void;
  onOpenActions?: (targetTab?: "inbox" | "outbox") => void;
  resetToken?: number;
  screenPulseRef: React.RefObject<ScreenPulseHandle | null>;
};

export function MarketHomeView({
  userName,
  firstName,
  searchTerm,
  onSearchTermChange,
  isInvite,
  onOpenInvite,
  searchInputRef,
  scrollRef,
  onScroll,
  showIntro,
  onDismissIntro,
  pendingActionsCount,
  bannerItems,
  menuVariant,
  marketFilter,
  activeMarketFilterLabel,
  onCycleMarketFilter,
  displayed,
  isLoading = false,
  error,
  pending,
  joined,
  hasMoreFamilies,
  isLoadingMoreFamilies,
  onRefresh,
  onLoadMoreFamilies,
  onOpenFamily,
  onOpenFamilyCatalog,
  onOpenGigabytes,
  onOpenAccounts,
  onOpenMine,
  onOpenActions,
  resetToken,
  screenPulseRef
}: MarketHomeViewProps) {
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isFeedScrolled, setIsFeedScrolled] = useState(false);
  const isFeedScrolledRef = useRef(false);
  const isHeaderCollapsedRef = useRef(isHeaderCollapsed);
  isHeaderCollapsedRef.current = isHeaderCollapsed;

  const pinnedTouchStartY = useRef<number | null>(null);
  const pinnedTouchStartX = useRef<number | null>(null);
  const feedTouchStartY = useRef<number | null>(null);
  const feedTouchStartX = useRef<number | null>(null);
  const isFeedDraggingRef = useRef(false);
  const snapTimeoutRef = useRef<number | null>(null);

  const term = searchTerm.trim().toLocaleLowerCase("ru-RU");

  // Reset header collapse state when filter or resetToken changes
  useEffect(() => {
    setIsHeaderCollapsed(false);
    setIsFeedScrolled(false);
    isFeedScrolledRef.current = false;
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [marketFilter, resetToken, scrollRef]);

  const handlePinnedTouchStart = (e: React.TouchEvent) => {
    pinnedTouchStartY.current = e.touches[0].clientY;
    pinnedTouchStartX.current = e.touches[0].clientX;
  };

  const handlePinnedTouchMove = (e: React.TouchEvent) => {
    if (pinnedTouchStartY.current === null || pinnedTouchStartX.current === null) return;
    const deltaY = e.touches[0].clientY - pinnedTouchStartY.current;
    const deltaX = e.touches[0].clientX - pinnedTouchStartX.current;
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 15) {
      if (deltaY > 20 && isHeaderCollapsed) {
        setIsHeaderCollapsed(false);
        setIsFeedScrolled(false);
        isFeedScrolledRef.current = false;
        if (scrollRef.current) {
          scrollRef.current.scrollTop = 0;
        }
      } else if (deltaY < -15 && !isHeaderCollapsed) {
        setIsHeaderCollapsed(true);
        if (scrollRef.current) {
          scrollRef.current.scrollTop = 0;
        }
      }
    }
  };

  const handlePinnedTouchEnd = () => {
    pinnedTouchStartY.current = null;
    pinnedTouchStartX.current = null;
  };

  const handlePinnedWheel = (e: React.WheelEvent) => {
    if (e.deltaY > 15 && !isHeaderCollapsed) {
      setIsHeaderCollapsed(true);
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    } else if (e.deltaY < -15 && isHeaderCollapsed) {
      setIsHeaderCollapsed(false);
      setIsFeedScrolled(false);
      isFeedScrolledRef.current = false;
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    }
  };

  const updateFeedPadding = useCallback(() => {
    const container = scrollRef.current;
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
  }, [scrollRef]);

  const snapToNearestCard = useCallback(() => {
    const container = scrollRef.current;
    if (!container || isFeedDraggingRef.current) return;
    if (!isHeaderCollapsedRef.current) return;

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
  }, [displayed.length, updateFeedPadding]);

  const handleFeedTouchStart = (e: React.TouchEvent) => {
    isFeedDraggingRef.current = true;
    if (snapTimeoutRef.current) {
      window.clearTimeout(snapTimeoutRef.current);
      snapTimeoutRef.current = null;
    }
    feedTouchStartY.current = e.touches[0].clientY;
    feedTouchStartX.current = e.touches[0].clientX;
  };

  const handleFeedTouchMove = (e: React.TouchEvent) => {
    if (feedTouchStartY.current === null || feedTouchStartX.current === null) return;
    const deltaY = e.touches[0].clientY - feedTouchStartY.current;
    const deltaX = e.touches[0].clientX - feedTouchStartX.current;
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      if (deltaY < -15 && !isHeaderCollapsed) {
        setIsHeaderCollapsed(true);
        if (scrollRef.current) {
          scrollRef.current.scrollTop = 0;
        }
      } else if (deltaY > 25 && isHeaderCollapsed) {
        if (scrollRef.current && scrollRef.current.scrollTop <= 2) {
          setIsHeaderCollapsed(false);
          setIsFeedScrolled(false);
          isFeedScrolledRef.current = false;
          if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
          }
        }
      }
    }
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

  const handleFeedWheel = (e: React.WheelEvent) => {
    if (e.deltaY > 15 && !isHeaderCollapsed) {
      setIsHeaderCollapsed(true);
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    } else if (e.deltaY < -15 && isHeaderCollapsed && scrollRef.current && scrollRef.current.scrollTop <= 2) {
      setIsHeaderCollapsed(false);
      setIsFeedScrolled(false);
      isFeedScrolledRef.current = false;
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    }
    if (snapTimeoutRef.current) {
      window.clearTimeout(snapTimeoutRef.current);
    }
    snapTimeoutRef.current = window.setTimeout(snapToNearestCard, 150);
  };

  const openInvite = () => {
    if (isInvite) onOpenInvite(term);
  };

  return (
    <div
      className="subs-screen-scroll sm-market-screen sm-market-screen-home"
      data-testid="market-screen"
    >
      <ScreenEventPulse ref={screenPulseRef} />

      <div
        className={`sm-market-home-top-collapsible${isHeaderCollapsed ? " is-collapsed" : ""}`}
        onTouchStart={handlePinnedTouchStart}
        onTouchMove={handlePinnedTouchMove}
        onTouchEnd={handlePinnedTouchEnd}
      >
        <div className="sm-market-home-top-collapsible-inner">
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

          <label className="sm-market-search">
            <SystemSymbol name="magnifyingglass" size={20} />
            <input
              ref={searchInputRef}
              type="search"
              aria-label="Поиск сервиса или семьи"
              data-testid="market-search-input"
              placeholder="Сервис, оператор или аккаунт"
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
        </div>
      </div>

      {isInvite ? (
        <button className="sm-market-button sm-market-button-primary" type="button" onClick={openInvite}>
          Открыть семью по коду {term}
        </button>
      ) : null}

      <div
        className="sm-market-home-pinned-section"
        onTouchStart={handlePinnedTouchStart}
        onTouchMove={handlePinnedTouchMove}
        onTouchEnd={handlePinnedTouchEnd}
        onWheel={handlePinnedWheel}
      >
        {showIntro && pendingActionsCount === 0 ? (
          <section className="sm-market-alert" data-testid="market-first-run-banner">
            <div>
              <span className="sm-market-alert-eyebrow">Для семейных подписок</span>
              <strong>Сначала доступ, потом оплата</strong>
              <p>Проверьте подписку перед переводом владельцу семьи.</p>
            </div>
            <button
              className="sm-market-button sm-market-button-secondary"
              type="button"
              onClick={onDismissIntro}
            >
              Понятно
            </button>
          </section>
        ) : null}

        <MarketBannerCarousel
          bannerItems={bannerItems}
          onOpenActions={onOpenActions}
          resetToken={resetToken}
        />

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
                  ariaLabel="Семейные тарифы"
                  icon={<SystemSymbol name="antenna.radiowaves.left.and.right" />}
                  testId="family-type-tariff"
                  onClick={() => onOpenFamilyCatalog("tariff")}
                />
                <MarketTile
                  category="subscription"
                  title="Семейные подписки"
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
                icon={<SystemSymbol name="globe" />}
                testId="market-buy-gigabytes"
                onClick={() => onOpenGigabytes()}
              />
              <MarketTile
                category="accounts"
                title="Аккаунты"
                icon={<SystemSymbol name="key" />}
                testId="market-buy-accounts"
                onClick={() => onOpenAccounts()}
              />
            </div>
          </section>
        )}

        <div className="sm-market-section-heading">
          <div className="sm-market-section-heading-copy">
            <h2>Популярное сейчас</h2>
          </div>
          <div className="sm-market-filter-actions">
            <button
              type="button"
              data-testid="market-filter-button"
              className={`sm-market-filter-chip${marketFilter !== "all" ? " is-active" : ""}`}
              aria-label={`Фильтр объявлений: ${activeMarketFilterLabel}`}
              title="Сменить тип объявлений"
              onClick={onCycleMarketFilter}
            >
              <SystemSymbol name="sort" size={14} />
              <span data-testid="market-filter-label">{activeMarketFilterLabel}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="sm-market-home-feed-wrap">
        <div
          ref={scrollRef}
          className={`sm-market-home-feed-scroll${!isHeaderCollapsed ? " is-locked" : ""}`}
          onScroll={event => {
            const top = event.currentTarget.scrollTop;
            const isScrolled = top > 2;
            if (isScrolled !== isFeedScrolledRef.current) {
              isFeedScrolledRef.current = isScrolled;
              setIsFeedScrolled(isScrolled);
            }
            onScroll?.(top);
            if (top > 12 && !isHeaderCollapsed) {
              setIsHeaderCollapsed(true);
            }
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
          <section className="sm-market-family-section" aria-label="Популярные предложения">
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
                <h3>Предложений пока нет</h3>
                <p>Можно создать своё предложение или вернуться позже.</p>
                <div className="sm-market-empty-actions">
                  <button type="button" className="sm-market-button sm-market-button-secondary" onClick={() => onRefresh?.()}>
                    Обновить
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
            {hasMoreFamilies ? (
              <button
                className="sm-market-button sm-market-button-secondary sm-market-button-full"
                type="button"
                disabled={isLoadingMoreFamilies}
                onClick={onLoadMoreFamilies}
              >
                {isLoadingMoreFamilies ? "Загружаем…" : "Показать ещё"}
              </button>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
