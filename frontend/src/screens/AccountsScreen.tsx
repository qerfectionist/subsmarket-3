import { useEffect, useMemo, useState } from "react";
import { Button as AppButton } from "../components/ui";
import { ListingAuthor } from "../components/ListingAuthor";
import { ServiceLogo } from "../components/branding";
import { AccountListingCard as ListingRow } from "../components/ListingCard";
import { AsyncContent } from "../components/AsyncContent";
import { SystemSymbol } from "../components/SystemSymbol";
import { useTelegramBackButton } from "../hooks/useTelegramAppEffects";

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
  initialRequestRole = "buyer",
  initialListingId
}: {
  onBack: () => void;
  initialMode?: "catalog" | "requests" | "mine" | "create";
  initialRequestRole?: MarketplaceRequestRole;
  initialListingId?: string | null;
}) {
  const [mode, setMode] = useState<ScreenMode>(initialListingId ? "detail" : initialMode);
  const [selectedId, setSelectedId] = useState<string | null>(initialListingId ?? null);
  const [service, setService] = useState<string | null>(null);
  const [sort, setSort] = useState<MarketplaceSort>("recent");
  const [requestRole, setRequestRole] =
    useState<MarketplaceRequestRole>(initialRequestRole);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountListingCreate>(EMPTY_FORM);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const originMode: ScreenMode = initialListingId ? "catalog" : initialMode;

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
    if (mode === originMode) return onBack();
    setMode(originMode);
    setSelectedId(null);
    setEditingId(null);
  }

  useTelegramBackButton(true, goBack);
  useEffect(() => {
    document.querySelector(".app-shell")?.scrollTo({ top: 0, behavior: "auto" });
  }, [mode, selectedId]);

  return (
    <div className="gb-screen" data-testid="accounts-screen">
      <header className="gb-header">
        <button type="button" className="gb-back" aria-label="Назад" onClick={goBack}>
          <SystemSymbol name="arrow.left" size={20} />
        </button>
        <div><h1>{screenTitle(mode)}</h1></div>
      </header>
      {error ? <div className="inline-error" role="alert">{error}</div> : null}
      {notice ? <div className="gb-notice" role="status">{notice}</div> : null}

      <AsyncContent query={mode === "catalog" ? listingsQuery : mode === "detail" ? listingQuery : mode === "mine" ? myListingsQuery : mode === "requests" ? requestsQuery : servicesQuery}>

      {mode === "catalog" ? (
        <section className="gb-stack">
          <p className="gb-safety-note">Доска объявлений: SubsMarket не принимает оплату, не передаёт аккаунты и не гарантирует результат сделки.</p>
          <div className="gb-toolbar">
            <div className="gb-chip-row">
              <button className={!service ? "active" : ""} onClick={() => setService(null)} type="button">Все</button>
              {services.map((item) => <button key={item.slug} className={service === item.slug ? "active" : ""} onClick={() => setService(item.slug)} type="button">{item.name}</button>)}
            </div>
            <select aria-label="Сортировка объявлений" value={sort} onChange={(event) => setSort(event.target.value as MarketplaceSort)}>
              <option value="recent">Сначала новые</option>
              <option value="price_asc">Цена: ниже</option>
              <option value="price_desc">Цена: выше</option>
            </select>
          </div>
          {listingsQuery.isLoading ? <div className="gb-empty">Загружаем...</div> : listings.length === 0 ? (
            <div className="gb-empty"><strong>Объявлений пока нет</strong><span>Можно опубликовать первое предложение.</span><AppButton onClick={startCreate}>Продать аккаунт</AppButton></div>
          ) : <div className="sm-market-family-list">{listings.map((item) => <ListingRow key={item.id} listing={item} onClick={() => openListing(item.id)} />)}</div>}
          {listingsQuery.hasNextPage ? <AppButton variant="tertiary" disabled={listingsQuery.isFetchingNextPage} onClick={() => listingsQuery.fetchNextPage()}>Показать ещё</AppButton> : null}
        </section>
      ) : null}

      {mode === "detail" ? (
        selectedListing ? <section className="gb-stack">
          <article className="gb-detail-card"><ServiceLogo serviceSlug={selectedListing.service.slug} serviceName={selectedListing.service.name} size={48} /><h2>{selectedListing.title}</h2><strong>{formatKzt(selectedListing.price_kzt)}</strong>{selectedListing.description ? <p>{selectedListing.description}</p> : null}<ListingAuthor className="gb-detail-author" owner={selectedListing.owner} /><small>Объявление до {formatDate(selectedListing.expires_at)}</small></article>
          {!selectedListing.is_owner ? <div className="gb-buy-box"><button className="gb-primary-button" data-testid="account-submit-request" disabled={busy !== null || selectedListing.status !== "active"} onClick={() => run("account-request", () => createRequest.mutateAsync(selectedListing.id), "Запрос отправлен продавцу")} type="button">Связаться с продавцом</button></div> : <div className="gb-owner-actions"><AppButton variant="tertiary" disabled={busy !== null} onClick={() => startEdit(selectedListing)}><SystemSymbol name="pencil" size={18} />Изменить</AppButton>{selectedListing.status === "active" ? <AppButton variant="tertiary" disabled={busy !== null} onClick={() => run("account-pause", () => pauseListing.mutateAsync(selectedListing.id), "Объявление скрыто")}><SystemSymbol name="pause.circle" size={18} />Скрыть</AppButton> : selectedListing.status === "paused" ? <AppButton variant="tertiary" disabled={busy !== null} onClick={() => run("account-resume", () => resumeListing.mutateAsync(selectedListing.id), "Объявление опубликовано") }><SystemSymbol name="checkmark" size={18} />Показать</AppButton> : null}{selectedListing.can_renew ? <AppButton variant="tertiary" disabled={busy !== null} onClick={() => run("account-renew", () => renewListing.mutateAsync(selectedListing.id), "Срок продлён на 30 дней")}><SystemSymbol name="arrow.clockwise" size={18} />Продлить</AppButton> : null}<AppButton variant="tertiary" disabled={busy !== null} onClick={async () => { if (await showTelegramConfirm("Убрать объявление? Неотвеченные запросы закроются.")) { await run("account-archive", () => archiveListing.mutateAsync(selectedListing.id), "Объявление убрано"); setMode("mine"); } }}><SystemSymbol name="xmark" size={18} />Убрать</AppButton></div>}
          <p className="gb-safety-note">После принятия запроса продавец и покупатель связываются в Telegram. Условия, оплату и передачу доступа они согласуют самостоятельно.</p>
        </section> : <div className="gb-empty">Открываем объявление...</div>
      ) : null}

      {mode === "create" ? <form className="gb-form" onSubmit={submitListing}>
        <label>Сервис<select disabled={Boolean(editingId)} value={form.service_slug} onChange={(event) => setForm({ ...form, service_slug: event.target.value })}>{services.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label>
        <label>Что продаёте<input maxLength={100} value={form.title} placeholder={`${activeService?.name ?? "Сервис"} на месяц`} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
        <label>Цена, ₸<input type="number" min="1" max="10000000" value={form.price_kzt} onChange={(event) => setForm({ ...form, price_kzt: Number(event.target.value) })} required /></label>
        <label>Описание<textarea rows={3} maxLength={500} value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Необязательно" /></label>
        <AppButton fullWidth type="submit" disabled={busy !== null || form.title.trim().length < 2}>{editingId ? "Сохранить" : "Опубликовать на 30 дней"}</AppButton>
        <p className="gb-safety-note">Не указывайте логин, пароль, номер карты или банковские реквизиты. Все условия сделки продавец согласует с покупателем напрямую.</p>
      </form> : null}

      {mode === "mine" ? <section className="gb-stack"><AppButton fullWidth onClick={startCreate}><SystemSymbol name="plus" size={18} />Продать аккаунт</AppButton>{myListings.length === 0 ? <div className="gb-empty"><strong>Объявлений пока нет</strong></div> : <div className="sm-market-family-list">{myListings.map((item) => <ListingRow key={item.id} listing={item} onClick={() => openListing(item.id)} showStatus />)}</div>}{myListingsQuery.hasNextPage ? <AppButton variant="tertiary" disabled={myListingsQuery.isFetchingNextPage} onClick={() => myListingsQuery.fetchNextPage()}>Показать ещё</AppButton> : null}</section> : null}

      {mode === "requests" ? <section className="gb-stack"><div className="gb-role-switch"><button className={requestRole === "buyer" ? "active" : ""} onClick={() => setRequestRole("buyer")} type="button">Мои запросы</button><button className={requestRole === "seller" ? "active" : ""} onClick={() => setRequestRole("seller")} type="button">Входящие</button></div>{requests.length === 0 ? <div className="gb-empty"><strong>Контактов пока нет</strong></div> : <div className="gb-request-list">{requests.map((request) => <RequestCard key={request.id} request={request} busy={busy !== null} onAccept={(id) => run("account-accept", () => acceptRequest.mutateAsync(id), "Запрос принят")} onReject={(id) => run("account-reject", () => rejectRequest.mutateAsync({ id }), "Запрос отклонён")} onCancel={(id) => run("account-cancel", () => cancelRequest.mutateAsync({ id }), "Запрос отменён")} onRemind={(id) => run("account-remind", () => remindRequest.mutateAsync(id), "Напоминание отправлено")} onClose={(id, outcome) => run("account-close", () => closeRequest.mutateAsync({ id, outcome }), "Контакт закрыт")} />)}</div>}{requestsQuery.hasNextPage ? <AppButton variant="tertiary" disabled={requestsQuery.isFetchingNextPage} onClick={() => requestsQuery.fetchNextPage()}>Показать ещё</AppButton> : null}</section> : null}
      </AsyncContent>
    </div>
  );
}

function RequestCard({ request, busy, onAccept, onReject, onCancel, onRemind, onClose }: { request: AccountRequest; busy: boolean; onAccept: (id: string) => void; onReject: (id: string) => void; onCancel: (id: string) => void; onRemind: (id: string) => void; onClose: (id: string, outcome: "sold" | "not_sold") => void }) {
  return <article className="gb-request-card"><div className="gb-request-head"><div><strong>{request.title}</strong><span>{request.service_name} · {formatKzt(request.price_kzt)}</span></div><em>{requestStatus(request.status)}</em></div>{request.counterparty_username ? <p>@{request.counterparty_username}</p> : null}<div className="gb-request-actions">{request.role === "seller" && request.status === "pending" ? <><button disabled={busy} onClick={() => onAccept(request.id)} type="button"><SystemSymbol name="checkmark" size={17} />Принять</button><button disabled={busy} onClick={() => onReject(request.id)} type="button"><SystemSymbol name="xmark" size={17} />Отклонить</button></> : null}{request.role === "buyer" && request.status === "pending" ? <><button disabled={busy} onClick={() => onCancel(request.id)} type="button">Отменить</button><button disabled={busy || !request.can_remind} onClick={() => onRemind(request.id)} type="button"><SystemSymbol name="arrow.clockwise" size={17} />Напомнить</button></> : null}{request.status === "accepted" && request.counterparty_username ? <button type="button" onClick={() => openTelegramUser(request.counterparty_username!, request.telegram_draft ?? undefined)}><SystemSymbol name="message" size={17} />Написать</button> : null}{request.role === "buyer" && request.status === "accepted" ? <button disabled={busy} onClick={() => onCancel(request.id)} type="button">Отменить</button> : null}{request.role === "seller" && request.status === "accepted" ? <><button disabled={busy} onClick={() => onClose(request.id, "sold")} type="button">Продано</button><button disabled={busy} onClick={() => onClose(request.id, "not_sold")} type="button">Не продано</button></> : null}</div></article>;
}

const formatKzt = (value: number) => `${new Intl.NumberFormat("ru-RU").format(value)} ₸`;
const screenTitle = (mode: ScreenMode) => ({ catalog: "Объявления аккаунтов", detail: "Объявление", create: "Объявление", mine: "Мои объявления", requests: "Заявки" })[mode];
const requestStatus = (status: AccountRequest["status"]) => ({ pending: "ожидает", accepted: "принята", rejected: "отклонена", cancelled: "отменена", closed: "закрыта", expired: "истекла" })[status];
