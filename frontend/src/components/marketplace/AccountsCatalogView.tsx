import { useMemo, useState } from "react";
import { useFeedSnap } from "../../hooks/useFeedSnap";
import { Button as AppButton } from "../ui";
import { AccountListingCard as ListingRow } from "../ListingCard";
import { FilterMenu, type FilterMenuOption } from "../FilterMenu";
import { SystemSymbol } from "../SystemSymbol";
import { resolveServiceBrand } from "../branding";
import type { AccountListing, MarketplaceSort } from "../../types";

export type AccountCategoryFilter = "all" | "video" | "ai" | "music" | "other";

export const accountCategoryOptions: { value: AccountCategoryFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "video", label: "Видео" },
  { value: "ai", label: "AI" },
  { value: "music", label: "Музыка" },
  { value: "other", label: "Другое" }
];

const sortOptions: FilterMenuOption[] = [
  { value: "all", label: "По умолчанию" },
  { value: "recent", label: "Новое" },
  { value: "price_asc", label: "Дешевле" }
];

export function getAccountCategory(item: AccountListing): Exclude<AccountCategoryFilter, "all"> {
  const slug = (item.service?.slug ?? "").toLowerCase();
  const name = (item.service?.name ?? "").toLowerCase();
  const title = (item.title ?? "").toLowerCase();

  if (
    slug === "chatgpt" ||
    name.includes("chatgpt") ||
    slug === "gemini" ||
    name.includes("gemini") ||
    slug === "grok" ||
    name.includes("grok") ||
    slug === "claude" ||
    name.includes("claude") ||
    slug.includes("ai") ||
    name.includes("ai") ||
    title.includes("gpt") ||
    title.includes("ai")
  ) {
    return "ai";
  }

  const brand = resolveServiceBrand({ serviceSlug: item.service?.slug, serviceName: item.service?.name });
  if (
    brand.category === "video_streaming" ||
    slug.includes("netflix") ||
    slug.includes("youtube") ||
    slug.includes("cinema") ||
    slug.includes("video") ||
    slug.includes("kino") ||
    name.includes("кино") ||
    name.includes("видео") ||
    title.includes("netflix") ||
    title.includes("youtube")
  ) {
    return "video";
  }

  if (
    brand.category === "music_audio" ||
    slug.includes("spotify") ||
    slug.includes("music") ||
    name.includes("музык") ||
    title.includes("spotify") ||
    title.includes("музык")
  ) {
    return "music";
  }

  return "other";
}

export function AccountsCatalogView({
  listings,
  searchTerm,
  onSearchTerm,
  category,
  sort,
  loading,
  loadingMore,
  hasMore,
  onCategory,
  onSort,
  onListing,
  onLoadMore,
  onCreate,
  onRefresh
}: {
  listings: AccountListing[];
  searchTerm: string;
  onSearchTerm: (value: string) => void;
  category: AccountCategoryFilter;
  sort: MarketplaceSort | "all";
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onCategory: (value: AccountCategoryFilter) => void;
  onSort: (value: MarketplaceSort | "all") => void;
  onListing: (id: string) => void;
  onLoadMore: () => unknown;
  onCreate: () => void;
  onRefresh?: () => void;
}) {
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);

  const activeSortOption = useMemo(
    () => sortOptions.find((opt) => opt.value === sort) ?? sortOptions[0],
    [sort]
  );

  const categoryMenuOptions: FilterMenuOption[] = useMemo(() => {
    return accountCategoryOptions.map((opt) => {
      const count =
        opt.value === "all"
          ? listings.length
          : listings.filter((item) => getAccountCategory(item) === opt.value).length;
      return {
        ...opt,
        count,
        disabled: opt.value !== "all" && count === 0 && opt.value !== category
      };
    });
  }, [listings, category]);

  const activeCategoryOption = useMemo(
    () => accountCategoryOptions.find((opt) => opt.value === category) ?? accountCategoryOptions[0],
    [category]
  );

  const displayedListings = useMemo(() => {
    const byCategory =
      category === "all"
        ? listings
        : listings.filter((item) => getAccountCategory(item) === category);

    const term = searchTerm.trim().toLowerCase();
    if (!term) return byCategory;
    return byCategory.filter(
      (item) =>
        item.title.toLowerCase().includes(term) ||
        item.service.name.toLowerCase().includes(term) ||
        (item.description && item.description.toLowerCase().includes(term))
    );
  }, [listings, category, searchTerm]);

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
          aria-label="Поиск аккаунтов"
          data-testid="accounts-search-input"
          placeholder="Сервис или название"
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
            data-testid="account-category-filter-button"
            className={`sm-market-filter-chip${category !== "all" ? " is-active" : ""}`}
            aria-haspopup="menu"
            aria-expanded={isCategoryMenuOpen}
            aria-label={`Фильтр каталога: ${activeCategoryOption.label}`}
            onClick={() => {
              setIsSortMenuOpen(false);
              setIsCategoryMenuOpen((prev) => !prev);
            }}
          >
            <SystemSymbol name="sort" size={14} />
            <span>{activeCategoryOption.label}</span>
          </button>

          <button
            type="button"
            data-testid="account-sort-button"
            aria-label="Сортировка объявлений"
            aria-haspopup="menu"
            aria-expanded={isSortMenuOpen}
            className={`sm-market-filter-chip${sort !== "all" ? " is-active" : ""}`}
            onClick={() => {
              setIsCategoryMenuOpen(false);
              setIsSortMenuOpen((prev) => !prev);
            }}
          >
            <SystemSymbol name="round-sort-vertical" size={14} className="sm-market-filter-icon-price" />
            <span>{activeSortOption.label}</span>
          </button>

          {isCategoryMenuOpen ? (
            <FilterMenu
              id="account-category-menu"
              label="Категория сервиса"
              options={categoryMenuOptions}
              selectedValue={category}
              testIdPrefix="account-category-option"
              onSelect={(value) => {
                onCategory(value as AccountCategoryFilter);
                setIsCategoryMenuOpen(false);
                feedSnap.containerRef.current?.scrollTo({ top: 0, behavior: "auto" });
              }}
              onClose={() => setIsCategoryMenuOpen(false)}
            />
          ) : null}

          {isSortMenuOpen ? (
            <FilterMenu
              id="account-sort-menu"
              label="Сортировка объявлений"
              options={sortOptions}
              selectedValue={sort}
              testIdPrefix="account-sort-option"
              onSelect={(value) => {
                onSort(value as MarketplaceSort | "all");
                setIsSortMenuOpen(false);
                feedSnap.containerRef.current?.scrollTo({ top: 0, behavior: "auto" });
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
        ) : displayedListings.length === 0 ? (
          <div className="sm-market-empty" data-testid="account-catalog-empty">
            <SystemSymbol name="magnifyingglass" size={28} />
            <h3>{searchTerm ? "Ничего не найдено" : "Доступных аккаунтов пока нет"}</h3>
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
                  Продать аккаунт
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="sm-market-family-list">
            {displayedListings.map((item) => (
              <ListingRow key={item.id} listing={item} onClick={() => onListing(item.id)} />
            ))}
          </div>
        )}

        {hasMore ? (
          <AppButton
            variant="tertiary"
            fullWidth
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? "Загружаем…" : "Показать ещё"}
          </AppButton>
        ) : null}
      </div>
    </section>
  );
}
