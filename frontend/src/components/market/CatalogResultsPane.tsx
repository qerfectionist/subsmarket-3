import { AccountListingCard, FamilyListingCard, GigabytesListingCard } from "../ListingCard";
import { SystemSymbol } from "../SystemSymbol";
import type { Offer } from "./types";

export function CatalogResultsPane({
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
        <div className="sm-market-empty" role="alert">
          <h3>Не удалось загрузить предложения</h3>
          <p>{error}</p>
          <button
            className="sm-market-button sm-market-button-secondary"
            type="button"
            onClick={onRefresh}
          >
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
        <div
          className="sm-market-empty"
          data-testid={showTestIds ? "market-empty-state" : undefined}
        >
          <SystemSymbol name="magnifyingglass" size={28} />
          <h3>{isSearching ? "Ничего не найдено" : emptyTitle}</h3>
          <p>
            {isSearching
              ? "Попробуйте другое название сервиса или оператора."
              : "Можно создать свою семью или вернуться позже."}
          </p>
          <div className="sm-market-empty-actions">
            <button
              type="button"
              className="sm-market-button sm-market-button-secondary"
              onClick={() => (isSearching ? onResetSearch() : onRefresh?.())}
            >
              {isSearching ? "Сбросить поиск" : "Обновить"}
            </button>
            {!isSearching ? (
              <button
                type="button"
                data-testid={showTestIds ? "empty-create-family-button" : undefined}
                className="sm-market-button sm-market-button-primary"
                onClick={onCreateFamily}
              >
                Создать семью
              </button>
            ) : null}
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
                  testId={showTestIds ? "family-card" : ""}
                  onClick={() => onOpenFamily(f.id)}
                />
              );
            }
            if (offer.kind === "gigabytes")
              return (
                <GigabytesListingCard
                  key={offer.item.id}
                  listing={offer.item}
                  testId={showTestIds ? "market-popular-gigabytes" : undefined}
                  onClick={() => onOpenGigabytes(offer.item.id)}
                />
              );
            return (
              <AccountListingCard
                key={offer.item.id}
                listing={offer.item}
                testId={showTestIds ? "market-popular-account" : undefined}
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
    </div>
  );
}
