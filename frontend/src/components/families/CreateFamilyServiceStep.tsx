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
 * Step 1: «Популярное», then one titled section per category, under a search.
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
  // The tiles scroll inside their own area; while they move, a fade shows under
  // the search, as on «Заявки» (data-scrolling drives it in CSS).
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  const markScrolling = () => {
    window.cancelAnimationFrame(spyFrame.current ?? 0);
    spyFrame.current = window.requestAnimationFrame(updateActive);
    const element = scrollRef.current;
    if (!element) return;
    // Only touch the DOM when the state changes, not on every scroll event.
    if (element.getAttribute("data-scrolling") !== "true") element.setAttribute("data-scrolling", "true");
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => element.removeAttribute("data-scrolling"), 160);
  };
  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  // Category chips: a tap scrolls to that section, and while the list scrolls the
  // chip of the section at the top lights up. A tap holds the highlight until its
  // own scroll has settled, so it does not flicker through the sections in between.
  const chipsRef = useRef<HTMLDivElement | null>(null);
  const [activeId, setActiveId] = useState("");
  const spyLockUntil = useRef(0);
  const spyFrame = useRef<number | undefined>(undefined);
  useEffect(() => () => window.cancelAnimationFrame(spyFrame.current ?? 0), []);
  const updateActive = () => {
    const container = scrollRef.current;
    if (!container || Date.now() < spyLockUntil.current) return;
    const marks = [...container.querySelectorAll<HTMLElement>("[data-section-id]")];
    if (marks.length === 0) return;
    const top = container.getBoundingClientRect().top;
    const atEnd = container.scrollTop + container.clientHeight >= container.scrollHeight - 2;
    let current = marks[0];
    for (const mark of marks) {
      if (mark.getBoundingClientRect().top - top <= 24) current = mark;
    }
    // The last sections can be too short to reach the top: at the end the last one is the current.
    if (atEnd) current = marks[marks.length - 1];
    setActiveId(current.dataset.sectionId ?? "");
  };
  const goToSection = (id: string) => {
    const container = scrollRef.current;
    const target = container?.querySelector<HTMLElement>(`[data-section-id="${id}"]`);
    if (!container || !target) return;
    const offset = target.getBoundingClientRect().top - container.getBoundingClientRect().top;
    spyLockUntil.current = Date.now() + 800;
    setActiveId(id);
    container.scrollTo({
      top: container.scrollTop + offset - 4,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
  };
  // A new query starts the tiles from the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [query]);
  const countFor = (categories: string[]) =>
    categories.length === 0
      ? services.length
      : services.filter((service) => categories.includes(service.category)).length;
  // The categories that have services: each becomes a titled section under «Популярное».
  const categories = SERVICE_CATEGORY_CHIPS.filter(
    (item) => item.id === "all" || countFor(item.categories) > 0
  );
  // A tile shows the bare name; the variant only when two services share it (Duolingo Super / Max).
  const nameCounts = new Map<string, number>();
  for (const service of services) nameCounts.set(service.name, (nameCounts.get(service.name) ?? 0) + 1);
  const tileName = (service: FamilyService) =>
    (nameCounts.get(service.name) ?? 0) > 1 ? serviceTitle(service) : service.name;

  const searching = query.trim() !== "";
  // Operator tariffs are one category: no search and no sections, just the operators.
  const singleCategory = categories.length <= 2;
  let sections: ServiceSection[];
  if (singleCategory && !searching) {
    sections = [{ id: "single", title: null, services: [...services].sort(byPopularity) }];
  } else if (searching) {
    const found = services.filter((service) => matchesServiceQuery(service, query)).sort(byPopularity);
    sections = [{ id: "search", title: null, services: found }];
  } else {
    const popular = [...services].sort(byPopularity).slice(0, POPULAR_SERVICE_COUNT);
    const popularIds = new Set(popular.map((service) => service.id));
    sections = [{ id: "popular", title: "Популярное", services: popular }];
    for (const item of categories) {
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
  // One chip per titled section; none while searching or when there is a single list.
  const chips = searching
    ? []
    : sections.filter((section) => section.title && section.services.length > 0);
  const currentId = chips.some((chip) => chip.id === activeId) ? activeId : (chips[0]?.id ?? "");

  // The lit chip stays in view when the row itself scrolls sideways.
  useEffect(() => {
    const row = chipsRef.current;
    const chip = row?.querySelector<HTMLElement>(`[data-chip-id="${currentId}"]`);
    if (!row || !chip) return;
    row.scrollTo({
      left: chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2,
      behavior: "smooth"
    });
  }, [currentId]);

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
      {chips.length > 1 ? (
        <div className="create-service-chips" ref={chipsRef} role="group" aria-label="Категории">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="create-service-chip"
              data-chip-id={chip.id}
              data-testid={`create-service-chip-${chip.id}`}
              aria-current={chip.id === currentId ? "true" : undefined}
              onClick={() => goToSection(chip.id)}
            >
              {chip.title}
            </button>
          ))}
        </div>
      ) : null}
      <div className="my-feed-wrap create-feed-wrap create-service-feed">
        <div
          ref={scrollRef}
          className="create-service-sections"
          role="radiogroup"
          aria-label="Сервис"
          onScroll={markScrolling}
          // The person takes over: the highlight follows their scrolling again.
          onTouchStart={() => (spyLockUntil.current = 0)}
          onWheel={() => (spyLockUntil.current = 0)}
        >
          {sections.map((section) =>
            section.services.length === 0 ? null : (
              <section
                key={section.id}
                className="create-service-section"
                data-section-id={section.id}
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
                          size={44}
                          loading="eager"
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
