import { useEffect, useMemo, useState } from "react";
import { Button as WorldButton } from "@worldcoin/mini-apps-ui-kit-react";
import {
  ArrowLeft,
  BadgeInfo,
  CalendarClock,
  Check,
  ChevronRight,
  CirclePause,
  MessageCircle,
  Pencil,
  Plus,
  RadioTower,
  RefreshCw,
  X
} from "lucide-react";

import { formatDate, formatError, normalizeText } from "../format";
import {
  useAcceptMarketplaceRequest,
  useArchiveMarketplaceListing,
  useCancelMarketplaceRequest,
  useCloseMarketplaceRequest,
  useCreateMarketplaceListing,
  useCreateMarketplaceRequest,
  useMarketplaceListing,
  useMarketplaceListings,
  useMarketplaceOperators,
  useMarketplacePriceInsight,
  useMarketplaceRequests,
  useMyMarketplaceListings,
  usePauseMarketplaceListing,
  useRejectMarketplaceRequest,
  useRemindMarketplaceRequest,
  useRenewMarketplaceListing,
  useResumeMarketplaceListing,
  useUpdateMarketplaceListing
} from "../hooks/useApi";
import { openTelegramUser, showTelegramConfirm } from "../telegram";
import type {
  MarketplaceListing,
  MarketplaceListingCreate,
  MarketplaceListingRequest,
  MarketplaceOperator,
  MarketplacePriceInsight,
  MarketplaceRequestRole,
  MarketplaceSort
} from "../types";

type ScreenMode = "catalog" | "detail" | "create" | "mine" | "requests";
const MINIMUM_GB_ORDER = 1;

const emptyForm: MarketplaceListingCreate = {
  operator_slug: "tele2",
  price_per_gb_kzt: 120,
  description: null
};

export function GigabytesScreen({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<ScreenMode>("catalog");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [sort, setSort] = useState<MarketplaceSort>("recent");
  const [requestRole, setRequestRole] = useState<MarketplaceRequestRole>("buyer");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MarketplaceListingCreate>(emptyForm);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const operatorsQuery = useMarketplaceOperators();
  const listingsQuery = useMarketplaceListings(operator, sort);
  const myListingsQuery = useMyMarketplaceListings();
  const listingQuery = useMarketplaceListing(mode === "detail" ? selectedId : null);
  const requestsQuery = useMarketplaceRequests(requestRole);
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
  const acceptRequestMutation = useAcceptMarketplaceRequest();
  const rejectRequestMutation = useRejectMarketplaceRequest();
  const cancelRequestMutation = useCancelMarketplaceRequest();
  const closeRequestMutation = useCloseMarketplaceRequest();
  const remindRequestMutation = useRemindMarketplaceRequest();

  const operators = operatorsQuery.data ?? [];
  const listings = listingsQuery.data ?? [];
  const myListings = myListingsQuery.data ?? [];
  const requests = requestsQuery.data ?? [];
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
    if (mode === "catalog") {
      onBack();
      return;
    }
    setMode("catalog");
    setSelectedId(null);
    setEditingId(null);
    setError(null);
    setNotice(null);
  }

  return (
    <div className="gb-screen" data-testid="gigabytes-screen">
      <header className="gb-header">
        <button type="button" className="gb-back" onClick={goBack}>
          <ArrowLeft size={20} />
          Назад
        </button>
        <div>
          <span>мобильный интернет</span>
          <h1>{screenTitle(mode)}</h1>
        </div>
      </header>

      <nav className="gb-nav" aria-label="Раздел продажи гигабайтов">
        <GbNavButton active={mode === "catalog" || mode === "detail"} onClick={() => setMode("catalog")}>
          Купить
        </GbNavButton>
        <GbNavButton active={mode === "mine"} onClick={() => setMode("mine")}>
          Мои объявления
        </GbNavButton>
        <GbNavButton active={mode === "requests"} onClick={() => setMode("requests")}>
          Заявки
        </GbNavButton>
      </nav>

      {error ? <div className="inline-error">{error}</div> : null}
      {notice ? <div className="gb-notice">{notice}</div> : null}

      {mode === "catalog" ? (
        <CatalogView
          operators={operators}
          listings={listings}
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

      {mode === "requests" ? (
        <RequestsView
          role={requestRole}
          requests={requests}
          loading={requestsQuery.isLoading}
          loadingMore={requestsQuery.isFetchingNextPage}
          hasMore={Boolean(requestsQuery.hasNextPage)}
          busy={busy}
          onRole={setRequestRole}
          onLoadMore={() => requestsQuery.fetchNextPage()}
          onAccept={(id) =>
            run("accept-request", () => acceptRequestMutation.mutateAsync(id), "Заявка принята")
          }
          onReject={(id) =>
            run(
              "reject-request",
              () => rejectRequestMutation.mutateAsync({ id }),
              "Заявка отклонена"
            )
          }
          onCancel={(id) =>
            run(
              "cancel-request",
              () => cancelRequestMutation.mutateAsync({ id }),
              "Заявка отменена"
            )
          }
          onClose={(id, outcome) =>
            run(
              "close-request",
              () => closeRequestMutation.mutateAsync({ id, outcome }),
              "Контакт убран из активных"
            )
          }
          onRemind={(id) =>
            run("remind-request", () => remindRequestMutation.mutateAsync(id), "Напоминание отправлено")
          }
        />
      ) : null}
    </div>
  );
}

function CatalogView({
  operators,
  listings,
  operator,
  sort,
  loading,
  loadingMore,
  hasMore,
  onOperator,
  onSort,
  onListing,
  onLoadMore,
  onCreate
}: {
  operators: MarketplaceOperator[] | undefined;
  listings: MarketplaceListing[];
  operator: string | null;
  sort: MarketplaceSort;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onOperator: (value: string | null) => void;
  onSort: (value: MarketplaceSort) => void;
  onListing: (id: string) => void;
  onLoadMore: () => unknown;
  onCreate: () => void;
}) {
  return (
    <section className="gb-stack">
      <div className="gb-toolbar">
        <div className="gb-chip-row">
          <button className={!operator ? "active" : ""} onClick={() => onOperator(null)} type="button">
            Все
          </button>
          {(operators ?? []).map((item) => (
            <button
              key={item.slug}
              className={operator === item.slug ? "active" : ""}
              onClick={() => onOperator(item.slug)}
              type="button"
            >
              {item.name}
            </button>
          ))}
        </div>
        <select value={sort} onChange={(event) => onSort(event.target.value as MarketplaceSort)}>
          <option value="recent">Сначала новые</option>
          <option value="price_asc">Цена: ниже</option>
          <option value="price_desc">Цена: выше</option>
        </select>
      </div>
      {loading ? <div className="gb-empty">Загружаем объявления...</div> : null}
      {!loading && listings.length === 0 ? (
        <div className="gb-empty">
          <strong>Активных объявлений пока нет</strong>
          <span>Можно опубликовать первое предложение.</span>
          <WorldButton type="button" onClick={onCreate}>Продать ГБ</WorldButton>
        </div>
      ) : (
        <div className="gb-list">
          {listings.map((listing) => (
            <ListingRow key={listing.id} listing={listing} onClick={() => onListing(listing.id)} />
          ))}
        </div>
      )}
      {hasMore ? (
        <WorldButton type="button" variant="tertiary" disabled={loadingMore} onClick={onLoadMore}>
          {loadingMore ? "Загружаем..." : "Показать ещё"}
        </WorldButton>
      ) : null}
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
  if (loading || !listing) return <div className="gb-empty">Открываем объявление...</div>;
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
      <article className="gb-detail-card">
        <div className="gb-detail-icon"><RadioTower size={28} /></div>
        <span>{listing.operator.name}</span>
        <h2>{formatKzt(listing.price_per_gb_kzt)} за 1 ГБ</h2>
        {listing.description ? <p>{listing.description}</p> : null}
      </article>
      <article className="gb-info-card">
        <div><CalendarClock size={19} /><span>Объявление до {formatDate(listing.expires_at)}</span></div>
        {listing.operator.validity_days ? (
          <div><BadgeInfo size={19} /><span>Переданные ГБ действуют {listing.operator.validity_days} дней</span></div>
        ) : null}
        {listing.operator.conditions ? <p>{listing.operator.conditions}</p> : null}
        {listing.operator.fee_note ? <p>{listing.operator.fee_note}</p> : null}
      </article>
      {!listing.is_owner ? (
        <div
          className="gb-buy-box"
        >
          <label>
            Сколько ГБ
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
          <strong>Итого: {formatKzt(totalPrice)}</strong>
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
        <>
          <div className="gb-owner-actions">
            <WorldButton variant="tertiary" onClick={() => onEdit(listing)}><Pencil size={18} />Изменить</WorldButton>
            {listing.status === "active" ? (
              <WorldButton variant="tertiary" onClick={() => onPause(listing.id)}><CirclePause size={18} />Скрыть</WorldButton>
            ) : listing.status === "paused" ? (
              <WorldButton variant="tertiary" onClick={() => onResume(listing.id)}><Check size={18} />Показать</WorldButton>
            ) : null}
            <WorldButton variant="tertiary" onClick={() => onRenew(listing.id)}><RefreshCw size={18} />Продлить</WorldButton>
            <WorldButton variant="tertiary" onClick={() => onArchive(listing.id)}><X size={18} />Убрать</WorldButton>
          </div>
        </>
      )}
      <p className="gb-safety-note">SubsMarket не принимает оплату и не подтверждает перевод ГБ. После принятия заявки продавец пишет покупателю в Telegram.</p>
    </section>
  );
}

function ListingForm({ form, operator, operators, editing, busy, priceInsight, onChange, onSubmit }: {
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
      <label>Оператор<select disabled={editing} value={form.operator_slug} onChange={(event) => onChange({ ...form, operator_slug: event.target.value })}>{operators.map((item) => <option value={item.slug} key={item.slug}>{item.name}</option>)}</select></label>
      <label>Цена за 1 ГБ, ₸<input type="number" min="1" max="1000000" value={form.price_per_gb_kzt} onChange={(event) => onChange({ ...form, price_per_gb_kzt: Number(event.target.value) })} required /></label>
      <PriceInsight insight={priceInsight} price={form.price_per_gb_kzt} />
      <label>Описание<textarea maxLength={300} rows={3} value={form.description ?? ""} placeholder="Необязательно" onChange={(event) => onChange({ ...form, description: event.target.value })} /></label>
      {operator ? <div className="gb-operator-hint">Один перевод: от {formatGb(Math.max(MINIMUM_GB_ORDER, Number(operator.min_lot_gb ?? 0)))} до {formatGb(operator.max_lot_gb)} ГБ, только целое количество.</div> : null}
      <WorldButton fullWidth type="submit" disabled={busy}>{busy ? "Сохраняем..." : editing ? "Сохранить" : "Опубликовать на 7 дней"}</WorldButton>
      <p className="gb-safety-note">Номер телефона, карту и банковские реквизиты здесь указывать нельзя.</p>
    </form>
  );
}

function PriceInsight({ insight, price }: {
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
  const verdict = price < minimum
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

function MyListingsView({ listings, loading, loadingMore, hasMore, onCreate, onOpen, onLoadMore }: {
  listings: MarketplaceListing[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onLoadMore: () => unknown;
}) {
  return <section className="gb-stack"><WorldButton fullWidth onClick={onCreate}><Plus size={18} />Продать ГБ</WorldButton>{loading ? <div className="gb-empty">Загружаем...</div> : listings.length === 0 ? <div className="gb-empty"><strong>Объявлений пока нет</strong></div> : <div className="gb-list">{listings.map((item) => <ListingRow key={item.id} listing={item} onClick={() => onOpen(item.id)} showStatus />)}</div>}{hasMore ? <WorldButton variant="tertiary" disabled={loadingMore} onClick={onLoadMore}>{loadingMore ? "Загружаем..." : "Показать ещё"}</WorldButton> : null}</section>;
}

function RequestsView({ role, requests, loading, loadingMore, hasMore, busy, onRole, onLoadMore, onAccept, onReject, onCancel, onClose, onRemind }: {
  role: MarketplaceRequestRole;
  requests: MarketplaceListingRequest[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  busy: string | null;
  onRole: (role: MarketplaceRequestRole) => void;
  onLoadMore: () => unknown;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onCancel: (id: string) => void;
  onClose: (id: string, outcome: "sold" | "not_sold") => void;
  onRemind: (id: string) => void;
}) {
  return (
    <section className="gb-stack">
      <div className="gb-role-switch">
        <button className={role === "buyer" ? "active" : ""} onClick={() => onRole("buyer")} type="button">Покупки</button>
        <button className={role === "seller" ? "active" : ""} onClick={() => onRole("seller")} type="button">Продажи</button>
      </div>
      {loading ? <div className="gb-empty">Загружаем заявки...</div> : requests.length === 0 ? <div className="gb-empty"><strong>Заявок пока нет</strong></div> : (
        <div className="gb-request-list">
          {requests.map((item) => <RequestCard key={item.id} request={item} busy={busy !== null} onAccept={onAccept} onReject={onReject} onCancel={onCancel} onClose={onClose} onRemind={onRemind} />)}
        </div>
      )}
      {hasMore ? <WorldButton variant="tertiary" disabled={loadingMore} onClick={onLoadMore}>{loadingMore ? "Загружаем..." : "Показать ещё"}</WorldButton> : null}
    </section>
  );
}

function RequestCard({ request, busy, onAccept, onReject, onCancel, onClose, onRemind }: {
  request: MarketplaceListingRequest;
  busy: boolean;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onCancel: (id: string) => void;
  onClose: (id: string, outcome: "sold" | "not_sold") => void;
  onRemind: (id: string) => void;
}) {
  return (
    <article className="gb-request-card">
      <div className="gb-request-head">
        <div><strong>{request.operator_name} · {formatGb(request.amount_gb)} ГБ</strong><span>{formatKzt(request.total_price_kzt)}</span></div>
        <em>{requestStatus(request.status)}</em>
      </div>
      {request.counterparty_username ? <p>@{request.counterparty_username}</p> : null}
      <div className="gb-request-actions">
        {request.role === "seller" && request.status === "pending" ? <><button disabled={busy} onClick={() => onAccept(request.id)} type="button"><Check size={17} />Принять</button><button disabled={busy} onClick={() => onReject(request.id)} type="button"><X size={17} />Отклонить</button></> : null}
        {request.role === "buyer" && request.status === "pending" ? <><button disabled={busy} onClick={() => onCancel(request.id)} type="button">Отменить</button><button disabled={busy || !request.can_remind} onClick={() => onRemind(request.id)} type="button"><RefreshCw size={17} />Напомнить</button></> : null}
        {request.status === "accepted" && request.counterparty_username ? <button type="button" onClick={() => openTelegramUser(request.counterparty_username!, request.telegram_draft ?? undefined)}><MessageCircle size={17} />Открыть Telegram</button> : null}
        {request.role === "seller" && request.status === "accepted" ? <><button disabled={busy} type="button" onClick={() => onClose(request.id, "sold")}><Check size={17} />Продано</button><button disabled={busy} type="button" onClick={() => onClose(request.id, "not_sold")}><X size={17} />Не состоялось</button></> : null}
      </div>
    </article>
  );
}

function ListingRow({ listing, onClick, showStatus = false }: { listing: MarketplaceListing; onClick: () => void; showStatus?: boolean }) {
  return (
    <button className="gb-listing-row" type="button" onClick={onClick}>
      <span className="gb-listing-logo">{listing.operator.name.slice(0, 2)}</span>
      <span className="gb-listing-copy">
        <strong>
          {listing.operator.name}
        </strong>
        {showStatus ? <small>{listingStatus(listing)}</small> : null}
      </span>
      <span className="gb-listing-price"><strong>{formatKzt(listing.price_per_gb_kzt)}/ГБ</strong><ChevronRight size={18} /></span>
    </button>
  );
}

function GbNavButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" className={active ? "active" : ""} onClick={onClick}>{children}</button>;
}

function screenTitle(mode: ScreenMode) {
  if (mode === "create") return "Продать гигабайты";
  if (mode === "mine") return "Мои объявления";
  if (mode === "requests") return "Заявки";
  return "Купить гигабайты";
}

function formatGb(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return Number(value).toLocaleString("ru-KZ", { maximumFractionDigits: 0 });
}
function formatKzt(value: string | number) { return `${Number(value).toLocaleString("ru-KZ")} ₸`; }
function listingStatus(listing: MarketplaceListing) {
  return ({ active: "В каталоге", paused: "Скрыто", expired: "Срок закончился", archived: "Убрано" } as const)[listing.status];
}
function requestStatus(status: MarketplaceListingRequest["status"]) { return ({ pending: "Ждёт ответа", accepted: "Можно написать", rejected: "Отклонена", cancelled: "Отменена", closed: "Закрыта", expired: "Срок истёк" } as const)[status]; }
