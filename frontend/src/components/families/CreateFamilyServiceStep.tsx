import { useEffect, useRef, useState, type UIEvent } from "react";
import { MarketSearchField } from "../market/MarketSearchField";
import { ServiceLogo } from "../branding";
import { SystemSymbol } from "../SystemSymbol";
import { serviceTitle } from "../../format";
import { triggerTelegramSelection } from "../../telegram";
import type { FamilyService } from "../../types";
import { CreateCategoryTabs, type CategoryTabsHandle } from "./CreateCategoryTabs";
import { CreateServicePager } from "./CreateServicePager";
import {
  POPULAR_SERVICE_COUNT,
  SERVICE_CATEGORY_CHIPS,
  matchesServiceQuery,
  serviceCategoryOrder,
  servicePopularity
} from "./createFamilyForm";

type ServiceSection = { id: string; title: string; services: FamilyService[] };

const byPopularity = (a: FamilyService, b: FamilyService) =>
  servicePopularity(a.slug) - servicePopularity(b.slug) || a.name.localeCompare(b.name, "ru");

/**
 * Step 1: tabs for «Популярное» and each category over pages that swipe like
 * folders in Telegram; a search above turns them into one list of matches.
 */
export function CreateFamilyServiceStep({
  services,
  selectedId,
  onPick,
  onClear
}: {
  services: FamilyService[];
  selectedId: string;
  onPick: (service: FamilyService) => void;
  /** A second tap on the picked tile takes the choice back. */
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const tabsRef = useRef<CategoryTabsHandle | null>(null);

  // While a list moves, a fade shows under the search, as on «Заявки»
  // (data-scrolling drives it in CSS).
  const settleTimer = useRef<number | undefined>(undefined);
  const markScrolling = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    if (element.getAttribute("data-scrolling") !== "true") element.setAttribute("data-scrolling", "true");
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => element.removeAttribute("data-scrolling"), 160);
  };
  useEffect(() => () => window.clearTimeout(settleTimer.current), []);
  // A new query starts the matches from the top.
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [query]);

  const countFor = (categories: string[]) =>
    services.filter((service) => categories.includes(service.category)).length;
  // A tile shows the bare name; the variant only when two services share it (Duolingo Super / Max).
  const nameCounts = new Map<string, number>();
  for (const service of services) nameCounts.set(service.name, (nameCounts.get(service.name) ?? 0) + 1);
  const tileName = (service: FamilyService) =>
    (nameCounts.get(service.name) ?? 0) > 1 ? serviceTitle(service) : service.name;

  // «Популярное», then each category that has services, then whatever is left.
  const categories = SERVICE_CATEGORY_CHIPS.filter(
    (item) => item.id !== "all" && countFor(item.categories) > 0
  );
  const popular = [...services].sort(byPopularity).slice(0, POPULAR_SERVICE_COUNT);
  const popularIds = new Set(popular.map((service) => service.id));
  const sections: ServiceSection[] = [{ id: "popular", title: "Популярное", services: popular }];
  for (const item of categories) {
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

  const searching = query.trim() !== "";
  // Operator tariffs are one category: no search and no tabs, just the operators.
  const singleCategory = categories.length <= 1;
  const paged = !searching && !singleCategory && sections.length > 1;
  const current = Math.min(page, sections.length - 1);
  const list = searching
    ? services.filter((service) => matchesServiceQuery(service, query)).sort(byPopularity)
    : [...services].sort(byPopularity);

  const grid = (items: FamilyService[]) => (
    <div className="create-service-grid">
      {items.map((service) => {
        const selected = service.id === selectedId;
        return (
          <button
            key={service.id}
            type="button"
            role="radio"
            aria-checked={selected}
            data-testid={`create-service-option-${service.slug}`}
            className="create-service-tile"
            onClick={() => {
              triggerTelegramSelection();
              if (selected) onClear();
              else onPick(service);
            }}
          >
            <ServiceLogo
              serviceSlug={service.slug}
              serviceName={service.name}
              familyType={service.family_type === "tariff" ? "tariff" : "subscription"}
              size={62}
              loading="eager"
            />
            <strong>{tileName(service)}</strong>
          </button>
        );
      })}
    </div>
  );

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
      {paged ? (
        <CreateCategoryTabs
          ref={tabsRef}
          items={sections.map((section) => ({ id: section.id, title: section.title }))}
          index={current}
          onSelect={setPage}
        />
      ) : null}
      <div className="my-feed-wrap create-feed-wrap create-service-feed" role="radiogroup" aria-label="Сервис">
        {paged ? (
          <CreateServicePager
            pages={sections.map((section) => ({ id: section.id, content: grid(section.services) }))}
            index={current}
            onIndexChange={setPage}
            onPosition={(position) => tabsRef.current?.move(position)}
            onPageScroll={markScrolling}
          />
        ) : (
          <div ref={listRef} className="create-service-sections" onScroll={markScrolling}>
            {list.length > 0 ? grid(list) : null}
            {searching && list.length === 0 ? (
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
        )}
      </div>
    </div>
  );
}
