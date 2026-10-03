import { useState, useRef, useEffect } from "react";
import { SystemSymbol } from "../SystemSymbol";
import { triggerTelegramSelection } from "../../telegram";
import type { FamilyType } from "../../types";
import {
  type CatalogFilter,
  type FilterMenuKey,
  type FilterMenuOption,
  type PriceSort,
  priceSortOptions,
  FilterMenu
} from "./index";

export type MarketCatalogFilterBarProps = {
  isCatalog: boolean;
  isSearching: boolean;
  catalogSectionTitle: string;
  catalogSectionCount: number;
  hasMoreFamilies?: boolean;
  familyType: FamilyType;
  catalogFilterMenuOptions: FilterMenuOption[];
  effectiveCatalogFilter: CatalogFilter;
  onSelectCatalogFilter: (filter: CatalogFilter) => void;
  priceSort: PriceSort;
  onSelectPriceSort: (sort: PriceSort) => void;
  activeCatalogFilter: FilterMenuOption;
  activePriceSort: FilterMenuOption;
  showPriceSort: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
};

export function MarketCatalogFilterBar({
  isCatalog,
  isSearching,
  catalogSectionTitle,
  catalogSectionCount,
  hasMoreFamilies,
  familyType,
  catalogFilterMenuOptions,
  effectiveCatalogFilter,
  onSelectCatalogFilter,
  priceSort,
  onSelectPriceSort,
  activeCatalogFilter,
  activePriceSort,
  showPriceSort,
  scrollRef
}: MarketCatalogFilterBarProps) {
  const [openFilterMenu, setOpenFilterMenu] = useState<FilterMenuKey | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);

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

  const toggleFilterMenu = (menu: FilterMenuKey) => {
    triggerTelegramSelection();
    setOpenFilterMenu(current => (current === menu ? null : menu));
  };

  if (!isCatalog && !isSearching) return null;

  return (
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
  );
}
