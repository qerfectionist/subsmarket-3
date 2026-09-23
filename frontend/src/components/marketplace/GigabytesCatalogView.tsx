import { useMemo, useState } from "react";
import { useFeedSnap } from "../../hooks/useFeedSnap";
import { Button as AppButton } from "../ui";
import { GigabytesListingCard as ListingRow } from "../ListingCard";
import { FilterMenu, type FilterMenuOption } from "../FilterMenu";
import { SystemSymbol } from "../SystemSymbol";
import type { MarketplaceListing, MarketplaceOperator, MarketplaceSort } from "../../types";

const sortOptions: FilterMenuOption[] = [
  { value: "all", label: "По умолчанию" },
  { value: "recent", label: "Новое" },
  { value: "price_asc", label: "Дешевле" }
];

export function GigabytesCatalogView({
  operators,
  listings,
  searchTerm,
  onSearchTerm,
  operator,
  sort,
  loading,
  loadingMore,
  hasMore,
  onOperator,
  onSort,
  onListing,
  onLoadMore,
  onCreate,
  onRefresh
}: {
  operators: MarketplaceOperator[] | undefined;
  listings: MarketplaceListing[];
  searchTerm: string;
  onSearchTerm: (value: string) => void;
  operator: string | null;
  sort: MarketplaceSort | "all";
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onOperator: (value: string | null) => void;
  onSort: (value: MarketplaceSort | "all") => void;
  onListing: (id: string) => void;
  onLoadMore: () => unknown;
  onCreate: () => void;
  onRefresh?: () => void;
}) {
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isOperatorMenuOpen, setIsOperatorMenuOpen] = useState(false);
  const activeSortOption = useMemo(
    () => sortOptions.find((opt) => opt.value === sort) ?? sortOptions[0],
    [sort]
  );

  const operatorOptions: FilterMenuOption[] = useMemo(() => {
    return [
      { value: "all", label: "Все операторы", count: listings.length },
      ...(operators ?? []).map((item) => ({
        value: item.slug,
        label: item.name,
        count: listings.filter((l) => l.operator.slug === item.slug).length
      }))
    ];
  }, [listings, operators]);

  const activeOperatorOption = useMemo(
    () =>
      operatorOptions.find((opt) =>
        operator === null ? opt.value === "all" : opt.value === operator
      ) ?? operatorOptions[0],
    [operator, operatorOptions]
  );

  const displayedListings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return listings;
    return listings.filter(
      (item) =>
        item.operator.name.toLowerCase().includes(term) ||
        (item.description && item.description.toLowerCase().includes(term))
    );
  }, [listings, searchTerm]);

  const feedSnap = useFeedSnap({
    enabled: true,
    itemCount: displayedListings.length
  });

  return (
    <section className="gb-stack sm-market-catalog-stack">
      <label className="sm-market-search">
        <SystemSymbol name="magnifyingglass" size={20} />
        <input
          type="search"
          aria-label="Поиск гигабайтов"
          data-testid="gigabytes-search-input"
          placeholder="Оператор или описание"
          value={searchTerm}
          onChange={(e) => onSearchTerm(e.target.value)}
        />
        {searchTerm ? (
          <button
            type="button"
            className="sm-market-search-clear"
            aria-label="Очистить поиск"
            onClick={() => onSearchTerm("")}
          >
            <SystemSymbol name="xmark" size={18} />
          </button>
        ) : null}
      </label>

      <div className="sm-market-section-heading sm-market-section-heading-catalog">
        <div className="sm-market-section-heading-copy">
          <h2>{searchTerm ? "Результаты поиска" : "Доступные"}</h2>
          {!searchTerm && listings.length > 0 ? (
            <span className="sm-market-section-count">{listings.length}</span>
          ) : null}
        </div>
        <div className="sm-market-filter-actions">
          <button
            type="button"
            data-testid="gigabytes-operator-filter-button"
            className={`sm-market-filter-chip${operator !== null ? " is-active" : ""}`}
            aria-haspopup="menu"
            aria-expanded={isOperatorMenuOpen}
            aria-label={`Фильтр операторов: ${activeOperatorOption.label}`}
            onClick={() => {
              setIsSortMenuOpen(false);
              setIsOperatorMenuOpen((prev) => !prev);
            }}
          >
            <SystemSymbol name="sort" size={14} />
            <span>{operator ? activeOperatorOption.label : "Все"}</span>
          </button>

          <button
            type="button"
            data-testid="gigabytes-sort-button"
            aria-label="Сортировка объявлений"
            aria-haspopup="menu"
            aria-expanded={isSortMenuOpen}
            className={`sm-market-filter-chip${sort !== "all" ? " is-active" : ""}`}
            onClick={() => {
              setIsOperatorMenuOpen(false);
              setIsSortMenuOpen((prev) => !prev);
            }}
          >
            <SystemSymbol name="round-sort-vertical" size={14} className="sm-market-filter-icon-price" />
            <span>{activeSortOption.label}</span>
          </button>

          {isOperatorMenuOpen ? (
            <FilterMenu
              id="gigabytes-operator-menu"
              label="Оператор"
              options={operatorOptions}
              selectedValue={operator ?? "all"}
              testIdPrefix="gigabytes-operator-option"
              onSelect={(value) => {
                onOperator(value === "all" ? null : value);
                setIsOperatorMenuOpen(false);
              }}
              onClose={() => setIsOperatorMenuOpen(false)}
            />
          ) : null}

          {isSortMenuOpen ? (
            <FilterMenu
              id="gigabytes-sort-menu"
              label="Сортировка объявлений"
              options={sortOptions}
              selectedValue={sort}
              testIdPrefix="gigabytes-sort-option"
              onSelect={(value) => {
                onSort(value as MarketplaceSort | "all");
                setIsSortMenuOpen(false);
              }}
              onClose={() => setIsSortMenuOpen(false)}
            />
          ) : null}
        </div>
      </div>

      <div
        className="sm-market-catalog-feed-scroll"
        ref={feedSnap.containerRef}
        {...feedSnap.scrollHandlers}
      >
        {loading ? (
          <div className="sm-market-family-list" aria-label="Загружаем объявления" role="status">
            {[0, 1, 2].map((n) => (
              <div key={n} className="sm-listing-skeleton" aria-hidden>
                <span />
                <div />
                <span />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && displayedListings.length === 0 ? (
          <div className="sm-market-empty" data-testid="gigabytes-catalog-empty">
            <SystemSymbol name="magnifyingglass" size={28} />
            <h3>{searchTerm ? "Ничего не найдено" : "Доступных гигабайтов пока нет"}</h3>
            <p>
              {searchTerm
                ? "Попробуйте изменить поисковый запрос или сбросить фильтры."
                : "Можно опубликовать первое предложение или вернуться позже."}
            </p>
            <div className="sm-market-empty-actions">
              <button
                type="button"
                className="sm-market-button sm-market-button-secondary"
                onClick={() => (searchTerm ? onSearchTerm("") : void onRefresh?.())}
              >
                {searchTerm ? "Сбросить поиск" : "Обновить"}
              </button>
              {!searchTerm ? (
                <button
                  type="button"
                  className="sm-market-button sm-market-button-primary"
                  onClick={onCreate}
                >
                  Продать ГБ
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="sm-market-family-list">
            {displayedListings.map((listing) => (
              <ListingRow key={listing.id} listing={listing} onClick={() => onListing(listing.id)} />
            ))}
          </div>
        )}

        {hasMore ? (
          <AppButton type="button" variant="tertiary" fullWidth disabled={loadingMore} onClick={onLoadMore}>
            {loadingMore ? "Загружаем…" : "Показать ещё"}
          </AppButton>
        ) : null}
      </div>
    </section>
  );
}
