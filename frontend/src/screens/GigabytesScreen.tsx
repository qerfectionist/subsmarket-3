import { useEffect, useMemo, useState } from "react";
import { AsyncContent } from "../components/AsyncContent";
import { SystemSymbol } from "../components/SystemSymbol";
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
import {
  GigabytesCatalogView,
  GigabytesListingDetails,
  GigabytesListingForm,
  GigabytesMyListingsView
} from "../components/marketplace";

type ScreenMode = "catalog" | "detail" | "create" | "mine";

const emptyForm: MarketplaceListingCreate = {
  operator_slug: "tele2",
  price_per_gb_kzt: 120,
  description: null
};

function screenTitle(mode: ScreenMode) {
  if (mode === "create") return "Продать гигабайты";
  if (mode === "mine") return "Мои объявления";
  return "Купить гигабайты";
}

export function GigabytesScreen({
  onBack,
  initialMode = "catalog",
  initialListingId
}: {
  onBack: () => void;
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
    setForm({ ...emptyForm, operator_slug: operators[0]?.slug ?? "tele2" });
    setMode("create");
  }

  function startEdit(listing: MarketplaceListing) {
    setEditingId(listing.id);
    setForm({
      operator_slug: listing.operator.slug,
      price_per_gb_kzt: listing.price_per_gb_kzt,
      description: listing.description ?? null
    });
    setMode("create");
  }

  async function submitListing(event: React.FormEvent) {
    event.preventDefault();
    const payload: MarketplaceListingCreate = {
      ...form,
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
        setMode("mine");
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
    </div>
  );
}
