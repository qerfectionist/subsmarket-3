import { useEffect, useMemo, useState } from "react";
import { AsyncContent } from "../components/AsyncContent";
import { SystemSymbol } from "../components/SystemSymbol";
import { CreateShell, type CreateCategory } from "../components/CreateCategoryPicker";
import { useTelegramBackButton } from "../hooks/useTelegramAppEffects";
import { formatError } from "../format";
import {
  useAccountListing,
  useAccountListings,
  useAccountServices,
  useArchiveAccountListing,
  useCreateAccountListing,
  useCreateAccountRequest,
  useMyAccountListings,
  usePauseAccountListing,
  useRenewAccountListing,
  useResumeAccountListing,
  useUpdateAccountListing
} from "../hooks/useApi";
import { showTelegramConfirm, triggerTelegramImpact } from "../telegram";
import type {
  AccountListing,
  AccountListingCreate,
  MarketplaceSort
} from "../types";
import {
  AccountsCatalogView,
  AccountsListingDetails,
  AccountsListingForm,
  AccountsMyListingsView,
  type AccountCategoryFilter
} from "../components/marketplace";
import { findPlan, selectionForService } from "../components/marketplace/accountPlans";

type ScreenMode = "catalog" | "detail" | "create" | "mine";

const EMPTY_FORM: AccountListingCreate = {
  service_slug: "chatgpt",
  plan_code: "plus",
  period_months: 1,
  delivery: "own_account",
  price_kzt: 3990
};

const screenTitle = (mode: ScreenMode) =>
  ({
    catalog: "Объявления аккаунтов",
    detail: "Объявление",
    create: "Объявление",
    mine: "Мои объявления"
  })[mode];

export function AccountsScreen({
  onBack,
  embedded,
  initialMode = "catalog",
  initialListingId
}: {
  onBack: () => void;
  /**
   * Set when the form is shown on «Создать»: the same header and slider as «Мои»,
   * and after publishing the person is taken to the new listing in «Мои».
   */
  embedded?: { onChangeKind: (kind: CreateCategory) => void; onPublished: () => void };
  initialMode?: "catalog" | "mine" | "create";
  initialListingId?: string | null;
}) {
  const [mode, setMode] = useState<ScreenMode>(initialListingId ? "detail" : initialMode);
  const [selectedId, setSelectedId] = useState<string | null>(initialListingId ?? null);
  const [category, setCategory] = useState<AccountCategoryFilter>("all");
  const [sort, setSort] = useState<MarketplaceSort | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountListingCreate>(EMPTY_FORM);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const originMode: ScreenMode = initialListingId ? "catalog" : initialMode;

  const servicesQuery = useAccountServices();
  const listingsQuery = useAccountListings(null, sort === "all" ? "recent" : sort);
  const myListingsQuery = useMyAccountListings();
  const listingQuery = useAccountListing(mode === "detail" ? selectedId : null);
  const createListing = useCreateAccountListing();
  const updateListing = useUpdateAccountListing();
  const pauseListing = usePauseAccountListing();
  const resumeListing = useResumeAccountListing();
  const renewListing = useRenewAccountListing();
  const archiveListing = useArchiveAccountListing();
  const createRequest = useCreateAccountRequest();

  const services = servicesQuery.data ?? [];
  const listings = listingsQuery.data ?? [];
  const myListings = myListingsQuery.data ?? [];
  const selectedListing = listingQuery.data ?? null;

  const activeService = useMemo(
    () => services.find((item) => item.slug === form.service_slug),
    [form.service_slug, services]
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
    setForm(services[0] ? selectionForService(EMPTY_FORM, services[0]) : EMPTY_FORM);
    setMode("create");
  }

  function startEdit(listing: AccountListing) {
    setEditingId(listing.id);
    const service = services.find((item) => item.slug === listing.service.slug);
    const base: AccountListingCreate = { ...EMPTY_FORM, price_kzt: listing.price_kzt };
    // Listings made before the catalog have no plan: the seller picks one now.
    const known = service && findPlan(service, listing.plan_code) && listing.period_months && listing.delivery;
    setForm(
      known
        ? {
            ...base,
            service_slug: listing.service.slug,
            plan_code: listing.plan_code ?? "",
            period_months: listing.period_months ?? 1,
            delivery: listing.delivery ?? "own_account"
          }
        : service
          ? selectionForService(base, service)
          : { ...base, service_slug: listing.service.slug }
    );
    setMode("create");
  }

  async function submitListing(event: React.FormEvent) {
    event.preventDefault();
    const payload: AccountListingCreate = { ...form };
    await run(
      editingId ? "account-update" : "account-create",
      async () => {
        if (editingId) {
          const updated = await updateListing.mutateAsync({
            id: editingId,
            payload: {
              plan_code: payload.plan_code,
              period_months: payload.period_months,
              delivery: payload.delivery,
              price_kzt: payload.price_kzt
            }
          });
          setSelectedId(updated.id);
          setMode("detail");
        } else {
          await createListing.mutateAsync(payload);
          if (embedded) embedded.onPublished();
          else setMode("mine");
        }
      },
      editingId ? "Объявление обновлено" : "Объявление опубликовано на 30 дней"
    );
  }

  function goBack() {
    if (mode === originMode) return onBack();
    setMode(originMode);
    setSelectedId(null);
    setEditingId(null);
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
                : servicesQuery
        }
      >
        {mode === "catalog" ? (
          <AccountsCatalogView
            listings={listings}
            searchTerm={searchTerm}
            onSearchTerm={setSearchTerm}
            category={category}
            sort={sort}
            loading={listingsQuery.isLoading}
            loadingMore={listingsQuery.isFetchingNextPage}
            hasMore={Boolean(listingsQuery.hasNextPage)}
            onCategory={setCategory}
            onSort={setSort}
            onListing={openListing}
            onLoadMore={() => listingsQuery.fetchNextPage()}
            onCreate={startCreate}
            onRefresh={() => void listingsQuery.refetch()}
          />
        ) : null}

        {mode === "detail" ? (
          <AccountsListingDetails
            listing={selectedListing}
            loading={listingQuery.isLoading}
            busy={busy}
            onRequest={(id) =>
              run(
                "account-request",
                () => createRequest.mutateAsync(id),
                "Запрос отправлен продавцу"
              )
            }
            onEdit={startEdit}
            onPause={(id) =>
              run(
                "account-pause",
                () => pauseListing.mutateAsync(id),
                "Объявление скрыто"
              )
            }
            onResume={(id) =>
              run(
                "account-resume",
                () => resumeListing.mutateAsync(id),
                "Объявление опубликовано"
              )
            }
            onRenew={(id) =>
              run(
                "account-renew",
                () => renewListing.mutateAsync(id),
                "Срок продлён на 30 дней"
              )
            }
            onArchive={async (id) => {
              const confirmed = await showTelegramConfirm(
                "Убрать объявление окончательно? Неотвеченные заявки закроются."
              );
              if (!confirmed) return;
              await run(
                "account-archive",
                () => archiveListing.mutateAsync(id),
                "Объявление убрано"
              );
              setMode("mine");
            }}
          />
        ) : null}

        {mode === "create" ? (
          <AccountsListingForm
            form={form}
            services={services}
            activeService={activeService}
            editing={Boolean(editingId)}
            busy={busy !== null}
            onChange={setForm}
            onSubmit={submitListing}
          />
        ) : null}

        {mode === "mine" ? (
          <AccountsMyListingsView
            listings={myListings}
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
      <CreateShell kind="accounts" onChangeKind={embedded.onChangeKind} testId="accounts-screen">
        {body}
      </CreateShell>
    );
  }

  return (
    <div
      className={`gb-screen sm-market-screen ${mode === "catalog" ? "sm-market-screen-catalog" : "subs-screen-scroll"}`}
      data-testid="accounts-screen"
    >
      {mode === "catalog" ? (
        <>
          <header className="sm-market-catalog-header">
            <h1>Аккаунты</h1>
            <button
              type="button"
              className={`sm-market-catalog-info${isInfoOpen ? " is-active" : ""}`}
              aria-label="О сделках"
              aria-expanded={isInfoOpen}
              aria-controls="accounts-safety-disclosure"
              data-testid="accounts-safety-note"
              onClick={() => {
                triggerTelegramImpact("light");
                setIsInfoOpen((prev) => !prev);
              }}
            >
              <SystemSymbol name="info.circle" size={20} />
            </button>
          </header>
          <div
            id="accounts-safety-disclosure"
            className={`sm-market-info-disclosure${isInfoOpen ? " is-open" : ""}`}
            aria-hidden={!isInfoOpen}
            inert={!isInfoOpen}
          >
            <div className="sm-market-info-disclosure-content">
              <div className="sm-market-alert-disclosure" data-testid="accounts-safety-alert">
                <div className="sm-market-alert-content">
                  <p>
                    Сделка и передача доступа происходят напрямую. SubsMarket не принимает оплату, не хранит пароли и не несёт ответственности за сделки.
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
                {selectedListing?.service.name ?? "АККАУНТ"}
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
