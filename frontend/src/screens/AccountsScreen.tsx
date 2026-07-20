import { useMemo, useState } from "react";
import { Button as WorldButton } from "@worldcoin/mini-apps-ui-kit-react";
import {
  ArrowLeft,
  Check,
  CirclePause,
  KeyRound,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  X
} from "lucide-react";

import { formatDate, formatError, normalizeText } from "../format";
import {
  useAcceptAccountRequest,
  useAccountListing,
  useAccountListings,
  useAccountRequests,
  useAccountServices,
  useArchiveAccountListing,
  useCancelAccountRequest,
  useCloseAccountRequest,
  useCreateAccountListing,
  useCreateAccountRequest,
  useMyAccountListings,
  usePauseAccountListing,
  useRejectAccountRequest,
  useRemindAccountRequest,
  useRenewAccountListing,
  useResumeAccountListing,
  useUpdateAccountListing
} from "../hooks/useApi";
import { openTelegramUser, showTelegramConfirm } from "../telegram";
import type {
  AccountListing,
  AccountListingCreate,
  AccountRequest,
  MarketplaceRequestRole,
  MarketplaceSort
} from "../types";

type ScreenMode = "catalog" | "detail" | "create" | "mine" | "requests";
const EMPTY_FORM: AccountListingCreate = {
  service_slug: "chatgpt",
  title: "",
  price_kzt: 3990,
  description: null
};

export function AccountsScreen({
  onBack,
  initialMode = "catalog",
  initialRequestRole = "buyer"
}: {
  onBack: () => void;
  initialMode?: "catalog" | "requests";
  initialRequestRole?: MarketplaceRequestRole;
}) {
  const [mode, setMode] = useState<ScreenMode>(initialMode);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [service, setService] = useState<string | null>(null);
  const [sort, setSort] = useState<MarketplaceSort>("recent");
  const [requestRole, setRequestRole] =
    useState<MarketplaceRequestRole>(initialRequestRole);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountListingCreate>(EMPTY_FORM);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const servicesQuery = useAccountServices();
  const listingsQuery = useAccountListings(service, sort);
  const myListingsQuery = useMyAccountListings();
  const listingQuery = useAccountListing(mode === "detail" ? selectedId : null);
  const requestsQuery = useAccountRequests(requestRole);
  const createListing = useCreateAccountListing();
  const updateListing = useUpdateAccountListing();
  const pauseListing = usePauseAccountListing();
  const resumeListing = useResumeAccountListing();
  const renewListing = useRenewAccountListing();
  const archiveListing = useArchiveAccountListing();
  const createRequest = useCreateAccountRequest();
  const acceptRequest = useAcceptAccountRequest();
  const rejectRequest = useRejectAccountRequest();
  const cancelRequest = useCancelAccountRequest();
  const closeRequest = useCloseAccountRequest();
  const remindRequest = useRemindAccountRequest();
  const services = servicesQuery.data ?? [];
  const listings = listingsQuery.data ?? [];
  const myListings = myListingsQuery.data ?? [];
  const requests = requestsQuery.data ?? [];
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
    setForm({ ...EMPTY_FORM, service_slug: services[0]?.slug ?? "chatgpt" });
    setMode("create");
  }

  function startEdit(listing: AccountListing) {
    setEditingId(listing.id);
    setForm({
      service_slug: listing.service.slug,
      title: listing.title,
      price_kzt: listing.price_kzt,
      description: listing.description ?? null
    });
    setMode("create");
  }

  async function submitListing(event: React.FormEvent) {
    event.preventDefault();
    const payload: AccountListingCreate = {
      ...form,
      title: form.title.trim(),
      description: normalizeText(form.description)
    };
    await run(
      editingId ? "account-update" : "account-create",
      async () => {
        if (editingId) {
          const updated = await updateListing.mutateAsync({
            id: editingId,
            payload: {
              title: payload.title,
              price_kzt: payload.price_kzt,
              description: payload.description
            }
          });
          setSelectedId(updated.id);
          setMode("detail");
        } else {
          await createListing.mutateAsync(payload);
          setMode("mine");
        }
      },
      editingId ? "Объявление обновлено" : "Объявление опубликовано на 30 дней"
    );
  }

  function goBack() {
    if (mode === "catalog") return onBack();
    setMode("catalog");
    setSelectedId(null);
    setEditingId(null);
  }

  return (
    <div className="gb-screen" data-testid="accounts-screen">
      <header className="gb-header">
        <button type="button" className="gb-back" onClick={goBack}>
          <ArrowLeft size={20} />Назад
        </button>
        <div><span>аккаунты и доступы</span><h1>{screenTitle(mode)}</h1></div>
      </header>
      <nav className="gb-nav" aria-label="Раздел аккаунтов">
        <NavButton active={mode === "catalog" || mode === "detail"} onClick={() => setMode("catalog")}>Купить</NavButton>
        <NavButton active={mode === "mine"} onClick={() => setMode("mine")}>Мои объявления</NavButton>
        <NavButton active={mode === "requests"} onClick={() => setMode("requests")}>Заявки</NavButton>
      </nav>
      {error ? <div className="inline-error">{error}</div> : null}
      {notice ? <div className="gb-notice">{notice}</div> : null}

      {mode === "catalog" ? (
        <section className="gb-stack">
          <div className="gb-toolbar">
            <div className="gb-chip-row">
              <button className={!service ? "active" : ""} onClick={() => setService(null)} type="button">Все</button>
              {services.map((item) => <button key={item.slug} className={service === item.slug ? "active" : ""} onClick={() => setService(item.slug)} type="button">{item.name}</button>)}
            </div>
            <select value={sort} onChange={(event) => setSort(event.target.value as MarketplaceSort)}>
              <option value="recent">Сначала новые</option>
              <option value="price_asc">Цена: ниже</option>
              <option value="price_desc">Цена: выше</option>
            </select>
          </div>
          {listingsQuery.isLoading ? <div className="gb-empty">Загружаем...</div> : listings.length === 0 ? (
            <div className="gb-empty"><strong>Объявлений пока нет</strong><span>Можно опубликовать первое предложение.</span><WorldButton onClick={startCreate}>Продать аккаунт</WorldButton></div>
          ) : <div className="gb-list">{listings.map((item) => <ListingRow key={item.id} listing={item} onClick={() => openListing(item.id)} />)}</div>}
          {listingsQuery.hasNextPage ? <WorldButton variant="tertiary" disabled={listingsQuery.isFetchingNextPage} onClick={() => listingsQuery.fetchNextPage()}>Показать ещё</WorldButton> : null}
        </section>
      ) : null}

      {mode === "detail" ? (
        selectedListing ? <section className="gb-stack">
          <article className="gb-detail-card"><div className="gb-detail-icon"><KeyRound size={28} /></div><span>{selectedListing.service.name}</span><h2>{selectedListing.title}</h2><strong>{formatKzt(selectedListing.price_kzt)}</strong>{selectedListing.description ? <p>{selectedListing.description}</p> : null}<small>Объявление до {formatDate(selectedListing.expires_at)}</small></article>
          {!selectedListing.is_owner ? <div className="gb-buy-box"><button className="gb-primary-button" data-testid="account-submit-request" disabled={busy !== null || selectedListing.status !== "active"} onClick={() => run("account-request", () => createRequest.mutateAsync(selectedListing.id), "Заявка отправлена продавцу")} type="button">Купить</button></div> : <div className="gb-owner-actions"><WorldButton variant="tertiary" onClick={() => startEdit(selectedListing)}><Pencil size={18} />Изменить</WorldButton>{selectedListing.status === "active" ? <WorldButton variant="tertiary" onClick={() => run("account-pause", () => pauseListing.mutateAsync(selectedListing.id), "Объявление скрыто")}><CirclePause size={18} />Скрыть</WorldButton> : selectedListing.status === "paused" ? <WorldButton variant="tertiary" onClick={() => run("account-resume", () => resumeListing.mutateAsync(selectedListing.id), "Объявление опубликовано") }><Check size={18} />Показать</WorldButton> : null}{selectedListing.can_renew ? <WorldButton variant="tertiary" onClick={() => run("account-renew", () => renewListing.mutateAsync(selectedListing.id), "Срок продлён на 30 дней")}><RefreshCw size={18} />Продлить</WorldButton> : null}<WorldButton variant="tertiary" onClick={async () => { if (await showTelegramConfirm("Убрать объявление? Неотвеченные заявки закроются.")) { await run("account-archive", () => archiveListing.mutateAsync(selectedListing.id), "Объявление убрано"); setMode("mine"); } }}><X size={18} />Убрать</WorldButton></div>}
          <p className="gb-safety-note">SubsMarket не принимает оплату и не передаёт аккаунт. После принятия заявки продавец пишет покупателю в Telegram.</p>
        </section> : <div className="gb-empty">Открываем объявление...</div>
      ) : null}

      {mode === "create" ? <form className="gb-form" onSubmit={submitListing}>
        <label>Сервис<select disabled={Boolean(editingId)} value={form.service_slug} onChange={(event) => setForm({ ...form, service_slug: event.target.value })}>{services.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label>
        <label>Что продаёте<input maxLength={100} value={form.title} placeholder={`${activeService?.name ?? "Сервис"} на месяц`} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
        <label>Цена, ₸<input type="number" min="1" max="10000000" value={form.price_kzt} onChange={(event) => setForm({ ...form, price_kzt: Number(event.target.value) })} required /></label>
        <label>Описание<textarea rows={3} maxLength={500} value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Необязательно" /></label>
        <WorldButton fullWidth type="submit" disabled={busy !== null || form.title.trim().length < 2}>{editingId ? "Сохранить" : "Опубликовать на 30 дней"}</WorldButton>
        <p className="gb-safety-note">Не указывайте логин, пароль, номер карты или банковские реквизиты.</p>
      </form> : null}

      {mode === "mine" ? <section className="gb-stack"><WorldButton fullWidth onClick={startCreate}><Plus size={18} />Продать аккаунт</WorldButton>{myListings.length === 0 ? <div className="gb-empty"><strong>Объявлений пока нет</strong></div> : <div className="gb-list">{myListings.map((item) => <ListingRow key={item.id} listing={item} onClick={() => openListing(item.id)} showStatus />)}</div>}{myListingsQuery.hasNextPage ? <WorldButton variant="tertiary" disabled={myListingsQuery.isFetchingNextPage} onClick={() => myListingsQuery.fetchNextPage()}>Показать ещё</WorldButton> : null}</section> : null}

      {mode === "requests" ? <section className="gb-stack"><div className="gb-role-switch"><button className={requestRole === "buyer" ? "active" : ""} onClick={() => setRequestRole("buyer")} type="button">Покупки</button><button className={requestRole === "seller" ? "active" : ""} onClick={() => setRequestRole("seller")} type="button">Продажи</button></div>{requests.length === 0 ? <div className="gb-empty"><strong>Заявок пока нет</strong></div> : <div className="gb-request-list">{requests.map((request) => <RequestCard key={request.id} request={request} busy={busy !== null} onAccept={(id) => run("account-accept", () => acceptRequest.mutateAsync(id), "Заявка принята")} onReject={(id) => run("account-reject", () => rejectRequest.mutateAsync({ id }), "Заявка отклонена")} onCancel={(id) => run("account-cancel", () => cancelRequest.mutateAsync({ id }), "Заявка отменена")} onRemind={(id) => run("account-remind", () => remindRequest.mutateAsync(id), "Напоминание отправлено")} onClose={(id, outcome) => run("account-close", () => closeRequest.mutateAsync({ id, outcome }), "Заявка закрыта")} />)}</div>}{requestsQuery.hasNextPage ? <WorldButton variant="tertiary" disabled={requestsQuery.isFetchingNextPage} onClick={() => requestsQuery.fetchNextPage()}>Показать ещё</WorldButton> : null}</section> : null}
    </div>
  );
}

function ListingRow({ listing, onClick, showStatus = false }: { listing: AccountListing; onClick: () => void; showStatus?: boolean }) {
  return <button className="gb-listing-row" type="button" onClick={onClick}><span className="gb-listing-logo"><KeyRound size={22} /></span><span className="gb-listing-copy"><strong>{listing.title}</strong><small>{listing.service.name}{showStatus ? ` · ${listingStatus(listing.status)}` : ""}</small></span><span className="gb-listing-price"><strong>{formatKzt(listing.price_kzt)}</strong><small>за доступ</small></span></button>;
}

function RequestCard({ request, busy, onAccept, onReject, onCancel, onRemind, onClose }: { request: AccountRequest; busy: boolean; onAccept: (id: string) => void; onReject: (id: string) => void; onCancel: (id: string) => void; onRemind: (id: string) => void; onClose: (id: string, outcome: "sold" | "not_sold") => void }) {
  return <article className="gb-request-card"><div className="gb-request-head"><div><strong>{request.title}</strong><span>{request.service_name} · {formatKzt(request.price_kzt)}</span></div><em>{requestStatus(request.status)}</em></div>{request.counterparty_username ? <p>@{request.counterparty_username}</p> : null}<div className="gb-request-actions">{request.role === "seller" && request.status === "pending" ? <><button disabled={busy} onClick={() => onAccept(request.id)} type="button"><Check size={17} />Принять</button><button disabled={busy} onClick={() => onReject(request.id)} type="button"><X size={17} />Отклонить</button></> : null}{request.role === "buyer" && request.status === "pending" ? <><button disabled={busy} onClick={() => onCancel(request.id)} type="button">Отменить</button><button disabled={busy || !request.can_remind} onClick={() => onRemind(request.id)} type="button"><RefreshCw size={17} />Напомнить</button></> : null}{request.status === "accepted" && request.counterparty_username ? <button type="button" onClick={() => openTelegramUser(request.counterparty_username!, request.telegram_draft ?? undefined)}><MessageCircle size={17} />Написать</button> : null}{request.role === "buyer" && request.status === "accepted" ? <button disabled={busy} onClick={() => onCancel(request.id)} type="button">Отменить</button> : null}{request.role === "seller" && request.status === "accepted" ? <><button disabled={busy} onClick={() => onClose(request.id, "sold")} type="button">Продано</button><button disabled={busy} onClick={() => onClose(request.id, "not_sold")} type="button">Не продано</button></> : null}</div></article>;
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={active ? "active" : ""} onClick={onClick} type="button">{children}</button>;
}

const formatKzt = (value: number) => `${new Intl.NumberFormat("ru-RU").format(value)} ₸`;
const screenTitle = (mode: ScreenMode) => ({ catalog: "Купить аккаунт", detail: "Объявление", create: "Объявление", mine: "Мои объявления", requests: "Заявки" })[mode];
const listingStatus = (status: AccountListing["status"]) => ({ active: "активно", paused: "скрыто", expired: "истекло", archived: "убрано" })[status];
const requestStatus = (status: AccountRequest["status"]) => ({ pending: "ожидает", accepted: "принята", rejected: "отклонена", cancelled: "отменена", closed: "закрыта", expired: "истекла" })[status];
