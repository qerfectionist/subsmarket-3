import { useEffect, useMemo, useState } from "react";
import { AsyncContent } from "../components/AsyncContent";
import { SystemSymbol } from "../components/SystemSymbol";
import { CREATE_TITLES, CreateShell } from "../components/CreateCategoryPicker";
import { useTelegramBackButton } from "../hooks/useTelegramAppEffects";
import { formatError, normalizeText } from "../format";
import {
  useArchiveMarketplaceListing,
  useCreateMarketplaceListing,
  useCreateMarketplaceRequest,
  useMarketplaceListing,
  useMarketplaceListings,
  useMarketplaceOperators,
  useMarketplacePriceInsight,
  useMyMarketplaceListings,
  usePauseMarketplaceListing,
  useRenewMarketplaceListing,
  useResumeMarketplaceListing,
  useUpdateMarketplaceListing
} from "../hooks/useApi";
import { showTelegramConfirm, triggerTelegramImpact } from "../telegram";
import type {
  MarketplaceListing,
  MarketplaceListingCreate,
  MarketplaceSort
} from "../types";
import { defaultMaxGb } from "../components/marketplace/GigabytesListingForm";
import {
  GigabytesCatalogView,
  GigabytesListingDetails,
  GigabytesListingForm,
  GigabytesMyListingsView
} from "../components/marketplace";

type ScreenMode = "catalog" | "detail" | "create" | "mine";

const emptyForm: MarketplaceListingCreate = {
  operator_slug: "tele2",
  price_per_gb_kzt: 150,
  max_gb: null,
  description: null
};

function screenTitle(mode: ScreenMode) {
  if (mode === "create") return "Продать гигабайты";
  if (mode === "mine") return "Мои объявления";
  return "Купить гигабайты";
}

export function GigabytesScreen({
  onBack,
  embedded,
  initialMode = "catalog",
  initialListingId
}: {
  onBack: () => void;
  /**
   * Set when the form is opened from «Создать»: its own title and a back arrow to the menu,
   * and after publishing the person is taken to the new listing in «Мои».
   */
  embedded?: { onPublished: () => void; operatorSlug?: string | null; repeat?: MarketplaceListing | null };
  initialMode?: "catalog" | "mine" | "create";
  initialListingId?: string | null;
}) {
  const [mode, setMode] = useState<ScreenMode>(initialListingId ? "detail" : initialMode);
  const [selectedId, setSelectedId] = useState<string | null>(initialListingId ?? null);
  const [operator, setOperator] = useState<string | null>(null);
  const [sort, setSort] = useState<MarketplaceSort | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MarketplaceListingCreate>(emptyForm);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const originMode: ScreenMode = initialListingId ? "catalog" : initialMode;

  const operatorsQuery = useMarketplaceOperators();
  const listingsQuery = useMarketplaceListings(operator, sort === "all" ? "recent" : sort);
  const myListingsQuery = useMyMarketplaceListings();
  const listingQuery = useMarketplaceListing(mode === "detail" ? selectedId : null);
  const priceInsightQuery = useMarketplacePriceInsight(
    form.operator_slug,
    mode === "create"
  );
  const createListingMutation = useCreateMarketplaceListing();
  const updateListingMutation = useUpdateMarketplaceListing();
  const pauseListingMutation = usePauseMarketplaceListing();
  const resumeListingMutation = useResumeMarketplaceListing();
  const renewListingMutation = useRenewMarketplaceListing();
  const archiveListingMutation = useArchiveMarketplaceListing();
  const createRequestMutation = useCreateMarketplaceRequest();

  const operators = operatorsQuery.data ?? [];

  // A popular operator on «Создать» opens the form with it picked.
  const presetOperator = embedded?.operatorSlug ?? null;
  const [presetApplied, setPresetApplied] = useState(false);
  useEffect(() => {
    if (presetApplied || !presetOperator || operators.length === 0) return;
    const picked = operators.find((item) => item.slug === presetOperator);
    // From «Недавние»: the same price, limit and text as last time.
    const repeat = embedded?.repeat;
    if (picked) {
      setForm(
        repeat
          ? {
              operator_slug: picked.slug,
              price_per_gb_kzt: repeat.price_per_gb_kzt,
              max_gb: repeat.max_gb ?? defaultMaxGb(picked),
              description: repeat.description ?? null
            }
          : { ...emptyForm, operator_slug: picked.slug, max_gb: defaultMaxGb(picked) }
      );
    }
    setPresetApplied(true);
  }, [embedded?.repeat, presetApplied, presetOperator, operators]);
  const listings = listingsQuery.data ?? [];
  const myListings = myListingsQuery.data ?? [];
  const selectedListing = listingQuery.data ?? null;
  const activeOperator = useMemo(
    () => operators.find((item) => item.slug === form.operator_slug) ?? null,
    [form.operator_slug, operators]
  );

  async function run(label: string, action: () => Promise<unknown>, message: string) {
    try {
      setBusy(label);
      setError(null);
      setNotice(null);
      await action();
      setNotice(message);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(null);
    }
  }

  function openListing(id: string) {
    setSelectedId(id);
    setMode("detail");
    setError(null);
    setNotice(null);
  }

  function startCreate() {
    setEditingId(null);
    const first = operators[0] ?? null;
    setForm({ ...emptyForm, operator_slug: first?.slug ?? "tele2", max_gb: defaultMaxGb(first) });
    setMode("create");
  }

  function startEdit(listing: MarketplaceListing) {
    setEditingId(listing.id);
    setForm({
      operator_slug: listing.operator.slug,
      price_per_gb_kzt: listing.price_per_gb_kzt,
      max_gb: listing.max_gb ?? defaultMaxGb(listing.operator),
      description: listing.description ?? null
    });
    setMode("create");
  }

  async function submitListing(event: React.FormEvent) {
    event.preventDefault();
    const payload: MarketplaceListingCreate = {
      ...form,
      max_gb: form.max_gb ?? defaultMaxGb(activeOperator),
      description: normalizeText(form.description)
    };
    await run(
      editingId ? "update-listing" : "create-listing",
      async () => {
        if (editingId) {
          const updated = await updateListingMutation.mutateAsync({
            id: editingId,
            payload
          });
          setSelectedId(updated.id);
          setMode("detail");
          return;
        }
        await createListingMutation.mutateAsync(payload);
        if (embedded) embedded.onPublished();
        else setMode("mine");
      },
      editingId ? "Объявление обновлено" : "Объявление опубликовано на 7 дней"
    );
  }

  function goBack() {
    if (mode === originMode) {
      onBack();
      return;
    }
    setMode(originMode);
    setSelectedId(null);
    setEditingId(null);
    setError(null);
    setNotice(null);
  }

  useTelegramBackButton(true, goBack);
  useEffect(() => {
    document.querySelector(".app-shell")?.scrollTo({ top: 0, behavior: "auto" });
  }, [mode, selectedId]);

  const body = (
    <>
      {error ? <div className="inline-error" role="alert">{error}</div> : null}
      {notice ? <div className="gb-notice" role="status">{notice}</div> : null}

      <AsyncContent
        query={
          mode === "catalog"
            ? listingsQuery
            : mode === "detail"
              ? listingQuery
              : mode === "mine"
                ? myListingsQuery
                : operatorsQuery
        }
      >
        {mode === "catalog" ? (
          <GigabytesCatalogView
            operators={operators}
            listings={listings}
            searchTerm={searchTerm}
            onSearchTerm={setSearchTerm}
            operator={operator}
            sort={sort}
            loading={listingsQuery.isLoading}
            loadingMore={listingsQuery.isFetchingNextPage}
            hasMore={Boolean(listingsQuery.hasNextPage)}
            onOperator={setOperator}
            onSort={setSort}
            onListing={openListing}
            onLoadMore={() => listingsQuery.fetchNextPage()}
            onCreate={startCreate}
            onRefresh={() => void listingsQuery.refetch()}
          />
        ) : null}

        {mode === "detail" ? (
          <GigabytesListingDetails
            listing={selectedListing}
            loading={listingQuery.isLoading}
            busy={busy}
            onBuy={(id, amountGb) =>
              run(
                "create-request",
                () => createRequestMutation.mutateAsync({ listingId: id, amountGb }),
                "Заявка отправлена продавцу"
              )
            }
            onEdit={startEdit}
            onPause={(id) =>
              run("pause-listing", () => pauseListingMutation.mutateAsync(id), "Объявление скрыто")
            }
            onResume={(id) =>
              run("resume-listing", () => resumeListingMutation.mutateAsync(id), "Объявление снова видно")
            }
            onRenew={(id) =>
              run("renew-listing", () => renewListingMutation.mutateAsync(id), "Срок продлён на 7 дней")
            }
            onArchive={async (id) => {
              const confirmed = await showTelegramConfirm(
                "Убрать объявление окончательно? Неотвеченные заявки закроются."
              );
              if (!confirmed) return;
              await run(
                "archive-listing",
                () => archiveListingMutation.mutateAsync(id),
                "Объявление убрано"
              );
              setMode("mine");
            }}
          />
        ) : null}

        {mode === "create" ? (
          <GigabytesListingForm
            form={form}
            operator={activeOperator}
            operators={operators}
            editing={Boolean(editingId)}
            busy={busy !== null}
            priceInsight={priceInsightQuery.data ?? null}
            onChange={setForm}
            onSubmit={submitListing}
          />
        ) : null}

        {mode === "mine" ? (
          <GigabytesMyListingsView
            listings={myListings}
            loading={myListingsQuery.isLoading}
            loadingMore={myListingsQuery.isFetchingNextPage}
            hasMore={Boolean(myListingsQuery.hasNextPage)}
            onCreate={startCreate}
            onOpen={openListing}
            onLoadMore={() => myListingsQuery.fetchNextPage()}
          />
        ) : null}
      </AsyncContent>
    </>
  );

  if (embedded) {
    return (
      <CreateShell title={CREATE_TITLES.gigabytes} onBack={goBack} testId="gigabytes-screen">
        {body}
      </CreateShell>
    );
  }

  return (
    <div
      className={`gb-screen sm-market-screen ${mode === "catalog" ? "sm-market-screen-catalog" : "subs-screen-scroll"}`}
      data-testid="gigabytes-screen"
    >
      {mode === "catalog" ? (
        <>
          <header className="sm-market-catalog-header">
            <h1>Гигабайты</h1>
            <button
              type="button"
              className={`sm-market-catalog-info${isInfoOpen ? " is-active" : ""}`}
              aria-label="О сделках"
              aria-expanded={isInfoOpen}
              aria-controls="gigabytes-safety-disclosure"
              data-testid="gigabytes-safety-note"
              onClick={() => {
                triggerTelegramImpact("light");
                setIsInfoOpen((prev) => !prev);
              }}
            >
              <SystemSymbol name="info.circle" size={20} />
            </button>
          </header>
          <div
            id="gigabytes-safety-disclosure"
            className={`sm-market-info-disclosure${isInfoOpen ? " is-open" : ""}`}
            aria-hidden={!isInfoOpen}
            inert={!isInfoOpen}
          >
            <div className="sm-market-info-disclosure-content">
              <div className="sm-market-alert-disclosure" data-testid="gigabytes-safety-alert">
                <div className="sm-market-alert-content">
                  <p>
                    Передача происходит напрямую между номерами. SubsMarket не принимает оплату, не хранит реквизиты и не несёт ответственности за сделки.
                  </p>
                </div>
                <button
                  type="button"
                  className="sm-market-alert-close"
                  aria-label="Закрыть памятку"
                  onClick={() => {
                    triggerTelegramImpact("light");
                    setIsInfoOpen(false);
                  }}
                >
                  <SystemSymbol name="xmark" size={14} />
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <header className="gb-header">
          <button type="button" className="gb-back" aria-label="Назад" onClick={goBack}>
            <SystemSymbol name="chevron.backward" size={20} />
          </button>
          <div className="gb-header-title-wrap">
            {mode === "detail" ? (
              <span className="gb-header-eyebrow">
                {selectedListing?.operator.name ?? "ГИГАБАЙТЫ"}
              </span>
            ) : null}
            <h1>{screenTitle(mode)}</h1>
          </div>
        </header>
      )}

      {body}
    </div>
  );
}
