import { useState } from "react";
import { Input } from "../ui";
import { ServiceLogo } from "../branding";
import { SystemSymbol } from "../SystemSymbol";
import { serviceTitle } from "../../format";
import type { FamilyService } from "../../types";
import {
  SERVICE_CATEGORY_CHIPS,
  matchesServiceQuery,
  serviceCategoryOrder
} from "./createFamilyForm";

/** Step 1: one grid of service logos for subscriptions and operator tariffs. */
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
  const chips = SERVICE_CATEGORY_CHIPS.filter(
    (item) =>
      item.id === "all" || services.some((service) => item.categories.includes(service.category))
  );
  const activeChip = chips.find((item) => item.id === chip) ?? chips[0];
  // A tile shows the bare name; the variant only when two services share it (Duolingo Super / Max).
  const nameCounts = new Map<string, number>();
  for (const service of services) nameCounts.set(service.name, (nameCounts.get(service.name) ?? 0) + 1);
  const tileName = (service: FamilyService) =>
    (nameCounts.get(service.name) ?? 0) > 1 ? serviceTitle(service) : service.name;
  const visible = services
    .filter((service) => matchesServiceQuery(service, query))
    .filter(
      (service) =>
        query.trim() !== "" ||
        activeChip.id === "all" ||
        activeChip.categories.includes(service.category)
    )
    .sort((a, b) => serviceCategoryOrder(a.category) - serviceCategoryOrder(b.category));

  return (
    <div className="create-step-body" data-create-step="service">
      <Input
        type="search"
        aria-label="Найти сервис"
        placeholder="Найти сервис"
        data-testid="create-service-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        // Enter in the search box only closes the keyboard, it does not move on.
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      {query.trim() === "" ? (
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
      ) : null}
      <div className="create-service-grid" role="radiogroup" aria-label="Сервис">
        {visible.map((service) => {
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
      {visible.length === 0 ? (
        <p className="create-service-empty" data-testid="create-service-empty">
          По запросу «{query.trim()}» ничего не нашлось. Проверьте название.
        </p>
      ) : null}
    </div>
  );
}
