import type { Offer } from "./index";
import { AccountListingCard, FamilyListingCard, GigabytesListingCard } from "../ListingCard";
import { SystemSymbol } from "../SystemSymbol";

export type MarketPopularFeedProps = {
  displayed: Offer[];
  isLoading?: boolean;
  error?: string;
  pending: Set<string>;
  joined: Set<string>;
  hasMoreFamilies?: boolean;
  isLoadingMoreFamilies?: boolean;
  onRefresh?: () => void;
  onSearchTermChange: (term: string) => void;
  onLoadMoreFamilies?: () => void;
  onOpenFamily: (id: string) => void;
  onOpenGigabytes: (id?: string) => void;
  onOpenAccounts: (id?: string) => void;
};

export function MarketPopularFeed({
  displayed,
  isLoading = false,
  error,
  pending,
  joined,
  hasMoreFamilies,
  isLoadingMoreFamilies,
  onRefresh,
  onSearchTermChange,
  onLoadMoreFamilies,
  onOpenFamily,
  onOpenGigabytes,
  onOpenAccounts
}: MarketPopularFeedProps) {
  if (error) {
    return (
      <div className="sm-market-empty" role="alert">
        <h3>Не удалось загрузить предложения</h3>
        <p>{error}</p>
        <button className="sm-market-button sm-market-button-secondary" type="button" onClick={onRefresh}>
          Повторить
        </button>
      </div>
    );
  }

  if (isLoading && displayed.length === 0) {
    return (
      <div className="sm-market-family-list" aria-label="Загружаем предложения" role="status">
        {[0, 1, 2].map(n => (
          <div key={n} className="sm-listing-skeleton" aria-hidden>
            <span />
            <div />
            <span />
          </div>
        ))}
      </div>
    );
  }

  if (displayed.length === 0) {
    return (
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
    );
  }

  return (
    <>
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
    </>
  );
}
