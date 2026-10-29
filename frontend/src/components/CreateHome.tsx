import { Panel } from "./layout";
import { ServiceLogo } from "./branding";
import { SystemSymbol } from "./SystemSymbol";
import { triggerTelegramSelection } from "../telegram";
import { servicePopularity } from "./families/createFamilyForm";
import { CREATE_TITLES, type CreateCategory } from "./CreateCategoryPicker";
import { useAccountServices, useMarketplaceOperators } from "../hooks/useApi";
import type { FamilyService } from "../types";

const POPULAR_COUNT = 6;

const KIND_ICONS: Record<
  CreateCategory,
  "person.2" | "antenna.radiowaves.left.and.right" | "key" | "globe"
> = {
  subscription: "person.2",
  tariff: "antenna.radiowaves.left.and.right",
  accounts: "key",
  gigabytes: "globe"
};

function examples(names: string[]) {
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown}…` : shown;
}

function popularFirst(list: FamilyService[]) {
  return [...list].sort((a, b) => servicePopularity(a.slug) - servicePopularity(b.slug));
}

/**
 * «Создать»: what can be created, each with an example of what is inside,
 * and the most popular services that open their family straight away.
 */
export function CreateHome({
  services,
  onOpen,
  onPickService
}: {
  services: FamilyService[];
  onOpen: (kind: CreateCategory) => void;
  onPickService: (service: FamilyService) => void;
}) {
  const accountServiceNames = (useAccountServices().data ?? []).map((item) => item.name);
  // The operators endpoint lists only operators that take listings now.
  const operatorNames = (useMarketplaceOperators().data ?? []).map((item) => item.name);
  const subscriptions = popularFirst(services.filter((item) => item.family_type !== "tariff"));
  const tariffs = popularFirst(services.filter((item) => item.family_type === "tariff"));
  const descriptions: Record<CreateCategory, string> = {
    subscription: examples(subscriptions.map((item) => item.name)),
    tariff: examples(tariffs.map((item) => item.name)),
    accounts: examples(accountServiceNames),
    gigabytes: examples(operatorNames)
  };
  const kinds: CreateCategory[] = ["subscription", "tariff", "accounts", "gigabytes"];
  const popular = subscriptions.slice(0, POPULAR_COUNT);

  return (
    <div className="create-screen create-home" data-testid="create-home">
      <Panel title="Создать">
        <div className="create-kinds">
          {kinds.map((kind) => (
            <button
              key={kind}
              type="button"
              className={`create-kind create-kind-${kind}`}
              data-testid={`create-kind-${kind}`}
              onClick={() => {
                triggerTelegramSelection();
                onOpen(kind);
              }}
            >
              <span className="create-kind-icon" aria-hidden="true">
                <SystemSymbol name={KIND_ICONS[kind]} size={24} />
              </span>
              <span className="create-kind-copy">
                <strong>{CREATE_TITLES[kind]}</strong>
                {descriptions[kind] ? <span>{descriptions[kind]}</span> : null}
              </span>
              <SystemSymbol name="chevron.forward" size={18} />
            </button>
          ))}
        </div>

        {popular.length > 0 ? (
          <section className="create-popular" aria-labelledby="create-popular-title">
            <h2 id="create-popular-title" className="create-service-section-title">
              Популярное
            </h2>
            <div className="create-popular-list">
              {popular.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  className="create-popular-row"
                  data-testid={`create-popular-${service.slug}`}
                  onClick={() => {
                    triggerTelegramSelection();
                    onPickService(service);
                  }}
                >
                  <ServiceLogo serviceSlug={service.slug} serviceName={service.name} size={36} />
                  <span className="create-popular-name">{service.name}</span>
                  <span className="create-popular-meta">до {service.max_members} мест</span>
                  <SystemSymbol name="chevron.forward" size={18} />
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </Panel>
    </div>
  );
}
