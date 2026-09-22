import { useEffect, useMemo, useState } from "react";
import { useFeedSnap } from "../hooks/useFeedSnap";
import { Button as AppButton } from "../components/ui";
import { ListingAuthor } from "../components/ListingAuthor";
import { ServiceLogo, resolveServiceBrand } from "../components/branding";
import { AccountListingCard as ListingRow } from "../components/ListingCard";
import { AsyncContent } from "../components/AsyncContent";
import { FilterMenu, type FilterMenuOption } from "../components/FilterMenu";
import { SystemSymbol } from "../components/SystemSymbol";
import { useTelegramBackButton } from "../hooks/useTelegramAppEffects";

import { formatDate, formatError, normalizeText } from "../format";
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
import { openTelegramUser, showTelegramAlert, showTelegramConfirm, triggerTelegramImpact } from "../telegram";
import type {
  AccountListing,
  AccountListingCreate,
  MarketplaceSort
} from "../types";

type ScreenMode = "catalog" | "detail" | "create" | "mine";

const EMPTY_FORM: AccountListingCreate = {
  service_slug: "chatgpt",
  title: "",
  price_kzt: 3990,
  description: null
};

const sortOptions: FilterMenuOption[] = [
  { value: "all", label: "По умолчанию" },
  { value: "recent", label: "Новое" },
  { value: "price_asc", label: "Дешевле" }
];

type AccountCategoryFilter = "all" | "video" | "ai" | "music" | "other";

const accountCategoryOptions: { value: AccountCategoryFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "video", label: "Видео" },
  { value: "ai", label: "AI" },
  { value: "music", label: "Музыка" },
  { value: "other", label: "Другое" }
];

function getAccountCategory(item: AccountListing): Exclude<AccountCategoryFilter, "all"> {
  const slug = (item.service?.slug ?? "").toLowerCase();
  const name = (item.service?.name ?? "").toLowerCase();
  const title = (item.title ?? "").toLowerCase();

  if (
    slug === "chatgpt" ||
    name.includes("chatgpt") ||
    slug === "gemini" ||
    name.includes("gemini") ||
    slug === "grok" ||
    name.includes("grok") ||
    slug === "claude" ||
    name.includes("claude") ||
    slug.includes("ai") ||
    name.includes("ai") ||
    title.includes("gpt") ||
    title.includes("ai")
  ) {
    return "ai";
  }

  const brand = resolveServiceBrand({ serviceSlug: item.service?.slug, serviceName: item.service?.name });
  if (
    brand.category === "video_streaming" ||
    slug.includes("netflix") ||
    slug.includes("youtube") ||
    slug.includes("cinema") ||
    slug.includes("video") ||
    slug.includes("kino") ||
    name.includes("кино") ||
    name.includes("видео") ||
    title.includes("netflix") ||
    title.includes("youtube")
  ) {
    return "video";
  }

  if (
    brand.category === "music_audio" ||
    slug.includes("spotify") ||
    slug.includes("music") ||
    name.includes("музык") ||
    title.includes("spotify") ||
    title.includes("музык")
  ) {
    return "music";
  }

  return "other";
}

export function AccountsScreen({
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
  const [category, setCategory] = useState<AccountCategoryFilter>("all");
  const [sort, setSort] = useState<MarketplaceSort | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
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

  const activeSortOption = useMemo(
    () => sortOptions.find((opt) => opt.value === sort) ?? sortOptions[0],
    [sort]
  );

  const categoryMenuOptions: FilterMenuOption[] = useMemo(() => {
    return accountCategoryOptions.map((opt) => {
      const count =
        opt.value === "all"
          ? listings.length
          : listings.filter((item) => getAccountCategory(item) === opt.value).length;
      return {
        ...opt,
        count,
        disabled: opt.value !== "all" && count === 0 && opt.value !== category
      };
    });
  }, [listings, category]);

  const activeCategoryOption = useMemo(
    () => accountCategoryOptions.find((opt) => opt.value === category) ?? accountCategoryOptions[0],
    [category]
  );

  const displayedListings = useMemo(() => {
    const byCategory =
      category === "all"
        ? listings
        : listings.filter((item) => getAccountCategory(item) === category);

    const term = searchTerm.trim().toLowerCase();
    if (!term) return byCategory;
    return byCategory.filter(
      (item) =>
        item.title.toLowerCase().includes(term) ||
        item.service.name.toLowerCase().includes(term) ||
        (item.description && item.description.toLowerCase().includes(term))
    );
  }, [listings, category, searchTerm]);

  const feedSnap = useFeedSnap({
    enabled: mode === "catalog",
    itemCount: displayedListings.length
  });

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
          <section className="gb-stack sm-market-catalog-stack">
            <label className="sm-market-search">
              <SystemSymbol name="magnifyingglass" size={20} />
              <input
                type="search"
                aria-label="Поиск аккаунтов"
                data-testid="accounts-search-input"
                placeholder="Сервис или название"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm ? (
                <button
                  type="button"
                  className="sm-market-search-clear"
                  aria-label="Очистить поиск"
                  onClick={() => setSearchTerm("")}
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
                  data-testid="account-category-filter-button"
                  className={`sm-market-filter-chip${category !== "all" ? " is-active" : ""}`}
                  aria-haspopup="menu"
                  aria-expanded={isCategoryMenuOpen}
                  aria-label={`Фильтр каталога: ${activeCategoryOption.label}`}
                  onClick={() => {
                    setIsSortMenuOpen(false);
                    setIsCategoryMenuOpen((prev) => !prev);
                  }}
                >
                  <SystemSymbol name="sort" size={14} />
                  <span>{activeCategoryOption.label}</span>
                </button>

                <button
                  type="button"
                  data-testid="account-sort-button"
                  aria-label="Сортировка объявлений"
                  aria-haspopup="menu"
                  aria-expanded={isSortMenuOpen}
                  className={`sm-market-filter-chip${sort !== "all" ? " is-active" : ""}`}
                  onClick={() => {
                    setIsCategoryMenuOpen(false);
                    setIsSortMenuOpen((prev) => !prev);
                  }}
                >
                  <SystemSymbol name="round-sort-vertical" size={14} className="sm-market-filter-icon-price" />
                  <span>{activeSortOption.label}</span>
                </button>

                {isCategoryMenuOpen ? (
                  <FilterMenu
                    id="account-category-menu"
                    label="Категория сервиса"
                    options={categoryMenuOptions}
                    selectedValue={category}
                    testIdPrefix="account-category-option"
                    onSelect={(value) => {
                      setCategory(value as AccountCategoryFilter);
                      setIsCategoryMenuOpen(false);
                      feedSnap.containerRef.current?.scrollTo({ top: 0, behavior: "auto" });
                    }}
                    onClose={() => setIsCategoryMenuOpen(false)}
                  />
                ) : null}

                {isSortMenuOpen ? (
                  <FilterMenu
                    id="account-sort-menu"
                    label="Сортировка объявлений"
                    options={sortOptions}
                    selectedValue={sort}
                    testIdPrefix="account-sort-option"
                    onSelect={(value) => {
                      setSort(value as MarketplaceSort | "all");
                      setIsSortMenuOpen(false);
                      feedSnap.containerRef.current?.scrollTo({ top: 0, behavior: "auto" });
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
              {listingsQuery.isLoading ? (
                <div className="sm-market-family-list" aria-label="Загружаем объявления" role="status">
                  {[0, 1, 2].map((n) => (
                    <div key={n} className="sm-listing-skeleton" aria-hidden>
                      <span />
                      <div />
                      <span />
                    </div>
                  ))}
                </div>
              ) : displayedListings.length === 0 ? (
                <div className="sm-market-empty" data-testid="account-catalog-empty">
                  <SystemSymbol name="magnifyingglass" size={28} />
                  <h3>{searchTerm ? "Ничего не найдено" : "Доступных аккаунтов пока нет"}</h3>
                  <p>
                    {searchTerm
                      ? "Попробуйте изменить поисковый запрос или сбросить фильтры."
                      : "Можно опубликовать первое предложение или вернуться позже."}
                  </p>
                  <div className="sm-market-empty-actions">
                    <button
                      type="button"
                      className="sm-market-button sm-market-button-secondary"
                      onClick={() => (searchTerm ? setSearchTerm("") : void listingsQuery.refetch())}
                    >
                      {searchTerm ? "Сбросить поиск" : "Обновить"}
                    </button>
                    {!searchTerm ? (
                      <button
                        type="button"
                        className="sm-market-button sm-market-button-primary"
                        onClick={startCreate}
                      >
                        Продать аккаунт
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="sm-market-family-list">
                  {displayedListings.map((item) => (
                    <ListingRow key={item.id} listing={item} onClick={() => openListing(item.id)} />
                  ))}
                </div>
              )}

              {listingsQuery.hasNextPage ? (
                <AppButton
                  variant="tertiary"
                  fullWidth
                  disabled={listingsQuery.isFetchingNextPage}
                  onClick={() => listingsQuery.fetchNextPage()}
                >
                  {listingsQuery.isFetchingNextPage ? "Загружаем…" : "Показать ещё"}
                </AppButton>
              ) : null}
            </div>
          </section>
        ) : null}

        {mode === "detail" ? (
          selectedListing ? (
            <section className="gb-stack">
              <article className="gb-detail-card family-overview-card" data-testid="account-detail-card">
                <div className="gb-detail-head family-overview-head">
                  <ServiceLogo
                    serviceSlug={selectedListing.service.slug}
                    serviceName={selectedListing.service.name}
                    size={48}
                  />
                  <div className="gb-detail-title-block">
                    <h2>{selectedListing.title}</h2>
                    <strong className="gb-detail-price">{formatKzt(selectedListing.price_kzt)}</strong>
                  </div>
                </div>

                {selectedListing.description ? (
                  <div className="gb-detail-description">
                    <p>{selectedListing.description}</p>
                  </div>
                ) : null}

                <div className="gb-detail-meta-row">
                  <div className="gb-detail-meta-item">
                    <SystemSymbol name="calendar" size={17} />
                    <span>Объявление до {formatDate(selectedListing.expires_at)}</span>
                  </div>
                </div>

                <ListingAuthor className="gb-detail-author" owner={selectedListing.owner} />
              </article>

              {!selectedListing.is_owner ? (
                <div className="gb-buy-box">
                  <button
                    className="gb-primary-button"
                    data-testid="account-submit-request"
                    disabled={busy !== null || selectedListing.status !== "active"}
                    onClick={() =>
                      run(
                        "account-request",
                        () => createRequest.mutateAsync(selectedListing.id),
                        "Запрос отправлен продавцу"
                      )
                    }
                    type="button"
                  >
                    Связаться с продавцом
                  </button>
                  <p className="gb-safety-note">
                    После принятия запроса продавец и покупатель связываются в Telegram. Условия, оплату и передачу доступа они согласуют самостоятельно.
                  </p>
                </div>
              ) : (
                <div className="gb-owner-actions">
                  <AppButton
                    variant="tertiary"
                    disabled={busy !== null}
                    onClick={() => startEdit(selectedListing)}
                  >
                    <SystemSymbol name="pencil" size={18} />
                    Изменить
                  </AppButton>
                  {selectedListing.status === "active" ? (
                    <AppButton
                      variant="tertiary"
                      disabled={busy !== null}
                      onClick={() =>
                        run(
                          "account-pause",
                          () => pauseListing.mutateAsync(selectedListing.id),
                          "Объявление скрыто"
                        )
                      }
                    >
                      <SystemSymbol name="pause.circle" size={18} />
                      Скрыть
                    </AppButton>
                  ) : selectedListing.status === "paused" ? (
                    <AppButton
                      variant="tertiary"
                      disabled={busy !== null}
                      onClick={() =>
                        run(
                          "account-resume",
                          () => resumeListing.mutateAsync(selectedListing.id),
                          "Объявление опубликовано"
                        )
                      }
                    >
                      <SystemSymbol name="checkmark" size={18} />
                      Показать
                    </AppButton>
                  ) : null}
                  {selectedListing.can_renew ? (
                    <AppButton
                      variant="tertiary"
                      disabled={busy !== null}
                      onClick={() =>
                        run(
                          "account-renew",
                          () => renewListing.mutateAsync(selectedListing.id),
                          "Срок продлён на 30 дней"
                        )
                      }
                    >
                      <SystemSymbol name="arrow.clockwise" size={18} />
                      Продлить
                    </AppButton>
                  ) : null}
                  <AppButton
                    variant="tertiary"
                    disabled={busy !== null}
                    onClick={async () => {
                      if (
                        await showTelegramConfirm(
                          "Убрать объявление? Неотвеченные запросы закроются."
                        )
                      ) {
                        await run(
                          "account-archive",
                          () => archiveListing.mutateAsync(selectedListing.id),
                          "Объявление убрано"
                        );
                        setMode("mine");
                      }
                    }}
                  >
                    <SystemSymbol name="xmark" size={18} />
                    Убрать
                  </AppButton>
                </div>
              )}
            </section>
          ) : (
            <div className="gb-empty sm-market-empty">
              <SystemSymbol name="clock" size={28} />
              <h3>Открываем объявление...</h3>
            </div>
          )
        ) : null}

        {mode === "create" ? (
          <form className="gb-form" onSubmit={submitListing}>
            <label className="ui-field">
              <span>Сервис</span>
              <select
                disabled={Boolean(editingId)}
                value={form.service_slug}
                onChange={(event) => setForm({ ...form, service_slug: event.target.value })}
              >
                {services.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="ui-field">
              <span>Что продаёте</span>
              <input
                maxLength={100}
                value={form.title}
                placeholder={`${activeService?.name ?? "Сервис"} на месяц`}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                required
              />
            </label>
            <label className="ui-field">
              <span>Цена, ₸</span>
              <input
                type="number"
                min="1"
                max="10000000"
                value={form.price_kzt}
                onChange={(event) =>
                  setForm({ ...form, price_kzt: Number(event.target.value) })
                }
                required
              />
            </label>
            <label className="ui-field">
              <span>Описание</span>
              <textarea
                rows={3}
                maxLength={500}
                value={form.description ?? ""}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder="Необязательно"
              />
            </label>
            <AppButton
              fullWidth
              type="submit"
              disabled={busy !== null || form.title.trim().length < 2}
            >
              {editingId ? "Сохранить" : "Опубликовать на 30 дней"}
            </AppButton>
            <p className="gb-safety-note">
              Не указывайте логин, пароль, номер карты или банковские реквизиты. Все условия сделки продавец согласует с покупателем напрямую.
            </p>
          </form>
        ) : null}

        {mode === "mine" ? (
          <section className="gb-stack">
            <AppButton fullWidth onClick={startCreate}>
              <SystemSymbol name="plus" size={18} />
              Продать аккаунт
            </AppButton>
            {myListings.length === 0 ? (
              <div className="gb-empty sm-market-empty">
                <SystemSymbol name="clipboard.list" size={28} />
                <h3>Объявлений пока нет</h3>
                <p>Ваши опубликованные предложения появятся здесь.</p>
              </div>
            ) : (
              <div className="sm-market-family-list">
                {myListings.map((item) => (
                  <ListingRow
                    key={item.id}
                    listing={item}
                    onClick={() => openListing(item.id)}
                    showStatus
                  />
                ))}
              </div>
            )}
            {myListingsQuery.hasNextPage ? (
              <AppButton
                variant="tertiary"
                fullWidth
                disabled={myListingsQuery.isFetchingNextPage}
                onClick={() => myListingsQuery.fetchNextPage()}
              >
                Показать ещё
              </AppButton>
            ) : null}
          </section>
        ) : null}

      </AsyncContent>
    </div>
  );
}

const formatKzt = (value: number) => `${new Intl.NumberFormat("ru-RU").format(value)} ₸`;
const screenTitle = (mode: ScreenMode) =>
  ({
    catalog: "Объявления аккаунтов",
    detail: "Объявление",
    create: "Объявление",
    mine: "Мои объявления"
  })[mode];
