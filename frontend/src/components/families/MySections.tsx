import { useEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { Button as AppButton, useToast } from "../ui";
import { AccountListingCard, GigabytesListingCard } from "../ListingCard";
import { FamilyTradeRequestCard } from "../TradeRequestCard";
import { AsyncContent } from "../AsyncContent";
import { SystemSymbol, type SystemSymbolName } from "../SystemSymbol";
import { Badge, EmptyState } from "../layout";
import { FamilyListSkeleton } from "../skeleton";
import { useFeedSnap } from "../../hooks/useFeedSnap";
import {
  useAccountRequests,
  useMarketplaceRequests,
  useRemindAccountRequest,
  useRemindMarketplaceRequest,
  useMyAccountListings,
  useMyMarketplaceListings
} from "../../hooks/useApi";
import { formatDate } from "../../format";
import { openTelegramUser, triggerTelegramNotification } from "../../telegram";
import type {
  AccountListing,
  AccountRequest,
  FamilyRequest,
  MarketplaceListing,
  MarketplaceListingRequest
} from "../../types";

export type MyAccountStatusFilter = "all" | "active" | "paused";

export const myAccountStatusFilterOptions: readonly {
  value: MyAccountStatusFilter;
  label: string;
  icon: SystemSymbolName;
}[] = [
  { value: "all", label: "Все", icon: "sort" },
  { value: "active", label: "Опубликовано", icon: "checkmark" },
  { value: "paused", label: "Приостановлено", icon: "pause.circle" }
];

export function formatMyKzt(value: number) {
  return `${value.toLocaleString("ru-KZ")} ₸`;
}

export type MyAccountListingsQuery = ReturnType<typeof useMyAccountListings>;
export type MyGigabytesListingsQuery = ReturnType<typeof useMyMarketplaceListings>;

export type MyTradeRequestsQuery = {
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
  hasNextPage?: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
};

export type MyTradeRequestPreview = {
  id: string;
  title: string;
  subtitle?: string;
  serviceSlug?: string;
  serviceName: string;
  price: number;
  status: string;
  rawStatus: string;
  counterparty?: string | null;
  date?: string;
  telegramUrl?: string | null;
  telegramDraft?: string | null;
  showMeta?: boolean;
  canRemind?: boolean;
  reminderAvailableAt?: string | null;
  scope?: "accounts" | "gigabytes";
};

export type HistoryTab = "purchases" | "sales";

export function accountOrderDate(request: AccountRequest) {
  return request.closed_at ?? request.decided_at ?? request.created_at;
}

export function myTradeRequestStatus(status: AccountRequest["status"]) {
  return ({
    pending: "Ожидает ответа",
    accepted: "Можно продолжить",
    rejected: "Отклонена",
    cancelled: "Отменена",
    closed: "Закрыта",
    expired: "Истёк срок"
  } as const)[status];
}

export function tradeRequestSubtitle(request: MyTradeRequestPreview): string {
  const titleLower = request.title.toLowerCase();
  const serviceLower = request.serviceName?.trim().toLowerCase();
  const titleHasService = Boolean(serviceLower && titleLower.includes(serviceLower));

  if (titleHasService || !request.serviceName) {
    return request.date ?? "";
  }
  return request.date ? `${request.serviceName} · ${request.date}` : request.serviceName;
}

export function MyTradeRequestsSection({
  requests,
  query,
  emptyMessage,
  emptyTitle,
  tab,
  title,
  emptyStateClassName,
  headerAction
}: {
  requests: MyTradeRequestPreview[];
  query: MyTradeRequestsQuery;
  tab?: HistoryTab;
  emptyTitle?: string;
  emptyMessage: string;
  title?: string;
  emptyStateClassName?: string;
  headerAction?: ReactNode;
}) {
  const remindAccount = useRemindAccountRequest();
  const remindGigabytes = useRemindMarketplaceRequest();
  const { toast } = useToast();
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!requests.length) return;
    const el = listRef.current;
    if (!el) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const items = el.querySelectorAll(".my-trade-request");
    if (items.length) {
      gsap.fromTo(
        items,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.28, stagger: 0.04, ease: "power2.out", overwrite: "auto" }
      );
    }
  }, [tab, requests.length]);

  async function handleRemind(request: MyTradeRequestPreview) {
    if (remindingId) return;
    if (!request.canRemind) {
      triggerTelegramNotification("warning");
      toast.warning({ title: "Повторить можно через 1 час" });
      return;
    }
    try {
      setRemindingId(request.id);
      if (request.scope === "gigabytes") {
        await remindGigabytes.mutateAsync(request.id);
      } else {
        await remindAccount.mutateAsync(request.id);
      }
      triggerTelegramNotification("success");
      toast.success({ title: "Уведомление отправлено" });
    } catch {
      triggerTelegramNotification("error");
      toast.error({ title: "Не удалось отправить уведомление" });
    } finally {
      setRemindingId(null);
    }
  }

  return (
    <AsyncContent query={query} label="Загружаем покупки...">
      <section className="my-account-listings my-trade-requests">
        {title ? (
          <div className="my-family-filter-row my-generic-section-heading">
            <div className="my-family-section-heading">
              <h2 className="my-family-section-title">{title}</h2>
              <span className="my-family-section-count">{requests.length}</span>
            </div>
            {headerAction ? (
              <div className="my-account-filter-chips">
                {headerAction}
              </div>
            ) : null}
          </div>
        ) : null}
        {requests.length === 0 ? (
          <EmptyState className={emptyStateClassName} title={emptyTitle ?? "Покупок пока нет"}>{emptyMessage}</EmptyState>
        ) : (
          <div className="my-trade-request-list" ref={listRef}>
            {requests.map((request) => (
              <article className="my-trade-request" key={request.id}>
                <div className="my-trade-request-body">
                  <div className="my-trade-request-top">
                    <strong className="my-trade-request-title">{request.title}</strong>
                    <span className="my-trade-request-price">{formatMyKzt(request.price)}</span>
                  </div>
                  <div className="my-trade-request-sub">
                    <span className="my-trade-request-service">
                      {tradeRequestSubtitle(request)}
                    </span>
                    <span className={`my-trade-request-status is-${request.rawStatus}`}>
                      <span className="my-trade-request-dot" aria-hidden />
                      <span>{request.status}</span>
                    </span>
                  </div>
                </div>
                <div className="my-trade-request-footer">
                  <span
                    className="my-trade-request-seller"
                    aria-label={tab === "sales" ? `Покупатель: ${request.counterparty ?? "не указан"}` : `Продавец: ${request.counterparty ?? "не указан"}`}
                  >
                    <span className="my-trade-request-avatar" aria-hidden>
                      {request.counterparty ? (
                        request.counterparty.replace(/^@/, "").slice(0, 1).toUpperCase()
                      ) : (
                        <SystemSymbol name="person.crop.circle" size={14} />
                      )}
                    </span>
                    <strong className="my-trade-request-username">
                      {request.counterparty ? `@${request.counterparty}` : "Не указан"}
                    </strong>
                  </span>
                  {request.rawStatus === "accepted" && request.counterparty ? (
                    <button
                      type="button"
                      className="my-trade-request-chat-btn"
                      onClick={() => openTelegramUser(request.counterparty!, request.telegramDraft ?? undefined)}
                    >
                      <SystemSymbol name="message" size={13} />
                      <span>Написать</span>
                    </button>
                  ) : null}
                  {tab === "purchases" && request.rawStatus === "pending" ? (
                    <button
                      type="button"
                      className={`my-trade-request-notify-btn${!request.canRemind ? " is-disabled" : ""}`}
                      disabled={remindingId === request.id}
                      onClick={() => void handleRemind(request)}
                      title={
                        request.canRemind
                          ? "Уведомить продавца"
                          : "Уведомление уже отправлено. Повторить можно через 1 час"
                      }
                    >
                      <SystemSymbol name="bell" size={13} />
                      <span>Уведомить</span>
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
        {query.hasNextPage ? (
          <AppButton
            type="button"
            variant="tertiary"
            fullWidth
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? "Загружаем покупки..." : "Показать ещё"}
          </AppButton>
        ) : null}
      </section>
    </AsyncContent>
  );
}

export function MyHistorySection({
  isOpen,
  scope
}: {
  isOpen: boolean;
  scope: "accounts" | "gigabytes";
}) {
  const [tab, setTab] = useState<HistoryTab>("purchases");

  useEffect(() => {
    if (isOpen) {
      setTab("purchases");
    }
  }, [isOpen, scope]);

  const accountBuyerQuery = useAccountRequests("buyer", scope === "accounts" && isOpen);
  const accountSellerQuery = useAccountRequests("seller", scope === "accounts" && isOpen);
  const gbBuyerQuery = useMarketplaceRequests("buyer", scope === "gigabytes" && isOpen);
  const gbSellerQuery = useMarketplaceRequests("seller", scope === "gigabytes" && isOpen);

  const isAccounts = scope === "accounts";
  const buyerRequests = isAccounts ? (accountBuyerQuery.data ?? []) : (gbBuyerQuery.data ?? []);
  const sellerRequests = isAccounts ? (accountSellerQuery.data ?? []) : (gbSellerQuery.data ?? []);
  const buyerQuery = isAccounts ? accountBuyerQuery : gbBuyerQuery;
  const sellerQuery = isAccounts ? accountSellerQuery : gbSellerQuery;

  const activeRequests = tab === "purchases" ? buyerRequests : sellerRequests;
  const activeQuery = tab === "purchases" ? buyerQuery : sellerQuery;

  const mappedRequests: MyTradeRequestPreview[] = isAccounts
    ? (activeRequests as AccountRequest[]).map((request) => ({
        id: request.id,
        title: request.title,
        subtitle: request.service_name,
        serviceSlug: request.service_slug,
        serviceName: request.service_name,
        price: request.price_kzt,
        status: myTradeRequestStatus(request.status),
        rawStatus: request.status,
        counterparty: request.counterparty_username,
        date: formatDate(accountOrderDate(request)),
        telegramUrl: request.telegram_url,
        telegramDraft: request.telegram_draft,
        showMeta: true,
        canRemind: Boolean(request.can_remind),
        reminderAvailableAt: request.reminder_available_at,
        scope: "accounts"
      }))
    : (activeRequests as MarketplaceListingRequest[]).map((request) => ({
        id: request.id,
        title: `${request.operator_name} · ${request.amount_gb} ГБ`,
        subtitle: "Пакет ГБ",
        serviceSlug: `${request.operator_slug}-family-tariff`,
        serviceName: request.operator_name,
        price: request.total_price_kzt,
        status: myTradeRequestStatus(request.status),
        rawStatus: request.status,
        counterparty: request.counterparty_username,
        date: formatDate(request.created_at),
        telegramUrl: request.telegram_url,
        telegramDraft: request.telegram_draft,
        canRemind: Boolean(request.can_remind),
        reminderAvailableAt: request.reminder_available_at,
        scope: "gigabytes"
      }));

  const emptyMessage = tab === "purchases"
    ? (isAccounts ? "Здесь появятся купленные вами аккаунты." : "Здесь появятся выбранные вами пакеты.")
    : (isAccounts ? "Здесь появятся заявки на ваши аккаунты." : "Здесь появятся заявки на ваши пакеты.");

  return (
    <section className="my-history-section" data-testid="my-history-section">
      <div className="my-family-filter-row my-generic-section-heading">
        <div className="my-family-section-heading">
          <h2 className="my-family-section-title">История</h2>
          <span className="my-family-section-count">{activeRequests.length}</span>
        </div>
        <div className="my-account-filter-chips">
          <button
            type="button"
            className="sm-history-filter-chip is-active"
            aria-label={`Раздел истории: ${tab === "purchases" ? "Покупки" : "Продажи"}. Нажмите для переключения`}
            data-testid="my-history-filter-chip"
            onClick={() => setTab((current) => (current === "purchases" ? "sales" : "purchases"))}
          >
            <SystemSymbol name="round-sort-vertical" size={14} />
            <span>{tab === "purchases" ? "Покупки" : "Продажи"}</span>
          </button>
        </div>
      </div>
      <div className="my-history-content">
        <MyTradeRequestsSection
          requests={mappedRequests}
          query={activeQuery}
          tab={tab}
          emptyTitle={tab === "purchases" ? "Покупок пока нет" : "Продаж пока нет"}
          emptyMessage={emptyMessage}
          emptyStateClassName="my-account-orders-empty-state"
        />
      </div>
    </section>
  );
}

export function MyAccountListingsSection({
  listings,
  rawCount = 0,
  searchTerm = "",
  onResetSearch,
  query,
  onOpenListing,
  onCreateListing,
  onOpenMarket,
  isHistoryOpen = false
}: {
  listings: AccountListing[];
  rawCount?: number;
  searchTerm?: string;
  onResetSearch?: () => void;
  query: MyAccountListingsQuery;
  onOpenListing: (listingId: string) => void;
  onCreateListing: () => void;
  onOpenMarket?: () => void;
  isHistoryOpen?: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<MyAccountStatusFilter>("all");
  const filteredListings = listings.filter((item) => statusFilter === "all" || item.status === statusFilter);
  const activeIndex = myAccountStatusFilterOptions.findIndex((option) => option.value === statusFilter);
  const activeOption = myAccountStatusFilterOptions[activeIndex >= 0 ? activeIndex : 0];

  const feedSnap = useFeedSnap({
    enabled: true,
    itemCount: filteredListings.length
  });

  return (
    <AsyncContent query={query} label="Загружаем объявления...">
      <section className="my-account-listings">
        <div
          id="my-account-orders"
          className={`my-history-disclosure${isHistoryOpen ? " is-open" : ""}`}
          aria-hidden={!isHistoryOpen}
          inert={!isHistoryOpen}
        >
          <div className="my-history-disclosure-content">
            <MyHistorySection
              scope="accounts"
              isOpen={isHistoryOpen}
            />
          </div>
        </div>
        <div data-testid="my-accounts-screen" className="my-accounts-header-scope">
          <div className="my-family-filter-row my-generic-section-heading">
            <div className="my-family-section-heading">
              <h2 className="my-family-section-title">Аккаунты</h2>
              <span className="my-family-section-count">{filteredListings.length}</span>
            </div>
            <div className="my-account-filter-chips">
              <button
                type="button"
                className={`sm-market-filter-chip${statusFilter !== "all" ? " is-active" : ""}`}
                aria-pressed={statusFilter !== "all"}
                aria-label={`Статус: ${activeOption.label}. Нажмите для переключения`}
                onClick={() =>
                  setStatusFilter(
                    myAccountStatusFilterOptions[(activeIndex + 1) % myAccountStatusFilterOptions.length].value
                  )
                }
              >
                <SystemSymbol name={activeOption.icon} size={14} />
                {activeOption.label}
              </button>
            </div>
          </div>
        </div>
        <div
          className="my-feed-scroll"
          ref={feedSnap.containerRef}
          {...feedSnap.scrollHandlers}
        >
          {listings.length === 0 ? (
            <EmptyState
              className="my-family-empty-state"
              icon={<SystemSymbol name={searchTerm.trim() ? "magnifyingglass" : "key"} size={32} />}
              title={searchTerm.trim() ? "Ничего не найдено" : "Объявлений пока нет"}
            >
              {searchTerm.trim() ? (
                <>
                  <span>Попробуйте изменить поисковый запрос.</span>
                  {onResetSearch ? (
                    <AppButton type="button" variant="secondary" size="sm" onClick={onResetSearch}>
                      Сбросить поиск
                    </AppButton>
                  ) : null}
                </>
              ) : (
                <>
                  <span>Опубликуйте первое предложение доступа к сервису.</span>
                  <AppButton
                    type="button"
                    variant="primary"
                    size="sm"
                    data-testid="my-account-create-button"
                    onClick={onCreateListing}
                  >
                    Добавить объявление
                  </AppButton>
                </>
              )}
            </EmptyState>
          ) : filteredListings.length === 0 ? (
            <EmptyState className="my-family-empty-state" title={`Объявлений со статусом «${activeOption.label.toLowerCase()}» пока нет`}>
              Попробуйте переключить статус.
            </EmptyState>
          ) : (
            <div className="sm-market-family-list">
              {filteredListings.map((listing) => (
                <AccountListingCard
                  key={listing.id}
                  listing={listing}
                  showStatus
                  testId="my-account-listing-card"
                  onClick={() => onOpenListing(listing.id)}
                />
              ))}
            </div>
          )}
          {query.hasNextPage ? (
            <AppButton
              type="button"
              variant="tertiary"
              fullWidth
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? "Загружаем объявления..." : "Показать ещё объявления"}
            </AppButton>
          ) : null}
        </div>
      </section>
    </AsyncContent>
  );
}

export function MyGigabytesSection({
  listings,
  rawCount = 0,
  searchTerm = "",
  onResetSearch,
  listingsQuery,
  onOpenListing,
  onCreateListing,
  onOpenMarket,
  isHistoryOpen = false
}: {
  listings: MarketplaceListing[];
  rawCount?: number;
  searchTerm?: string;
  onResetSearch?: () => void;
  listingsQuery: MyGigabytesListingsQuery;
  onOpenListing: (listingId: string) => void;
  onCreateListing: () => void;
  onOpenMarket?: () => void;
  isHistoryOpen?: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<MyAccountStatusFilter>("all");
  const filteredListings = listings.filter(
    (item) => statusFilter === "all" || item.status === statusFilter
  );
  const activeStatusIndex = myAccountStatusFilterOptions.findIndex(
    (option) => option.value === statusFilter
  );
  const activeStatusOption =
    myAccountStatusFilterOptions[activeStatusIndex >= 0 ? activeStatusIndex : 0];

  const feedSnap = useFeedSnap({
    enabled: true,
    itemCount: filteredListings.length
  });

  return (
    <AsyncContent query={listingsQuery} label="Загружаем объявления...">
      <section className="my-account-listings" data-testid="my-gigabytes-screen">
        <div
          id="my-gigabytes-orders"
          className={`my-history-disclosure${isHistoryOpen ? " is-open" : ""}`}
          aria-hidden={!isHistoryOpen}
          inert={!isHistoryOpen}
        >
          <div className="my-history-disclosure-content">
            <MyHistorySection
              scope="gigabytes"
              isOpen={isHistoryOpen}
            />
          </div>
        </div>
        <div className="my-family-filter-row my-generic-section-heading">
          <div className="my-family-section-heading">
            <h2 className="my-family-section-title">Гигабайты</h2>
            <span className="my-family-section-count">{filteredListings.length}</span>
          </div>
          <div className="my-gigabytes-filter-chips">
            <button
              type="button"
              className={`sm-market-filter-chip${statusFilter !== "all" ? " is-active" : ""}`}
              aria-pressed={statusFilter !== "all"}
              aria-label={`Статус: ${activeStatusOption.label}. Нажмите для переключения`}
              data-testid="my-gigabytes-status-chip"
              onClick={() =>
                setStatusFilter(
                  myAccountStatusFilterOptions[
                    (activeStatusIndex + 1) % myAccountStatusFilterOptions.length
                  ].value
                )
              }
            >
              <SystemSymbol name={activeStatusOption.icon} size={14} />
              <span>{activeStatusOption.label}</span>
            </button>
          </div>
        </div>

        <div
          className="my-feed-scroll"
          ref={feedSnap.containerRef}
          {...feedSnap.scrollHandlers}
        >
          {listings.length === 0 ? (
            <EmptyState
              className="my-family-empty-state"
              icon={<SystemSymbol name={searchTerm.trim() ? "magnifyingglass" : "globe"} size={32} />}
              title={searchTerm.trim() ? "Ничего не найдено" : "Объявлений пока нет"}
            >
              {searchTerm.trim() ? (
                <>
                  <span>Попробуйте изменить поисковый запрос.</span>
                  {onResetSearch ? (
                    <AppButton type="button" variant="secondary" size="sm" onClick={onResetSearch}>
                      Сбросить поиск
                    </AppButton>
                  ) : null}
                </>
              ) : (
                <>
                  <span>Опубликуйте предложение, чтобы продавать интернет-пакеты.</span>
                  <AppButton
                    type="button"
                    variant="primary"
                    size="sm"
                    data-testid="my-gigabytes-create-button"
                    onClick={onCreateListing}
                  >
                    Добавить объявление
                  </AppButton>
                </>
              )}
            </EmptyState>
          ) : filteredListings.length === 0 ? (
            <EmptyState className="my-family-empty-state" title={`Объявлений со статусом «${activeStatusOption.label.toLowerCase()}» пока нет`}>
              Попробуйте переключить статус.
            </EmptyState>
          ) : (
            <div className="sm-market-family-list">
              {filteredListings.map((listing) => (
                <GigabytesListingCard
                  key={listing.id}
                  listing={listing}
                  showStatus
                  testId="my-gigabytes-listing-card"
                  onClick={() => onOpenListing(listing.id)}
                />
              ))}
            </div>
          )}

          {listingsQuery.hasNextPage ? (
            <AppButton
              type="button"
              variant="tertiary"
              fullWidth
              disabled={listingsQuery.isFetchingNextPage}
              onClick={() => void listingsQuery.fetchNextPage()}
            >
              {listingsQuery.isFetchingNextPage ? "Загружаем объявления..." : "Показать ещё объявления"}
            </AppButton>
          ) : null}
        </div>
      </section>
    </AsyncContent>
  );
}

export function MyRequestsSection({
  requests,
  busy,
  isLoading,
  showEmpty = false,
  onCancelRequest
}: {
  requests: FamilyRequest[];
  busy: string | null;
  isLoading?: boolean;
  showEmpty?: boolean;
  onCancelRequest: (requestId: string) => void;
}) {
  if (isLoading && requests.length === 0) {
    return <FamilyListSkeleton count={1} />;
  }

  if (requests.length === 0) {
    if (!showEmpty) return null;
    return (
      <section className="my-requests-section" data-testid="my-requests-section">
        <div className="section-inline-title">
          <span>Мои заявки</span>
          <Badge>0</Badge>
        </div>
        <EmptyState title="Активных заявок нет">
          Когда вы отправите заявку в семью, её статус появится здесь.
        </EmptyState>
      </section>
    );
  }

  return (
    <section className="my-requests-section actions-feed-group" data-testid="my-requests-section">
      {requests.map((request) => (
        <FamilyTradeRequestCard
          key={request.id}
          request={request}
          busy={busy !== null}
          onCancelRequest={onCancelRequest}
        />
      ))}
    </section>
  );
}
