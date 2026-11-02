import { useState } from "react";
import { Panel } from "./layout";
import { SystemSymbol } from "./SystemSymbol";
import { MarketSearchField } from "./market/MarketSearchField";
import { CreateFeed } from "./CreateFeed";
import { CreateRecentSection } from "./CreateRecentSection";
import { CreateTicker } from "./CreateTicker";
import { CreateDraftsCount, CreateDraftsSheet, CreateDraftUndo } from "./CreateDraftsSheet";
import type { CreateFamilyDraft } from "../hooks/useCreateFamilyDraft";
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
  type CreateHomeActions
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

/**
 * «Создать»: a search across everything that can be created, the four kinds,
 * and what this person created before, so a repeat takes one tap.
 */
export function CreateHome({
  services,
  myFamilies,
  onOpen,
  drafts = [],
  onResumeDraft,
  onDiscardDraft,
  onRestoreDraft,
  ...actions
}: CreateHomeActions & {
  services: FamilyService[];
  myFamilies: MyFamily[];
  onOpen: (kind: CreateCategory) => void;
  /** Families left half-made on this device, newest first. */
  drafts?: CreateFamilyDraft[];
  onResumeDraft?: (draft: CreateFamilyDraft) => void;
  onDiscardDraft?: (id: string) => void;
  /** Undo of a delete. */
  onRestoreDraft?: (draft: CreateFamilyDraft) => void;
}) {
  const [query, setQuery] = useState("");
  // The kind whose drafts are shown in the sheet.
  const [draftsKind, setDraftsKind] = useState<"subscription" | "tariff" | null>(null);
  // The draft just deleted, while «Вернуть» is on screen.
  const [deletedDraft, setDeletedDraft] = useState<CreateFamilyDraft | null>(null);
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
  // Drafts by kind, only those whose service is still in the catalog.
  const draftsOf = (kind: CreateCategory) =>
    kind === "subscription" || kind === "tariff"
      ? drafts.filter(
          (item) => item.familyType === kind && services.some((service) => service.id === item.form.service_id)
        )
      : [];
  const found = searching ? searchCreateItems(query, { services, accountServices, operators }, actions) : [];
  const recent = searching
    ? []
    : recentCreateItems({ families: myFamilies, accountListings, gigabyteListings }, actions);

  return (
    <div className="create-screen create-home" data-testid="create-home">
      <Panel title="Что создаём?" description={<CreateTicker />}>
        <MarketSearchField
          ariaLabel="Найти, что создать"
          testId="create-search"
          placeholder="Сервис, оператор или аккаунт"
          value={query}
          onChange={setQuery}
          // Enter only closes the keyboard.
          onEnter={(input) => input.blur()}
        />

        {searching && found.length === 0 ? (
          <div className="sm-market-empty create-results-empty" data-testid="create-search-empty">
            <SystemSymbol name="magnifyingglass" size={28} />
            <h3>Ничего не найдено</h3>
            <p>Попробуйте другое название сервиса, оператора или аккаунта.</p>
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
        ) : searching ? (
          <CreateFeed items={found} testId="create-search-results" resetKey={query} />
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
                    // A kind with drafts asks first: one of them, or a new one.
                    if (draftsOf(kind).length > 0 && (kind === "subscription" || kind === "tariff")) setDraftsKind(kind);
                    else onOpen(kind);
                  }}
                >
                  <span className="create-kind-icon" aria-hidden="true">
                    <SystemSymbol name={KIND_ICONS[kind]} size={24} />
                  </span>
                  <span className="create-kind-copy">
                    <strong>{CREATE_TITLES[kind]}</strong>
                    {descriptions[kind] ? <span>{descriptions[kind]}</span> : null}
                  </span>
                  {draftsOf(kind).length > 0 ? <CreateDraftsCount count={draftsOf(kind).length} /> : null}
                  <SystemSymbol name="chevron.forward" size={18} />
                </button>
              ))}
            </div>

            {recent.length > 0 ? <CreateRecentSection items={recent} /> : null}
          </>
        )}
      </Panel>
      {draftsKind && onResumeDraft && onDiscardDraft ? (
        <CreateDraftsSheet
          drafts={draftsOf(draftsKind)}
          totalDrafts={drafts.length}
          services={services}
          onResume={(item) => {
            setDraftsKind(null);
            onResumeDraft(item);
          }}
          onDiscard={(item) => {
            onDiscardDraft(item.id);
            setDeletedDraft(item);
          }}
          onCreateNew={() => {
            const kind = draftsKind;
            setDraftsKind(null);
            onOpen(kind);
          }}
          onClose={() => setDraftsKind(null)}
        />
      ) : null}
      {deletedDraft && onRestoreDraft ? (
        <CreateDraftUndo
          key={deletedDraft.id}
          onUndo={() => {
            onRestoreDraft(deletedDraft);
            setDeletedDraft(null);
          }}
          onDone={() => setDeletedDraft(null)}
        />
      ) : null}
    </div>
  );
}
