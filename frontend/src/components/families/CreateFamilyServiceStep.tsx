import { useEffect, useRef, useState } from "react";
import { MarketSearchField } from "../market/MarketSearchField";
import { ServiceLogo } from "../branding";
import { SystemSymbol } from "../SystemSymbol";
import { serviceTitle } from "../../format";
import type { FamilyService } from "../../types";
import {
  POPULAR_SERVICE_COUNT,
  SERVICE_CATEGORY_CHIPS,
  matchesServiceQuery,
  serviceCategoryOrder,
  servicePopularity
} from "./createFamilyForm";

type ServiceSection = { id: string; title: string | null; services: FamilyService[] };

const byPopularity = (a: FamilyService, b: FamilyService) =>
  servicePopularity(a.slug) - servicePopularity(b.slug) || a.name.localeCompare(b.name, "ru");

/**
 * Step 1: categories always visible (they wrap, nothing scrolls sideways).
 * «Все» starts with «Популярное», then one titled section per category.
 */
export function CreateFamilyServiceStep({
  services,
  selectedId,
  onPick
}: {
  services: FamilyService[];
  selectedId: string;
  onPick: (service: FamilyService) => void;
}) {
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState("all");
  // The tiles scroll inside their own area; while they move, a fade shows under
  // the chips, as on «Заявки» (data-scrolling drives it in CSS).
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  const markScrolling = () => {
    const element = scrollRef.current;
    if (!element) return;
    element.setAttribute("data-scrolling", "true");
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => element.removeAttribute("data-scrolling"), 160);
  };
  useEffect(() => () => window.clearTimeout(settleTimer.current), []);
  // A new category or query starts the tiles from the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [chip, query]);
  const countFor = (categories: string[]) =>
    categories.length === 0
      ? services.length
      : services.filter((service) => categories.includes(service.category)).length;
  const chips = SERVICE_CATEGORY_CHIPS.filter(
    (item) => item.id === "all" || countFor(item.categories) > 0
  );
  const activeChip = chips.find((item) => item.id === chip) ?? chips[0];
  // A tile shows the bare name; the variant only when two services share it (Duolingo Super / Max).
  const nameCounts = new Map<string, number>();
  for (const service of services) nameCounts.set(service.name, (nameCounts.get(service.name) ?? 0) + 1);
  const tileName = (service: FamilyService) =>
    (nameCounts.get(service.name) ?? 0) > 1 ? serviceTitle(service) : service.name;

  const searching = query.trim() !== "";
  // Operator tariffs are one category: no chips and no sections, just the operators.
  const singleCategory = chips.length <= 2;
  let sections: ServiceSection[];
  if (singleCategory && !searching) {
    sections = [{ id: "single", title: null, services: [...services].sort(byPopularity) }];
  } else if (searching) {
    const found = services.filter((service) => matchesServiceQuery(service, query)).sort(byPopularity);
    sections = [{ id: "search", title: null, services: found }];
  } else if (activeChip.id !== "all") {
    const inCategory = services
      .filter((service) => activeChip.categories.includes(service.category))
      .sort(byPopularity);
    sections = [{ id: activeChip.id, title: null, services: inCategory }];
  } else {
    const popular = [...services].sort(byPopularity).slice(0, POPULAR_SERVICE_COUNT);
    const popularIds = new Set(popular.map((service) => service.id));
    sections = [{ id: "popular", title: "Популярное", services: popular }];
    for (const item of chips) {
      if (item.id === "all") continue;
      const rest = services
        .filter((service) => item.categories.includes(service.category) && !popularIds.has(service.id))
        .sort(byPopularity);
      if (rest.length > 0) sections.push({ id: item.id, title: item.label, services: rest });
    }
    const listed = new Set(sections.flatMap((section) => section.services.map((service) => service.id)));
    const other = services
      .filter((service) => !listed.has(service.id))
      .sort((a, b) => serviceCategoryOrder(a.category) - serviceCategoryOrder(b.category));
    if (other.length > 0) sections.push({ id: "other", title: "Другое", services: other });
  }
  const nothingFound = searching && sections[0].services.length === 0;

  return (
    <div className="create-step-body" data-create-step="service">
      {singleCategory ? null : (
        <MarketSearchField
          ariaLabel="Найти сервис"
          testId="create-service-search"
          placeholder="Найти сервис"
          value={query}
          onChange={setQuery}
          // Enter in the search box only closes the keyboard, it does not move on.
          onEnter={(input) => input.blur()}
        />
      )}
      {searching || singleCategory ? null : (
        <div className="create-category-chips" role="tablist" aria-label="Категории">
          {chips.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === activeChip.id}
              data-testid={`create-category-${item.id}`}
              className="create-category-chip"
              onClick={() => setChip(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      <div className="my-feed-wrap create-feed-wrap create-service-feed">
        <div
          ref={scrollRef}
          className="create-service-sections"
          role="radiogroup"
          aria-label="Сервис"
          onScroll={markScrolling}
        >
          {sections.map((section) =>
            section.services.length === 0 ? null : (
              <section
                key={section.id}
                className="create-service-section"
                data-testid={`create-service-section-${section.id}`}
                aria-label={section.title ?? undefined}
              >
                {section.title ? <h3 className="create-service-section-title">{section.title}</h3> : null}
                <div className="create-service-grid">
                  {section.services.map((service) => {
                    const selected = service.id === selectedId;
                    return (
                      <button
                        key={service.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        data-testid={`create-service-option-${service.slug}`}
                        className="create-service-tile"
                        onClick={() => onPick(service)}
                      >
                        <ServiceLogo
                          serviceSlug={service.slug}
                          serviceName={service.name}
                          familyType={service.family_type === "tariff" ? "tariff" : "subscription"}
                          size={40}
                        />
                        <strong>{tileName(service)}</strong>
                        {selected ? (
                          <span className="create-service-tile-check">
                            <SystemSymbol name="checkmark" size={14} />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            )
          )}
          {nothingFound ? (
            <div className="sm-market-empty create-results-empty" data-testid="create-service-empty">
              <SystemSymbol name="magnifyingglass" size={28} />
              <h3>Ничего не найдено</h3>
              <p>По запросу «{query.trim()}» сервиса нет. Проверьте название.</p>
              <div className="sm-market-empty-actions">
                <button
                  type="button"
                  className="sm-market-button sm-market-button-secondary"
                  onClick={() => setQuery("")}
                >
                  Сбросить поиск
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
