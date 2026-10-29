import { useEffect, useRef, useState } from "react";
import { SystemSymbol } from "./SystemSymbol";
import { MarketFilterMenu } from "./market/MarketFilterMenu";
import { CreateFeed } from "./CreateFeed";
import { triggerTelegramSelection } from "../telegram";
import type { CreateCategory } from "./CreateCategoryPicker";
import type { CreateHomeItem } from "./createHomeItems";

type RecentFilter = "all" | CreateCategory;

const FILTERS: { value: RecentFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "subscription", label: "Подписки" },
  { value: "tariff", label: "Тарифы" },
  { value: "accounts", label: "Аккаунты" },
  { value: "gigabytes", label: "Гигабайты" }
];

/**
 * «Недавние» with the market's section heading: a count beside the title and a
 * filter chip that opens the market's filter menu.
 */
export function CreateRecentSection({ items }: { items: CreateHomeItem[] }) {
  const [filter, setFilter] = useState<RecentFilter>("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement | null>(null);

  // Close the menu on a tap outside it or on Escape, as in the market.
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !actionsRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  const countOf = (value: RecentFilter) =>
    value === "all" ? items.length : items.filter((item) => item.kind === value).length;
  // A filter whose kind has since left the list falls back to «Все».
  const active = countOf(filter) > 0 ? filter : "all";
  const shown = active === "all" ? items : items.filter((item) => item.kind === active);
  const activeLabel = FILTERS.find((option) => option.value === active)?.label ?? "Все";

  return (
    <section className="create-recent" aria-labelledby="create-recent-title" data-testid="create-recent">
      <div className="sm-market-section-heading">
        <div className="sm-market-section-heading-copy">
          <h2 id="create-recent-title">Недавние</h2>
          <span className="sm-market-section-count" data-testid="create-recent-count">
            {shown.length}
          </span>
        </div>
        <div className="sm-market-filter-actions" ref={actionsRef}>
          <button
            type="button"
            data-testid="create-recent-filter"
            className={`sm-market-filter-chip${active !== "all" ? " is-active" : ""}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls="create-recent-filter-menu"
            aria-label={`Фильтр недавних: ${activeLabel}`}
            onClick={() => {
              triggerTelegramSelection();
              setMenuOpen((open) => !open);
            }}
          >
            <SystemSymbol name="sort" size={14} />
            <span>{activeLabel}</span>
          </button>
          {menuOpen ? (
            <MarketFilterMenu
              id="create-recent-filter-menu"
              label="Что показать"
              options={FILTERS.map((option) => ({
                value: option.value,
                label: option.label,
                count: countOf(option.value),
                disabled: countOf(option.value) === 0
              }))}
              selectedValue={active}
              testIdPrefix="create-recent-option"
              onSelect={(value) => {
                setFilter(value as RecentFilter);
                setMenuOpen(false);
              }}
            />
          ) : null}
        </div>
      </div>
      <CreateFeed items={shown} testId="create-recent-list" tail="first" resetKey={active} />
    </section>
  );
}
