import { useState } from "react";
import { Panel } from "./layout";
import { ServiceLogo } from "./branding";
import { SystemSymbol } from "./SystemSymbol";
import { MarketSearchField } from "./market/MarketSearchField";
import { triggerTelegramSelection } from "../telegram";
import { servicePopularity } from "./families/createFamilyForm";
import { CREATE_TITLES, type CreateCategory } from "./CreateCategoryPicker";
import {
  useAccountServices,
  useMarketplaceOperators,
  useMyAccountListings,
  useMyMarketplaceListings
} from "../hooks/useApi";
import {
  recentCreateItems,
  searchCreateItems,
  type CreateHomeActions,
  type CreateHomeItem
} from "./createHomeItems";
import type { FamilyService, MyFamily } from "../types";

const KIND_ICONS: Record<
  CreateCategory,
  "person.2" | "antenna.radiowaves.left.and.right" | "key" | "globe"
> = {
  subscription: "person.2",
  tariff: "antenna.radiowaves.left.and.right",
  accounts: "key",
  gigabytes: "globe"
};

const KINDS: CreateCategory[] = ["subscription", "tariff", "accounts", "gigabytes"];

/**
 * «Яндекс Плюс, Spotify и ещё 22»: two of the most popular names, the first pair
 * that fits on one line even on a narrow phone, then how many more.
 */
function examples(names: string[]) {
  const top = names.slice(0, 8);
  let shown = top.slice(0, 2);
  search: for (let i = 0; i < top.length; i += 1) {
    for (let j = i + 1; j < top.length; j += 1) {
      if (`${top[i]}, ${top[j]}`.length <= 22) {
        shown = [top[i], top[j]];
        break search;
      }
    }
  }
  const rest = names.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} и ещё ${rest}` : shown.join(", ");
}

function popularFirst(list: FamilyService[]) {
  return [...list].sort((a, b) => servicePopularity(a.slug) - servicePopularity(b.slug));
}

function CreateRow({ item }: { item: CreateHomeItem }) {
  return (
    <button
      type="button"
      className="create-row"
      data-testid={`create-row-${item.key}`}
      onClick={() => {
        triggerTelegramSelection();
        item.open();
      }}
    >
      <ServiceLogo
        serviceSlug={item.logoSlug}
        serviceName={item.title}
        familyType={item.tariffLogo ? "tariff" : "subscription"}
        size={40}
      />
      <span className="create-row-copy">
        <strong>{item.title}</strong>
        <span>{item.subtitle}</span>
      </span>
      <SystemSymbol name="chevron.forward" size={18} />
    </button>
  );
}

/**
 * «Создать»: a search across everything that can be created, the four kinds,
 * and what this person created before, so a repeat takes one tap.
 */
export function CreateHome({
  services,
  myFamilies,
  onOpen,
  ...actions
}: CreateHomeActions & {
  services: FamilyService[];
  myFamilies: MyFamily[];
  onOpen: (kind: CreateCategory) => void;
}) {
  const [query, setQuery] = useState("");
  const accountServices = useAccountServices().data ?? [];
  // The operators endpoint lists only operators that take listings now.
  const operators = useMarketplaceOperators().data ?? [];
  const accountListings = useMyAccountListings().data ?? [];
  const gigabyteListings = useMyMarketplaceListings().data ?? [];

  const subscriptions = popularFirst(services.filter((item) => item.family_type !== "tariff"));
  const tariffs = popularFirst(services.filter((item) => item.family_type === "tariff"));
  const descriptions: Record<CreateCategory, string> = {
    subscription: examples(subscriptions.map((item) => item.name)),
    tariff: examples(tariffs.map((item) => item.name)),
    accounts: examples(accountServices.map((item) => item.name)),
    gigabytes: examples(operators.map((item) => item.name))
  };

  const searching = query.trim() !== "";
  const found = searching ? searchCreateItems(query, { services, accountServices, operators }, actions) : [];
  const recent = searching
    ? []
    : recentCreateItems({ families: myFamilies, accountListings, gigabyteListings }, actions);

  return (
    <div className="create-screen create-home" data-testid="create-home">
      <Panel title="Создать">
        <MarketSearchField
          ariaLabel="Найти, что создать"
          testId="create-search"
          placeholder="Сервис, оператор или аккаунт"
          value={query}
          onChange={setQuery}
          // Enter only closes the keyboard.
          onEnter={(input) => input.blur()}
        />

        {searching ? (
          <div className="create-results" data-testid="create-search-results">
            {found.length ? (
              found.map((item) => <CreateRow key={item.key} item={item} />)
            ) : (
              <p className="create-results-empty">Ничего не нашлось</p>
            )}
          </div>
        ) : (
          <>
            <div className="create-kinds">
              {KINDS.map((kind) => (
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

            {recent.length > 0 ? (
              <section className="create-recent" aria-labelledby="create-recent-title" data-testid="create-recent">
                <div className="sm-market-section-heading">
                  <div className="sm-market-section-heading-copy">
                    <h2 id="create-recent-title">Недавние</h2>
                  </div>
                </div>
                <div className="create-recent-list">
                  {recent.map((item) => (
                    <CreateRow key={item.key} item={item} />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </Panel>
    </div>
  );
}
