import { useEffect, useMemo, useState } from "react";
import { useFeedSnap } from "../hooks/useFeedSnap";
import { Button as AppButton } from "../components/ui";
import { ListingAuthor } from "../components/ListingAuthor";
import { ServiceLogo } from "../components/branding";
import { GigabytesListingCard as ListingRow } from "../components/ListingCard";
import { AsyncContent } from "../components/AsyncContent";
import { FilterMenu, type FilterMenuOption } from "../components/FilterMenu";
import { SystemSymbol } from "../components/SystemSymbol";
import { useTelegramBackButton } from "../hooks/useTelegramAppEffects";

import { formatDate, formatError, normalizeText } from "../format";
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
import { openTelegramUser, showTelegramAlert, showTelegramConfirm, triggerTelegramImpact } from "../telegram";
import type {
  MarketplaceListing,
  MarketplaceListingCreate,
  MarketplaceOperator,
  MarketplacePriceInsight,
  MarketplaceSort
} from "../types";

type ScreenMode = "catalog" | "detail" | "create" | "mine";
const MINIMUM_GB_ORDER = 1;

const emptyForm: MarketplaceListingCreate = {
  operator_slug: "tele2",
  price_per_gb_kzt: 120,
  description: null
};

const sortOptions: FilterMenuOption[] = [
  { value: "all", label: "По умолчанию" },
  { value: "recent", label: "Новое" },
  { value: "price_asc", label: "Дешевле" }
];

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
          <CatalogView
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
          <ListingDetails
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
          <ListingForm
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
          <MyListingsView
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

function CatalogView({
  operators,
  listings,
  searchTerm,
  onSearchTerm,
  operator,
  sort,
  loading,
  loadingMore,
  hasMore,
  onOperator,
  onSort,
  onListing,
  onLoadMore,
  onCreate,
  onRefresh
}: {
  operators: MarketplaceOperator[] | undefined;
  listings: MarketplaceListing[];
  searchTerm: string;
  onSearchTerm: (value: string) => void;
  operator: string | null;
  sort: MarketplaceSort | "all";
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onOperator: (value: string | null) => void;
  onSort: (value: MarketplaceSort | "all") => void;
  onListing: (id: string) => void;
  onLoadMore: () => unknown;
  onCreate: () => void;
  onRefresh?: () => void;
}) {
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isOperatorMenuOpen, setIsOperatorMenuOpen] = useState(false);
  const activeSortOption = useMemo(
    () => sortOptions.find((opt) => opt.value === sort) ?? sortOptions[0],
    [sort]
  );

  const operatorOptions: FilterMenuOption[] = useMemo(() => {
    return [
      { value: "all", label: "Все операторы", count: listings.length },
      ...(operators ?? []).map((item) => ({
        value: item.slug,
        label: item.name,
        count: listings.filter((l) => l.operator.slug === item.slug).length
      }))
    ];
  }, [listings, operators]);

  const activeOperatorOption = useMemo(
    () =>
      operatorOptions.find((opt) =>
        operator === null ? opt.value === "all" : opt.value === operator
      ) ?? operatorOptions[0],
    [operator, operatorOptions]
  );

  const displayedListings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return listings;
    return listings.filter(
      (item) =>
        item.operator.name.toLowerCase().includes(term) ||
        (item.description && item.description.toLowerCase().includes(term))
    );
  }, [listings, searchTerm]);

  const feedSnap = useFeedSnap({
    enabled: true,
    itemCount: displayedListings.length
  });

  return (
    <section className="gb-stack sm-market-catalog-stack">
      <label className="sm-market-search">
        <SystemSymbol name="magnifyingglass" size={20} />
        <input
          type="search"
          aria-label="Поиск гигабайтов"
          data-testid="gigabytes-search-input"
          placeholder="Оператор или описание"
          value={searchTerm}
          onChange={(e) => onSearchTerm(e.target.value)}
        />
        {searchTerm ? (
          <button
            type="button"
            className="sm-market-search-clear"
            aria-label="Очистить поиск"
            onClick={() => onSearchTerm("")}
          >
            <SystemSymbol name="xmark" size={18} />
          </button>
        ) : null}
      </label>

      <div className="sm-market-section-heading sm-market-section-heading-catalog">
        <div className="sm-market-section-heading-copy">
          <h2>{searchTerm ? "Результаты поиска" : "Доступные"}</h2>
          {!searchTerm && listings.length > 0 ? (
            <span className="sm-market-section-count">{listings.length}</span>
          ) : null}
        </div>
        <div className="sm-market-filter-actions">
          <button
            type="button"
            data-testid="gigabytes-operator-filter-button"
            className={`sm-market-filter-chip${operator !== null ? " is-active" : ""}`}
            aria-haspopup="menu"
            aria-expanded={isOperatorMenuOpen}
            aria-label={`Фильтр операторов: ${activeOperatorOption.label}`}
            onClick={() => {
              setIsSortMenuOpen(false);
              setIsOperatorMenuOpen((prev) => !prev);
            }}
          >
            <SystemSymbol name="sort" size={14} />
            <span>{operator ? activeOperatorOption.label : "Все"}</span>
          </button>

          <button
            type="button"
            data-testid="gigabytes-sort-button"
            aria-label="Сортировка объявлений"
            aria-haspopup="menu"
            aria-expanded={isSortMenuOpen}
            className={`sm-market-filter-chip${sort !== "all" ? " is-active" : ""}`}
            onClick={() => {
              setIsOperatorMenuOpen(false);
              setIsSortMenuOpen((prev) => !prev);
            }}
          >
            <SystemSymbol name="round-sort-vertical" size={14} className="sm-market-filter-icon-price" />
            <span>{activeSortOption.label}</span>
          </button>

          {isOperatorMenuOpen ? (
            <FilterMenu
              id="gigabytes-operator-menu"
              label="Оператор"
              options={operatorOptions}
              selectedValue={operator ?? "all"}
              testIdPrefix="gigabytes-operator-option"
              onSelect={(value) => {
                onOperator(value === "all" ? null : value);
                setIsOperatorMenuOpen(false);
              }}
              onClose={() => setIsOperatorMenuOpen(false)}
            />
          ) : null}

          {isSortMenuOpen ? (
            <FilterMenu
              id="gigabytes-sort-menu"
              label="Сортировка объявлений"
              options={sortOptions}
              selectedValue={sort}
              testIdPrefix="gigabytes-sort-option"
              onSelect={(value) => {
                onSort(value as MarketplaceSort | "all");
                setIsSortMenuOpen(false);
              }}
              onClose={() => setIsSortMenuOpen(false)}
            />
          ) : null}
        </div>
      </div>

      <div
        className="sm-market-catalog-feed-scroll"
        ref={feedSnap.containerRef}
        {...feedSnap.scrollHandlers}
      >
        {loading ? (
          <div className="sm-market-family-list" aria-label="Загружаем объявления" role="status">
            {[0, 1, 2].map((n) => (
              <div key={n} className="sm-listing-skeleton" aria-hidden>
                <span />
                <div />
                <span />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && displayedListings.length === 0 ? (
          <div className="sm-market-empty" data-testid="gigabytes-catalog-empty">
            <SystemSymbol name="magnifyingglass" size={28} />
            <h3>{searchTerm ? "Ничего не найдено" : "Доступных гигабайтов пока нет"}</h3>
            <p>
              {searchTerm
                ? "Попробуйте изменить поисковый запрос или сбросить фильтры."
                : "Можно опубликовать первое предложение или вернуться позже."}
            </p>
            <div className="sm-market-empty-actions">
              <button
                type="button"
                className="sm-market-button sm-market-button-secondary"
                onClick={() => (searchTerm ? onSearchTerm("") : void onRefresh?.())}
              >
                {searchTerm ? "Сбросить поиск" : "Обновить"}
              </button>
              {!searchTerm ? (
                <button
                  type="button"
                  className="sm-market-button sm-market-button-primary"
                  onClick={onCreate}
                >
                  Продать ГБ
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="sm-market-family-list">
            {displayedListings.map((listing) => (
              <ListingRow key={listing.id} listing={listing} onClick={() => onListing(listing.id)} />
            ))}
          </div>
        )}

        {hasMore ? (
          <AppButton type="button" variant="tertiary" fullWidth disabled={loadingMore} onClick={onLoadMore}>
            {loadingMore ? "Загружаем…" : "Показать ещё"}
          </AppButton>
        ) : null}
      </div>
    </section>
  );
}

function ListingDetails({
  listing,
  loading,
  busy,
  onBuy,
  onEdit,
  onPause,
  onResume,
  onRenew,
  onArchive
}: {
  listing: MarketplaceListing | null;
  loading: boolean;
  busy: string | null;
  onBuy: (id: string, amountGb: string) => Promise<void>;
  onEdit: (listing: MarketplaceListing) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRenew: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const [amountGb, setAmountGb] = useState("5");
  useEffect(() => setAmountGb("5"), [listing?.id]);
  if (loading || !listing) {
    return (
      <div className="gb-empty sm-market-empty">
        <SystemSymbol name="clock" size={28} />
        <h3>Открываем объявление...</h3>
      </div>
    );
  }

  const minimumAmount = Math.max(
    MINIMUM_GB_ORDER,
    Number(listing.operator.min_lot_gb ?? 0)
  );
  const selectedAmount = amountGb;
  const totalPrice = Math.round(
    Number(selectedAmount) * listing.price_per_gb_kzt
  );

  return (
    <section className="gb-stack">
      <article className="gb-detail-card family-overview-card" data-testid="gigabytes-detail-card">
        <div className="gb-detail-head family-overview-head">
          <ServiceLogo
            serviceSlug={listing.operator.slug + "-family-tariff"}
            serviceName={listing.operator.name}
            size={48}
          />
          <div className="gb-detail-title-block">
            <span className="gb-detail-service-name">{listing.operator.name}</span>
            <h2 className="gb-detail-price">{formatKzt(listing.price_per_gb_kzt)} за 1 ГБ</h2>
          </div>
        </div>

        {listing.description ? (
          <div className="gb-detail-description">
            <p>{listing.description}</p>
          </div>
        ) : null}

        <ListingAuthor className="gb-detail-author" owner={listing.owner} />
      </article>

      <article className="gb-info-card">
        <div className="gb-info-row">
          <SystemSymbol name="calendar" size={17} />
          <span>Объявление до {formatDate(listing.expires_at)}</span>
        </div>
        {listing.operator.validity_days ? (
          <div className="gb-info-row">
            <SystemSymbol name="info.circle" size={17} />
            <span>Переданные ГБ действуют {listing.operator.validity_days} дней</span>
          </div>
        ) : null}
        {listing.operator.conditions ? (
          <div className="gb-info-note">
            <p>{listing.operator.conditions}</p>
          </div>
        ) : null}
        {listing.operator.fee_note ? (
          <div className="gb-info-note">
            <p>{listing.operator.fee_note}</p>
          </div>
        ) : null}
      </article>

      {!listing.is_owner ? (
        <div className="gb-buy-box">
          <label className="ui-field">
            <span>Сколько ГБ</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={selectedAmount}
              onKeyDown={(event) => {
                if (event.key.length === 1 && !/\d/.test(event.key)) {
                  event.preventDefault();
                }
              }}
              onChange={(event) => {
                const integerValue = event.target.value.match(/^\d*/)?.[0] ?? "";
                setAmountGb(integerValue);
              }}
            />
          </label>

          <div className="gb-amount-presets" aria-label="Быстрый выбор количества">
            {[3, 5, 10].map((amount) => (
              <button
                key={amount}
                type="button"
                className={selectedAmount === String(amount) ? "active" : ""}
                onClick={() => setAmountGb(String(amount))}
              >
                {amount} ГБ
              </button>
            ))}
          </div>

          <div className="gb-total-price">
            <strong>Итого: {formatKzt(totalPrice)}</strong>
          </div>

          <button
            className="gb-primary-button"
            data-testid="marketplace-submit-request"
            type="button"
            disabled={
              busy !== null ||
              listing.status !== "active" ||
              !Number.isInteger(Number(selectedAmount)) ||
              Number(selectedAmount) < minimumAmount ||
              (listing.operator.max_lot_gb !== null &&
                Number(selectedAmount) > Number(listing.operator.max_lot_gb))
            }
            onClick={() => {
              void onBuy(listing.id, selectedAmount);
            }}
          >
            Отправить заявку
          </button>
        </div>
      ) : (
        <div className="gb-owner-actions">
          <AppButton variant="tertiary" disabled={busy !== null} onClick={() => onEdit(listing)}>
            <SystemSymbol name="pencil" size={18} />
            Изменить
          </AppButton>
          {listing.status === "active" ? (
            <AppButton variant="tertiary" disabled={busy !== null} onClick={() => onPause(listing.id)}>
              <SystemSymbol name="pause.circle" size={18} />
              Скрыть
            </AppButton>
          ) : listing.status === "paused" ? (
            <AppButton variant="tertiary" disabled={busy !== null} onClick={() => onResume(listing.id)}>
              <SystemSymbol name="checkmark" size={18} />
              Показать
            </AppButton>
          ) : null}
          {listing.can_renew ? (
            <AppButton variant="tertiary" disabled={busy !== null} onClick={() => onRenew(listing.id)}>
              <SystemSymbol name="arrow.clockwise" size={18} />
              Продлить
            </AppButton>
          ) : null}
          <AppButton variant="tertiary" disabled={busy !== null} onClick={() => onArchive(listing.id)}>
            <SystemSymbol name="xmark" size={18} />
            Убрать
          </AppButton>
        </div>
      )}
      <p className="gb-safety-note">
        SubsMarket не принимает оплату и не подтверждает перевод ГБ. После принятия заявки продавец пишет покупателю в Telegram.
      </p>
    </section>
  );
}

function ListingForm({
  form,
  operator,
  operators,
  editing,
  busy,
  priceInsight,
  onChange,
  onSubmit
}: {
  form: MarketplaceListingCreate;
  operator: MarketplaceOperator | null;
  operators: MarketplaceOperator[];
  editing: boolean;
  busy: boolean;
  priceInsight: MarketplacePriceInsight | null;
  onChange: (value: MarketplaceListingCreate) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <form className="gb-form" onSubmit={onSubmit}>
      <label className="ui-field">
        <span>Оператор</span>
        <select
          disabled={editing}
          value={form.operator_slug}
          onChange={(event) => onChange({ ...form, operator_slug: event.target.value })}
        >
          {operators.map((item) => (
            <option value={item.slug} key={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      <label className="ui-field">
        <span>Цена за 1 ГБ, ₸</span>
        <input
          type="number"
          min="1"
          max="1000000"
          value={form.price_per_gb_kzt}
          onChange={(event) =>
            onChange({ ...form, price_per_gb_kzt: Number(event.target.value) })
          }
          required
        />
      </label>

      <PriceInsight insight={priceInsight} price={form.price_per_gb_kzt} />

      <label className="ui-field">
        <span>Описание</span>
        <textarea
          maxLength={300}
          rows={3}
          value={form.description ?? ""}
          placeholder="Необязательно"
          onChange={(event) => onChange({ ...form, description: event.target.value })}
        />
      </label>

      {operator ? (
        <div className="gb-operator-hint">
          Один перевод: от {formatGb(Math.max(MINIMUM_GB_ORDER, Number(operator.min_lot_gb ?? 0)))} до {formatGb(operator.max_lot_gb)} ГБ, только целое количество.
        </div>
      ) : null}

      <AppButton fullWidth type="submit" disabled={busy}>
        {busy ? "Сохраняем..." : editing ? "Сохранить" : "Опубликовать на 7 дней"}
      </AppButton>
      <p className="gb-safety-note">
        Номер телефона, карту и банковские реквизиты здесь указывать нельзя.
      </p>
    </form>
  );
}

function PriceInsight({
  insight,
  price
}: {
  insight: MarketplacePriceInsight | null;
  price: number;
}) {
  if (!insight) return null;
  const minimum = insight.typical_min_price_per_gb_kzt;
  const maximum = insight.typical_max_price_per_gb_kzt;
  const median = insight.median_price_per_gb_kzt;
  if (insight.sample_size < 5 || minimum == null || maximum == null || median == null) {
    return (
      <div className="gb-price-insight neutral">
        Пока недостаточно объявлений для сравнения цены.
      </div>
    );
  }
  const verdict =
    price < minimum
      ? "Цена ниже обычной"
      : price > maximum
        ? "Цена выше обычной"
        : "Цена в обычном диапазоне";
  return (
    <div className="gb-price-insight">
      <strong>{verdict}</strong>
      <span>
        Обычно {formatKzt(minimum)}–{formatKzt(maximum)} за 1 ГБ · медиана {formatKzt(median)}
      </span>
    </div>
  );
}

function MyListingsView({
  listings,
  loading,
  loadingMore,
  hasMore,
  onCreate,
  onOpen,
  onLoadMore
}: {
  listings: MarketplaceListing[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onLoadMore: () => unknown;
}) {
  return (
    <section className="gb-stack">
      <AppButton fullWidth onClick={onCreate}>
        <SystemSymbol name="plus" size={18} />
        Продать ГБ
      </AppButton>
      {loading ? (
        <div className="sm-market-family-list" aria-label="Загружаем" role="status">
          {[0, 1].map((n) => (
            <div key={n} className="sm-listing-skeleton" aria-hidden>
              <span />
              <div />
              <span />
            </div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="gb-empty sm-market-empty">
          <SystemSymbol name="clipboard.list" size={28} />
          <h3>Объявлений пока нет</h3>
          <p>Ваши предложения появятся здесь.</p>
        </div>
      ) : (
        <div className="sm-market-family-list">
          {listings.map((item) => (
            <ListingRow key={item.id} listing={item} onClick={() => onOpen(item.id)} showStatus />
          ))}
        </div>
      )}
      {hasMore ? (
        <AppButton variant="tertiary" fullWidth disabled={loadingMore} onClick={onLoadMore}>
          {loadingMore ? "Загружаем…" : "Показать ещё"}
        </AppButton>
      ) : null}
    </section>
  );
}

function screenTitle(mode: ScreenMode) {
  if (mode === "create") return "Продать гигабайты";
  if (mode === "mine") return "Мои объявления";
  return "Купить гигабайты";
}

function formatKzt(value: number) {
  return `${value.toLocaleString("ru-KZ")} ₸`;
}

function formatGb(value: number | string | null | undefined) {
  if (value == null) return "0";
  return `${Number(value).toLocaleString("ru-KZ")}`;
}
