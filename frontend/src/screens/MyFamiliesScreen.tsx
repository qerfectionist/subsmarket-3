import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import {
  Button as AppButton,
  Input,
  Select,
  TextArea,
  Typography
} from "../components/ui";
import { Calendar, I18nProvider } from "@heroui/react";
import { CalendarDate } from "@internationalized/date";

import { FamilyCard, OwnerDetails, PaymentList } from "../components/families";
import {
  AccountListingCard,
  FamilyListingCard,
  GigabytesListingCard
} from "../components/ListingCard";
import { ServiceLogo } from "../components/branding";
import { AsyncContent } from "../components/AsyncContent";
import { SystemSymbol } from "../components/SystemSymbol";
import {
  Badge,
  EmptyState,
  Panel,
  ProductScopeSwitch
} from "../components/layout";
import { RequisiteBox } from "../components/RequisiteBox";
import { FamilyListSkeleton } from "../components/skeleton";
import {
  useAccountRequests,
  useMarketplaceRequests,
  useMyAccountListings,
  useMyMarketplaceListings
} from "../hooks/useApi";
import { familyTitle, formatDateTime, statusText } from "../format";
import {
  familyKindLabels,
  requestCancelReasonLabels
} from "../labels";
import { openTelegramUser } from "../telegram";
import type {
  AccountListing,
  Family,
  FamilyMember,
  FamilyMemberRemovalReason,
  FamilyPayment,
  FamilyRequest,
  AccountRequest,
  MarketplaceListing,
  MarketplaceListingRequest,
  MarketplaceRequestRole,
  MyFamily,
  OwnerFamilyDetails,
  PaymentRequisite
} from "../types";

type MyProductScope = "families" | "accounts" | "gigabytes";
type MyFamilyFilter = "all" | "tariff" | "subscription";
type MyFamilyRoleFilter = "all" | "member" | "owner";

const myFamilyFilterOptions: readonly { value: MyFamilyFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "tariff", label: "Тарифы" },
  { value: "subscription", label: "Сервисы" }
];

const myFamilyRoleOptions = [
  {
    value: "member",
    label: "Участвую",
    description: "Семьи, которыми пользуюсь",
    icon: "person.2"
  },
  {
    value: "owner",
    label: "Организую",
    description: "Семьи, которыми управляю",
    icon: "person.2.badge.plus"
  }
] as const;

const myProductScopeOrder: readonly MyProductScope[] = [
  "families",
  "accounts",
  "gigabytes"
];

type MyProductScopePointerState = {
  pointerId: number;
  startX: number;
  startY: number;
  originPosition: number;
  lastX: number;
  lastTime: number;
  velocityX: number;
  isDragging: boolean;
  cancelled: boolean;
};

export function MyFamiliesScreen({
  mode = "mine",
  myProductScope = "families",
  families,
  ownerDetails,
  requisites,
  requests,
  busy,
  isLoading,
  requestsLoading,
  loadError,
  onRetry,
  hasMoreFamilies,
  isLoadingMoreFamilies,
  hasMoreRequests,
  isLoadingMoreRequests,
  onLoadMoreFamilies,
  onLoadMoreRequests,
  onOpenFamily,
  onLoadOwnerDetails,
  onUpdateDescription,
  onUpdatePrice,
  onUpdatePaymentDay,
  onCloseFamily,
  onConfirmAvailability,
  onConfirmAccess,
  onGetRequisite,
  onAcknowledgeClosing,
  onLeaveFamily,
  onCreatePrepayment,
  onReportPayment,
  onCancelPaymentReport,
  onApproveRequest,
  onRejectRequest,
  onAccessProvided,
  onRemindAccess,
  onCancelBeforeAccess,
  onRemoveMember,
  onConfirmPayment,
  onNotReceived,
  onRecordPrepayment,
  onCancelRequest,
  marketplaceSalesActionCount = 0,
  marketplacePurchaseActionCount = 0,
  accountSalesActionCount = 0,
  accountPurchaseActionCount = 0,
  onOpenMarketplaceSalesActions,
  onOpenMarketplacePurchaseActions,
  onOpenAccountSalesActions,
  onOpenAccountPurchaseActions,
  onChangeProductScope,
  onOpenAccountListing,
  onCreateAccountListing,
  onOpenGigabytesListing,
  onCreateGigabytesListing,
  onOpenMarket
}: {
  mode?: "mine" | "actions";
  myProductScope?: MyProductScope;
  families: MyFamily[];
  ownerDetails: Record<string, OwnerFamilyDetails>;
  requisites: Record<string, PaymentRequisite>;
  requests: FamilyRequest[];
  busy: string | null;
  isLoading?: boolean;
  requestsLoading?: boolean;
  loadError?: boolean;
  onRetry?: () => void;
  hasMoreFamilies?: boolean;
  isLoadingMoreFamilies?: boolean;
  hasMoreRequests?: boolean;
  isLoadingMoreRequests?: boolean;
  onLoadMoreFamilies?: () => void;
  onLoadMoreRequests?: () => void;
  onOpenFamily: (familyId: string) => void;
  onLoadOwnerDetails: (familyId: string) => void;
  onUpdateDescription: (familyId: string, description: string | null) => void;
  onUpdatePrice: (familyId: string, totalPriceKzt: number) => void;
  onUpdatePaymentDay: (
    familyId: string,
    paymentDay: number,
    nextPaymentDate: string
  ) => void;
  onCloseFamily: (familyId: string, closesOn: string) => void;
  onConfirmAvailability: (familyId: string) => void;
  onConfirmAccess: (memberId: string) => void;
  onGetRequisite: (memberId: string) => void;
  onAcknowledgeClosing: (familyId: string) => void;
  onLeaveFamily: (memberId: string) => void;
  onCreatePrepayment: (memberId: string) => void;
  onReportPayment: (payment: FamilyPayment) => Promise<unknown>;
  onCancelPaymentReport: (payment: FamilyPayment) => Promise<unknown>;
  onApproveRequest: (familyId: string, request: FamilyRequest) => Promise<unknown>;
  onRejectRequest: (familyId: string, request: FamilyRequest) => Promise<unknown>;
  onAccessProvided: (familyId: string, member: FamilyMember) => Promise<unknown>;
  onRemindAccess: (familyId: string, member: FamilyMember) => Promise<unknown>;
  onCancelBeforeAccess: (familyId: string, member: FamilyMember) => Promise<unknown>;
  onRemoveMember: (
    familyId: string,
    member: FamilyMember,
    reason: FamilyMemberRemovalReason
  ) => Promise<unknown>;
  onConfirmPayment: (familyId: string, payment: FamilyPayment) => Promise<unknown>;
  onNotReceived: (familyId: string, payment: FamilyPayment) => Promise<unknown>;
  onRecordPrepayment: (
    familyId: string,
    member: FamilyMember,
    periods: number
  ) => Promise<unknown>;
  onCancelRequest: (requestId: string) => void;
  marketplaceSalesActionCount?: number;
  marketplacePurchaseActionCount?: number;
  accountSalesActionCount?: number;
  accountPurchaseActionCount?: number;
  onOpenMarketplaceSalesActions?: () => void;
  onOpenMarketplacePurchaseActions?: () => void;
  onOpenAccountSalesActions?: () => void;
  onOpenAccountPurchaseActions?: () => void;
  onChangeProductScope: (scope: MyProductScope) => void;
  onOpenAccountListing: (listingId: string) => void;
  onCreateAccountListing: () => void;
  onOpenGigabytesListing: (listingId: string) => void;
  onCreateGigabytesListing: () => void;
  onOpenMarket?: () => void;
}) {
  const actionFamilies = families.filter(hasPendingFamilyAction);
  const [expandedFamilyId, setExpandedFamilyId] = useState<string | null>(null);
  const [familyFilter, setFamilyFilter] = useState<MyFamilyFilter>("all");
  const [familyRoleFilter, setFamilyRoleFilter] = useState<MyFamilyRoleFilter>("all");
  const [myMarketplaceRole, setMyMarketplaceRole] = useState<MarketplaceRequestRole>("seller");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isFamilyRolePickerOpen, setIsFamilyRolePickerOpen] = useState(false);
  const [scopeDragPosition, setScopeDragPosition] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (myProductScope !== "families") setIsCalendarOpen(false);
  }, [myProductScope]);
  const visibleFamilies = mode === "actions" ? actionFamilies : families;
  const filteredFamilies = visibleFamilies.filter(
    (item) =>
      mode !== "mine" ||
      (familyFilter === "all" || item.family.family_type === familyFilter) &&
      (familyRoleFilter === "all" || item.membership.role === familyRoleFilter)
  );
  const myAccountListingsQuery = useMyAccountListings(
    mode === "mine"
  );
  const myAccountListings = myAccountListingsQuery.data ?? [];
  const myGigabytesListingsQuery = useMyMarketplaceListings(
    mode === "mine"
  );
  const myGigabytesListings = myGigabytesListingsQuery.data ?? [];
  const myAccountPurchaseRequestsQuery = useAccountRequests(
    "buyer",
    mode === "mine" && myProductScope === "accounts" && myMarketplaceRole === "buyer"
  );
  const myAccountPurchaseRequests = myAccountPurchaseRequestsQuery.data ?? [];
  const myGigabytesPurchaseRequestsQuery = useMarketplaceRequests(
    "buyer",
    mode === "mine" && myProductScope === "gigabytes" && myMarketplaceRole === "buyer"
  );
  const myGigabytesPurchaseRequests = myGigabytesPurchaseRequestsQuery.data ?? [];
  const pendingRequestCount = requests.filter((request) => request.status === "pending").length;
  const ownerRequestCount = families.reduce(
    (total, item) => total + item.pending_requests_count,
    0
  );
  const paymentActionCount = families.reduce(
    (total, item) =>
      total +
      item.payments.filter((payment) =>
        ["due", "overdue", "payment_reported"].includes(payment.status)
      ).length,
    0
  );
  const accessActionCount = families.filter((item) =>
    ["awaiting_access", "awaiting_confirmation"].includes(item.membership.status)
  ).length;
  const hasMarketplaceSalesActions =
    mode === "actions" &&
    marketplaceSalesActionCount > 0 &&
    Boolean(onOpenMarketplaceSalesActions);
  const hasMarketplacePurchaseActions =
    mode === "actions" &&
    marketplacePurchaseActionCount > 0 &&
    Boolean(onOpenMarketplacePurchaseActions);
  const hasAccountSalesActions =
    mode === "actions" &&
    accountSalesActionCount > 0 &&
    Boolean(onOpenAccountSalesActions);
  const hasAccountPurchaseActions =
    mode === "actions" &&
    accountPurchaseActionCount > 0 &&
    Boolean(onOpenAccountPurchaseActions);
  const hasMarketplaceActions =
    hasMarketplaceSalesActions ||
    hasMarketplacePurchaseActions ||
    hasAccountSalesActions ||
    hasAccountPurchaseActions;
  const hasFamilyActions =
    pendingRequestCount + ownerRequestCount + paymentActionCount + accessActionCount > 0;
  const showFilteredFamiliesEmptyState =
    mode === "mine" &&
    families.length > 0 &&
    (familyFilter !== "all" || familyRoleFilter !== "all") &&
    filteredFamilies.length === 0;
  const showFamiliesEmptyState =
    filteredFamilies.length === 0 &&
    (mode === "mine" || (!hasFamilyActions && !hasMarketplaceActions));
  const activeFamilyRoleLabel =
    myFamilyRoleOptions.find((option) => option.value === familyRoleFilter)?.label;

  const renderFamilySection = () => (
    <>
      {isLoading && visibleFamilies.length === 0 ? (
        <FamilyListSkeleton count={3} />
      ) : showFamiliesEmptyState ? (
        <EmptyState
          className={mode === "mine" ? "my-family-empty-state" : undefined}
          icon={mode === "mine" ? <SystemSymbol name="person.2" size={32} /> : undefined}
          title={mode === "actions" ? "Сейчас нет действий" : showFilteredFamiliesEmptyState ? "По выбранным фильтрам пусто" : "Пока нет семей"}
        >
          {mode === "actions" ? (
            "Когда появится заявка, доступ или оплата, она будет здесь."
          ) : showFilteredFamiliesEmptyState ? (
            "Измените тип или роль, чтобы увидеть остальные семьи."
          ) : (
            <>
              <span>Найдите подходящую семью или создайте свою.</span>
              {onOpenMarket ? (
                <AppButton type="button" variant="primary" size="sm" onClick={onOpenMarket}>
                  Открыть Маркет
                </AppButton>
              ) : null}
            </>
          )}
        </EmptyState>
      ) : (
        <div className="stack">
          {filteredFamilies.map((item) => {
            const details = ownerDetails[item.family.id];
            return (
              <article
                className={mode === "mine" && expandedFamilyId !== item.family.id ? "my-family-preview" : "family-workspace"}
                data-family-id={item.family.id}
                data-testid="family-workspace"
                key={item.membership.id}
              >
                {mode === "mine" ? (
                  <FamilyListingCard
                    family={item.family}
                    status={item.membership.role === "owner" ? "Вы владелец" : statusText(item.membership.status)}
                    onClick={() => setExpandedFamilyId((current) => current === item.family.id ? null : item.family.id)}
                  />
                ) : null}
                {mode !== "mine" || expandedFamilyId === item.family.id ? (
                  <>
                <FamilyCard family={item.family}>
                  <Badge>{statusText(item.membership.status)}</Badge>
                  <AppButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    data-testid="workspace-open-family-button"
                    onClick={() => onOpenFamily(item.family.id)}
                  >
                    Подробнее
                  </AppButton>
                </FamilyCard>
                {item.membership.role === "owner" && (
                  <OwnerWorkSummary
                    pendingRequestsCount={item.pending_requests_count}
                    activeMembersCount={item.family.active_members_count}
                    maxMembers={item.family.max_members}
                    freeSlots={item.family.free_slots}
                  />
                )}
                {item.membership.role !== "owner" && (
                  <MemberNextStep member={item.membership} payments={item.payments} />
                )}
                <div className="workspace-actions">
                  {item.membership.role === "owner" ? (
                    <OwnerActions
                      family={item.family}
                      busy={busy}
                      onLoadOwnerDetails={onLoadOwnerDetails}
                      onUpdateDescription={onUpdateDescription}
                      onUpdatePrice={onUpdatePrice}
                      onUpdatePaymentDay={onUpdatePaymentDay}
                      onCloseFamily={onCloseFamily}
                      onConfirmAvailability={onConfirmAvailability}
                    />
                  ) : (
                    <MemberActions
                      familyId={item.family.id}
                      member={item.membership}
                      familyStatus={item.family.status}
                      busy={busy}
                      onConfirmAccess={onConfirmAccess}
                      onGetRequisite={onGetRequisite}
                      onAcknowledgeClosing={onAcknowledgeClosing}
                      onLeaveFamily={onLeaveFamily}
                      onCreatePrepayment={onCreatePrepayment}
                    />
                  )}
                </div>
                {requisites[item.membership.id] && (
                  <RequisiteBox requisite={requisites[item.membership.id]} />
                )}
                {item.payments.length > 0 && (
                  <PaymentList
                    payments={item.payments}
                    onReport={onReportPayment}
                    onCancel={onCancelPaymentReport}
                  />
                )}
                {details && (
                  <OwnerDetails
                    family={item.family}
                    details={details}
                    onApprove={(request) => onApproveRequest(item.family.id, request)}
                    onReject={(request) => onRejectRequest(item.family.id, request)}
                    onAccessProvided={(member) =>
                      onAccessProvided(item.family.id, member)
                    }
                    onRemindAccess={(member) =>
                      onRemindAccess(item.family.id, member)
                    }
                    onCancelBeforeAccess={(member) =>
                      onCancelBeforeAccess(item.family.id, member)
                    }
                    onRemove={(member, reason) =>
                      onRemoveMember(item.family.id, member, reason)
                    }
                    onConfirmPayment={(payment) =>
                      onConfirmPayment(item.family.id, payment)
                    }
                    onNotReceived={(payment) => onNotReceived(item.family.id, payment)}
                    onRecordPrepayment={(member, periods) =>
                      onRecordPrepayment(item.family.id, member, periods)
                    }
                  />
                )}
                  </>
                ) : null}
              </article>
            );
          })}
          {hasMoreFamilies && onLoadMoreFamilies ? (
            <AppButton
              type="button"
              variant="secondary"
              fullWidth
              disabled={isLoadingMoreFamilies}
              onClick={onLoadMoreFamilies}
            >
              {isLoadingMoreFamilies ? "Загружаем семьи..." : "Показать ещё семьи"}
            </AppButton>
          ) : null}
        </div>
      )}
    </>
  );

  if (loadError) {
    return <Panel title={mode === "actions" ? "Действия" : "Мои"}>
      <div className="ui-feedback ui-feedback-error" role="alert">
        <strong>Не удалось загрузить данные</strong>
        <p>Проверьте соединение и попробуйте ещё раз.</p>
        <AppButton variant="secondary" onClick={onRetry}>Повторить</AppButton>
      </div>
    </Panel>;
  }

  return (
    <div
      className={mode === "actions" ? "actions-screen" : "my-screen"}
      data-testid={mode === "actions" ? "actions-screen" : "my-screen"}
    >
      <Panel
        title={mode === "actions" ? "Действия" : "Мои"}
        action={mode === "mine" ? (
          <MyScreenContextAction
            scope={myProductScope}
            isCalendarOpen={isCalendarOpen}
            onToggleCalendar={() => setIsCalendarOpen((open) => !open)}
            tradeRole={myMarketplaceRole}
            onTradeRoleChange={setMyMarketplaceRole}
          />
        ) : undefined}
      >
        {mode === "mine" ? (
          <div className="my-screen-filters">
            <ProductScopeSwitch
              value={myProductScope}
              familiesLabel="Подписки"
              onChange={onChangeProductScope}
              dragPosition={scopeDragPosition}
            />
          </div>
        ) : null}
        {mode === "mine" ? (
          <MyProductScopePager
            value={myProductScope}
            onChange={onChangeProductScope}
            onDragPositionChange={setScopeDragPosition}
            renderPane={(scope) => {
              if (scope === "accounts") {
                return (
                  myMarketplaceRole === "buyer" ? (
                    <MyAccountPurchasesSection
                      requests={myAccountPurchaseRequests}
                      query={myAccountPurchaseRequestsQuery}
                    />
                  ) : (
                    <MyAccountListingsSection
                      listings={myAccountListings}
                      query={myAccountListingsQuery}
                      onOpenListing={onOpenAccountListing}
                      onCreateListing={onCreateAccountListing}
                    />
                  )
                );
              }
              if (scope === "gigabytes") {
                return (
                  myMarketplaceRole === "buyer" ? (
                    <MyGigabytesPurchasesSection
                      requests={myGigabytesPurchaseRequests}
                      query={myGigabytesPurchaseRequestsQuery}
                    />
                  ) : (
                    <MyGigabytesListingsSection
                      listings={myGigabytesListings}
                      query={myGigabytesListingsQuery}
                      onOpenListing={onOpenGigabytesListing}
                      onCreateListing={onCreateGigabytesListing}
                    />
                  )
                );
              }
              return (
                <>
                  <div className="my-family-filter-row">
                    <div className="my-family-section-heading">
                      <h2 className="my-family-section-title">Семьи</h2>
                      <span className="my-family-section-count">{filteredFamilies.length}</span>
                    </div>
                    <FamilyRoleControl
                      value={familyRoleFilter}
                      isOpen={isFamilyRolePickerOpen}
                      onToggle={() => setIsFamilyRolePickerOpen((open) => !open)}
                      onClose={() => setIsFamilyRolePickerOpen(false)}
                      onChange={setFamilyRoleFilter}
                    />
                    <MyFamilyFilter value={familyFilter} onChange={setFamilyFilter} />
                  </div>
                  <div
                    id="my-family-calendar"
                    className={`my-calendar-disclosure${isCalendarOpen ? " is-open" : ""}`}
                    aria-hidden={!isCalendarOpen}
                    inert={!isCalendarOpen}
                  >
                    <div className="my-calendar-disclosure-content">
                      <PaymentCalendar families={filteredFamilies} />
                    </div>
                  </div>
                  {renderFamilySection()}
                </>
              );
            }}
          />
        ) : (
          <>
            {mode === "actions" && hasFamilyActions ? (
              <ActionSummary
                totalActionCount={
                  pendingRequestCount +
                  ownerRequestCount +
                  paymentActionCount +
                  accessActionCount
                }
                pendingRequestCount={pendingRequestCount}
                ownerRequestCount={ownerRequestCount}
                paymentActionCount={paymentActionCount}
                accessActionCount={accessActionCount}
              />
            ) : null}
            {hasMarketplaceSalesActions ? (
              <article className="list-row" data-testid="marketplace-actions-card">
                <div className="list-row-main">
                  <strong>Продажа гигабайтов</strong>
                  <span>{marketplaceSalesActionCount} заявок требуют ответа или завершения</span>
                </div>
                <AppButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  data-testid="open-marketplace-actions"
                  onClick={onOpenMarketplaceSalesActions}
                >
                  Открыть
                </AppButton>
              </article>
            ) : null}
            {hasMarketplacePurchaseActions ? (
              <article className="list-row" data-testid="marketplace-purchase-actions-card">
                <div className="list-row-main">
                  <strong>Покупка гигабайтов</strong>
                  <span>{marketplacePurchaseActionCount} заявок приняты продавцами</span>
                </div>
                <AppButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  data-testid="open-marketplace-purchase-actions"
                  onClick={onOpenMarketplacePurchaseActions}
                >
                  Открыть
                </AppButton>
              </article>
            ) : null}
            {hasAccountSalesActions ? (
              <article className="list-row" data-testid="account-sales-actions-card">
                <div className="list-row-main">
                  <strong>Продажа аккаунтов</strong>
                  <span>{accountSalesActionCount} заявок требуют ответа или завершения</span>
                </div>
                <AppButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onOpenAccountSalesActions}
                >
                  Открыть
                </AppButton>
              </article>
            ) : null}
            {hasAccountPurchaseActions ? (
              <article className="list-row" data-testid="account-purchase-actions-card">
                <div className="list-row-main">
                  <strong>Покупка аккаунтов</strong>
                  <span>{accountPurchaseActionCount} заявок приняты продавцами</span>
                </div>
                <AppButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onOpenAccountPurchaseActions}
                >
                  Открыть
                </AppButton>
              </article>
            ) : null}
            {mode === "actions" ? (
              <>
                <MyRequestsSection
                  requests={requests}
                  busy={busy}
                  isLoading={requestsLoading}
                  onCancelRequest={onCancelRequest}
                />
                {hasMoreRequests && onLoadMoreRequests ? (
                  <AppButton
                    type="button"
                    variant="secondary"
                    fullWidth
                    disabled={isLoadingMoreRequests}
                    onClick={onLoadMoreRequests}
                  >
                    {isLoadingMoreRequests ? "Загружаем заявки..." : "Показать ещё заявки"}
                  </AppButton>
                ) : null}
              </>
            ) : null}
            {mode === "actions" && actionFamilies.length > 0 ? (
              <div className="section-inline-title">
                <span>Семьи с действиями</span>
                <Badge>{actionFamilies.length}</Badge>
              </div>
            ) : null}
            {renderFamilySection()}
          </>
        )}
      </Panel>
    </div>
  );
}

function MyFamilyFilter({
  value,
  onChange
}: {
  value: MyFamilyFilter;
  onChange: (value: MyFamilyFilter) => void;
}) {
  const activeOption = myFamilyFilterOptions.find((option) => option.value === value) ?? myFamilyFilterOptions[0];
  const activeIndex = myFamilyFilterOptions.findIndex((option) => option.value === activeOption.value);

  return (
    <div className="my-family-filter-actions" onPointerDown={(event) => event.stopPropagation()}>
      <button
        type="button"
        className={`sm-market-filter-chip${value !== "all" ? " is-active" : ""}`}
        aria-label={`Фильтр семей: ${activeOption.label}. Нажмите для следующего фильтра`}
        title="Сменить тип семей"
        data-testid="my-family-filter-button"
        onClick={() => onChange(myFamilyFilterOptions[(activeIndex + 1) % myFamilyFilterOptions.length].value)}
      >
        <SystemSymbol name="sort" size={14} />
        <span data-testid="my-family-filter-label">{activeOption.label}</span>
      </button>
    </div>
  );
}

function MyScreenContextAction({
  scope,
  isCalendarOpen,
  onToggleCalendar,
  tradeRole,
  onTradeRoleChange
}: {
  scope: MyProductScope;
  isCalendarOpen: boolean;
  onToggleCalendar: () => void;
  tradeRole: MarketplaceRequestRole;
  onTradeRoleChange: (role: MarketplaceRequestRole) => void;
}) {
  const [isTradeMenuOpen, setIsTradeMenuOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsTradeMenuOpen(false);
  }, [scope]);

  useEffect(() => {
    if (!isTradeMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) {
        setIsTradeMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsTradeMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTradeMenuOpen]);

  if (scope === "families") {
    return (
      <button
        type="button"
        className={`my-screen-context-action${isCalendarOpen ? " is-active" : ""}`}
        aria-expanded={isCalendarOpen}
        aria-controls="my-family-calendar"
        aria-label="Календарь"
        title="Календарь платежей"
        data-testid="my-family-calendar-trigger"
        onClick={onToggleCalendar}
      >
        <SystemSymbol name="calendar" size={24} />
      </button>
    );
  }

  const productLabel = scope === "accounts" ? "аккаунтов" : "ГБ";
  const menuId = `my-${scope}-trade-menu`;

  function selectTradeRole(role: MarketplaceRequestRole) {
    setIsTradeMenuOpen(false);
    onTradeRoleChange(role);
  }

  return (
    <div ref={controlRef} className="my-screen-context-control">
      <button
        type="button"
        className={`my-screen-context-action${isTradeMenuOpen ? " is-active" : ""}`}
        aria-haspopup="menu"
        aria-expanded={isTradeMenuOpen}
        aria-controls={menuId}
        aria-label={`Покупки и продажи ${productLabel}`}
        title={`Покупки и продажи ${productLabel}`}
        data-testid={`my-${scope}-trade-trigger`}
        onClick={() => setIsTradeMenuOpen((open) => !open)}
      >
        <SystemSymbol name="round-sort-vertical" size={24} />
      </button>
      {isTradeMenuOpen ? (
        <div
          id={menuId}
          className="my-screen-context-menu"
          role="menu"
          aria-label={`Покупки и продажи ${productLabel}`}
        >
          <span className="my-screen-context-menu-label">Мои сделки</span>
          <button
            type="button"
            className="my-screen-context-option"
            role="menuitemradio"
            aria-checked={tradeRole === "buyer"}
            data-testid={`my-${scope}-buyer-action`}
            onClick={() => selectTradeRole("buyer")}
          >
            <span className="my-screen-context-option-icon">
              <SystemSymbol name="person.crop.circle" size={18} />
            </span>
            <span className="my-screen-context-option-copy">
              <strong>Покупки</strong>
            </span>
            {tradeRole === "buyer" ? <SystemSymbol name="checkmark" size={17} /> : null}
          </button>
          <button
            type="button"
            className="my-screen-context-option"
            role="menuitemradio"
            aria-checked={tradeRole === "seller"}
            data-testid={`my-${scope}-seller-action`}
            onClick={() => selectTradeRole("seller")}
          >
            <span className="my-screen-context-option-icon">
              <SystemSymbol name="clipboard.list" size={18} />
            </span>
            <span className="my-screen-context-option-copy">
              <strong>Продажи</strong>
            </span>
            {tradeRole === "seller" ? <SystemSymbol name="checkmark" size={17} /> : null}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FamilyRoleControl({
  value,
  isOpen,
  onToggle,
  onClose,
  onChange
}: {
  value: MyFamilyRoleFilter;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (value: MyFamilyRoleFilter) => void;
}) {
  const controlRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const activeFamilyRoleLabel =
    myFamilyRoleOptions.find((option) => option.value === value)?.label ?? "Все роли";

  function closePopover() {
    onClose();
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <div
      ref={controlRef}
      className="my-family-role-control"
    >
      <button
        ref={triggerRef}
        type="button"
        className={`sm-market-filter-chip my-family-role-trigger${value !== "all" ? " is-active" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="my-family-role-picker"
        aria-label={`Роль: ${activeFamilyRoleLabel}. Открыть фильтр роли`}
        data-testid="my-family-role-trigger"
        onClick={onToggle}
      >
        <SystemSymbol name="person.2" size={14} />
        <span>{activeFamilyRoleLabel}</span>
      </button>
      {isOpen ? (
        <div
        className="my-family-role-picker"
        id="my-family-role-picker"
        role="dialog"
        aria-label="Роль в семье"
      >
          <span className="my-family-role-picker-label">Роль в семье</span>
          <div className="my-family-role-options" role="group" aria-label="Роль в семье">
            {myFamilyRoleOptions.map((option) => {
              const isActive = value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`my-family-role-option${isActive ? " is-active" : ""}`}
                  aria-pressed={isActive}
                  autoFocus={isActive || (value === "all" && option.value === "member")}
                  data-testid={`my-family-role-${option.value}`}
                  onClick={() => {
                    onChange(option.value);
                    closePopover();
                  }}
                >
                  <span className="my-family-role-option-icon">
                    <SystemSymbol name={option.icon} size={18} />
                  </span>
                  <span>{option.label}</span>
                  {isActive ? <SystemSymbol name="checkmark" size={17} /> : null}
                </button>
              );
            })}
          </div>
          {value !== "all" ? (
            <button
              type="button"
              className="my-family-role-reset"
              data-testid="my-family-role-all"
              onClick={() => {
                onChange("all");
                closePopover();
              }}
            >
              Все роли
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type PaymentCalendarEvent = {
  dateKey: string;
  family: MyFamily;
};

function parseCalendarDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return { year, month: month - 1, day };
}

function calendarMonthKey(year: number, month: number) {
  return year * 12 + month;
}

function calendarDateKey(year: number, month: number, day: number) {
  return [year, String(month + 1).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

function calendarMonthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function calendarDateValue(value: string | null) {
  if (!value) return null;
  const { year, month, day } = parseCalendarDate(value);
  return new CalendarDate(year, month + 1, day);
}

function calendarDateKeyFromValue(value: CalendarDate) {
  return calendarDateKey(value.year, value.month - 1, value.day);
}

function calendarDayLabel(value: string) {
  const { year, month, day } = parseCalendarDate(value);
  return new Intl.DateTimeFormat("ru-KZ", {
    day: "numeric",
    month: "long"
  }).format(new Date(year, month, day));
}

function getCalendarInitialMonth(families: MyFamily[]) {
  const nextPayment = [...families]
    .filter((item) => !["closed"].includes(item.family.status))
    .sort((left, right) => left.family.next_payment_date.localeCompare(right.family.next_payment_date))[0]
    ?.family.next_payment_date;
  if (!nextPayment) return calendarMonthStart(new Date());
  const { year, month } = parseCalendarDate(nextPayment);
  return new Date(year, month, 1);
}

function getPaymentCalendarEvents(families: MyFamily[], visibleMonth: Date): PaymentCalendarEvent[] {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const visibleKey = calendarMonthKey(year, month);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return families.flatMap((item) => {
    const family = item.family;
    if (!["active", "full", "closing"].includes(family.status)) return [];

    const nextPayment = parseCalendarDate(family.next_payment_date);
    const nextPaymentKey = calendarMonthKey(nextPayment.year, nextPayment.month);
    if (visibleKey < nextPaymentKey) return [];
    if (family.period === "yearly" && month !== nextPayment.month) return [];

    const day = Math.min(nextPayment.day, daysInMonth);
    return [{
      dateKey: calendarDateKey(year, month, day),
      family: item
    }];
  });
}

function PaymentCalendar({ families }: { families: MyFamily[] }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef<Animation | null>(null);
  const dragRef = useRef<{ id: number; x: number; y: number; dx: number; dragging: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [visibleMonth, setVisibleMonth] = useState(() => getCalendarInitialMonth(families));
  const previousMonthRef = useRef(visibleMonth.getTime());
  useEffect(() => {
    const previous = previousMonthRef.current;
    previousMonthRef.current = visibleMonth.getTime();
    const grid = gridRef.current;
    if (!grid || previous === visibleMonth.getTime()) return;
    motionRef.current?.cancel();
    grid.style.transform = "";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const direction = visibleMonth.getTime() > previous ? 1 : -1;
    motionRef.current = grid.animate([
      { transform: `translateX(${reduced ? 0 : direction * 48}px)`, opacity: 0 },
      { transform: "translateX(0)", opacity: 1 }
    ], { duration: reduced ? 100 : 300, easing: "cubic-bezier(.22, 1, .36, 1)" });
    return () => motionRef.current?.cancel();
  }, [visibleMonth]);
  const [focusedValue, setFocusedValue] = useState(() => {
    const initialMonth = getCalendarInitialMonth(families);
    return new CalendarDate(initialMonth.getFullYear(), initialMonth.getMonth() + 1, 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [isSelectionOpen, setIsSelectionOpen] = useState(false);
  const events = getPaymentCalendarEvents(families, visibleMonth);
  const eventsByDate = new Map<string, PaymentCalendarEvent[]>();

  for (const event of events) {
    const current = eventsByDate.get(event.dateKey) ?? [];
    current.push(event);
    eventsByDate.set(event.dateKey, current);
  }

  useEffect(() => {
    setSelectedDateKey(null);
    setIsSelectionOpen(false);
  }, [visibleMonth]);

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const selectedEvents = selectedDateKey ? eventsByDate.get(selectedDateKey) ?? [] : [];
  const total = events.reduce((sum, event) => sum + event.family.family.member_share_kzt, 0);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  function handleCalendarFocusChange(value: CalendarDate) {
    setFocusedValue(value);
    const nextMonth = new Date(value.year, value.month - 1, 1);
    if (calendarMonthKey(nextMonth.getFullYear(), nextMonth.getMonth()) !== calendarMonthKey(year, month)) {
      setVisibleMonth(nextMonth);
    }
  }

  function handleCalendarDayClick(value: CalendarDate) {
    const dateKey = calendarDateKeyFromValue(value);
    if (!eventsByDate.has(dateKey)) return;
    if (selectedDateKey === dateKey && isSelectionOpen) {
      setSelectedDateKey(null);
      setIsSelectionOpen(false);
      return;
    }
    setSelectedDateKey(dateKey);
    setIsSelectionOpen(true);
  }

  function handleToday() {
    const current = new Date();
    setFocusedValue(new CalendarDate(current.getFullYear(), current.getMonth() + 1, current.getDate()));
    setVisibleMonth(calendarMonthStart(current));
  }

  return (
    <section className="my-payment-calendar" data-testid="my-payment-calendar" aria-label="Календарь платежей">
      <I18nProvider locale="ru-KZ">
        <Calendar
          className="my-payment-calendar-hero"
          aria-label="Платежи по семьям"
          firstDayOfWeek="mon"
          focusedValue={focusedValue}
          onFocusChange={handleCalendarFocusChange}
          value={calendarDateValue(selectedDateKey)}
          onChange={() => undefined}
        >
          <Calendar.Header className="my-payment-calendar-calendar-header">
            <div className="my-payment-calendar-month-heading">
              <button
                type="button"
                className="my-payment-calendar-month-button"
                aria-label={`${visibleMonth.toLocaleDateString("ru-KZ", { month: "long", year: "numeric" })}. ${isCurrentMonth ? "Текущий месяц" : "Вернуться к текущему месяцу"}`}
                onClick={handleToday}
              >
                <span className="my-payment-calendar-month-name">{visibleMonth.toLocaleDateString("ru-KZ", { month: "long" })}</span>
                <span className="my-payment-calendar-year">
                  {year}
                  <SystemSymbol name="arrow.clockwise" size={12} />
                </span>
              </button>
            </div>
            <div className={`my-payment-calendar-total${events.length ? "" : " is-empty"}`}>
              <span>Итого</span>
              <strong>{events.length ? `${total.toLocaleString("ru-KZ")} ₸` : "Нет платежей"}</strong>
            </div>
            <Calendar.NavButton slot="previous" aria-label="Предыдущий месяц" />
            <Calendar.NavButton slot="next" aria-label="Следующий месяц" />
          </Calendar.Header>
          <div
            className="my-calendar-month-viewport"
            onPointerDown={(event) => {
              event.stopPropagation();
              if (!event.isPrimary || event.button !== 0) return;
              suppressClickRef.current = false;
              dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dragging: false };
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (!drag || drag.id !== event.pointerId) return;
              drag.dx = event.clientX - drag.x;
              if (!drag.dragging) {
                if (Math.max(Math.abs(drag.dx), Math.abs(event.clientY - drag.y)) < 8) return;
                if (Math.abs(event.clientY - drag.y) > Math.abs(drag.dx)) {
                  dragRef.current = null;
                  return;
                }
                drag.dragging = true;
                suppressClickRef.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                motionRef.current?.cancel();
              }
              if (gridRef.current) gridRef.current.style.transform = `translateX(${drag.dx}px)`;
            }}
            onPointerUp={(event) => {
              const drag = dragRef.current;
              dragRef.current = null;
              if (!drag?.dragging) return;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
              if (Math.abs(drag.dx) >= 48) {
                handleCalendarFocusChange(new CalendarDate(year, month + 1, 1).add({ months: drag.dx < 0 ? 1 : -1 }));
              } else if (gridRef.current) {
                const from = gridRef.current.style.transform;
                gridRef.current.style.transform = "";
                motionRef.current = gridRef.current.animate([{ transform: from }, { transform: "translateX(0)" }], { duration: 200, easing: "ease-out" });
              }
            }}
            onPointerCancel={() => {
              dragRef.current = null;
              if (gridRef.current) gridRef.current.style.transform = "";
            }}
            onClickCapture={(event) => {
              if (!suppressClickRef.current) return;
              event.preventDefault();
              event.stopPropagation();
              suppressClickRef.current = false;
            }}
          >
          <div ref={gridRef}>
          <Calendar.Grid weekdayStyle="short">
            <Calendar.GridHeader>
              {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
            </Calendar.GridHeader>
            <Calendar.GridBody>
              {(date) => {
                const dateKey = calendarDateKeyFromValue(date);
                const dayEvents = eventsByDate.get(dateKey) ?? [];
                const previewEvent = dayEvents.find((event) => {
                  const serviceSlug = event.family.family.service_slug?.toLowerCase() ?? "";
                  const serviceName = event.family.family.service_name?.toLowerCase() ?? "";
                  return serviceSlug.includes("youtube") || serviceName.includes("youtube");
                }) ?? dayEvents[0];
                const dayLabel = dayEvents.length
                  ? `${calendarDayLabel(dateKey)}: ${dayEvents.map((event) => familyTitle(event.family.family)).join(", ")}`
                  : calendarDayLabel(dateKey);
                const eventDescriptionId = `my-payment-calendar-date-${dateKey}`;

                return (
                  <Calendar.Cell
                    date={date}
                    className={`my-payment-calendar-hero-cell${dayEvents.length ? " has-event" : ""}`}
                    aria-label={dayLabel}
                    aria-describedby={dayEvents.length ? eventDescriptionId : undefined}
                    onClick={() => handleCalendarDayClick(date)}
                  >
                    {({ formattedDate, isOutsideMonth }) => (
                      <>
                        <span className="my-payment-calendar-event-logos">
                          {previewEvent ? (
                            <ServiceLogo
                              key={previewEvent.family.family.id}
                              serviceSlug={previewEvent.family.family.service_slug}
                              serviceName={previewEvent.family.family.service_name}
                              familyType={previewEvent.family.family.family_type}
                              size={32}
                            />
                          ) : null}
                        </span>
                        {dayEvents.length > 1 ? <small className="my-payment-calendar-extra-count">+{dayEvents.length - 1}</small> : null}
                        <span className="my-payment-calendar-day-number">
                          {isOutsideMonth ? "" : formattedDate}
                        </span>
                        {dayEvents.length ? (
                          <span id={eventDescriptionId} className="sr-only">
                            {dayEvents.map((event) => familyTitle(event.family.family)).join(", ")}
                          </span>
                        ) : null}
                      </>
                    )}
                  </Calendar.Cell>
                );
              }}
            </Calendar.GridBody>
          </Calendar.Grid>
          </div>
          </div>
        </Calendar>
      </I18nProvider>

      <div
        className={`my-payment-calendar-selection-wrap${isSelectionOpen && selectedEvents.length ? " is-open" : ""}`}
        aria-hidden={!isSelectionOpen || selectedEvents.length === 0}
      >
        <div className="my-payment-calendar-selection" aria-live="polite">
          {selectedEvents.length > 0 ? (
            <>
              <div className="my-payment-calendar-selection-heading">
                {selectedDateKey ? calendarDayLabel(selectedDateKey) : ""}
              </div>
              <div className="my-payment-calendar-selection-list">
                {selectedEvents.map((event) => (
                  <div className="my-payment-calendar-selection-item" key={event.family.family.id}>
                    <ServiceLogo
                      serviceSlug={event.family.family.service_slug}
                      serviceName={event.family.family.service_name}
                      familyType={event.family.family.family_type}
                      size={24}
                    />
                    <strong>{familyTitle(event.family.family)}</strong>
                    <span>{event.family.family.member_share_kzt.toLocaleString("ru-KZ")} ₸</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

    </section>
  );
}

type MyAccountListingsQuery = ReturnType<typeof useMyAccountListings>;
type MyGigabytesListingsQuery = ReturnType<typeof useMyMarketplaceListings>;
type MyTradeRequestsQuery = {
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
  hasNextPage?: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
};
type MyTradeRequestPreview = {
  id: string;
  title: string;
  detail: string;
  status: string;
  counterparty?: string | null;
};

function MyAccountPurchasesSection({
  requests,
  query
}: {
  requests: AccountRequest[];
  query: MyTradeRequestsQuery;
}) {
  return (
    <MyTradeRequestsSection
      requests={requests.map((request) => ({
        id: request.id,
        title: request.title,
        detail: `${request.service_name} · ${formatMyKzt(request.price_kzt)}`,
        status: myTradeRequestStatus(request.status),
        counterparty: request.counterparty_username
      }))}
      query={query}
      emptyMessage="Здесь появятся выбранные вами доступы."
      title="Аккаунты"
    />
  );
}

function MyGigabytesPurchasesSection({
  requests,
  query
}: {
  requests: MarketplaceListingRequest[];
  query: MyTradeRequestsQuery;
}) {
  return (
    <MyTradeRequestsSection
      requests={requests.map((request) => ({
        id: request.id,
        title: `${request.operator_name} · ${request.amount_gb} ГБ`,
        detail: formatMyKzt(request.total_price_kzt),
        status: myTradeRequestStatus(request.status),
        counterparty: request.counterparty_username
      }))}
      query={query}
      emptyMessage="Здесь появятся выбранные вами пакеты."
    />
  );
}

function MyTradeRequestsSection({
  requests,
  query,
  emptyMessage,
  title
}: {
  requests: MyTradeRequestPreview[];
  query: MyTradeRequestsQuery;
  emptyMessage: string;
  title?: string;
}) {
  return (
    <AsyncContent query={query} label="Загружаем покупки...">
      <section className="my-account-listings my-trade-requests">
        {title ? <div className="my-family-filter-row my-generic-section-heading"><div className="my-family-section-heading"><h2 className="my-family-section-title">{title}</h2><span className="my-family-section-count">{requests.length}</span></div></div> : null}
        {requests.length === 0 ? (
          <EmptyState title="Покупок пока нет">{emptyMessage}</EmptyState>
        ) : (
          <div className="my-trade-request-list">
            {requests.map((request) => (
              <article className="my-trade-request" key={request.id}>
                <div className="my-trade-request-copy">
                  <strong>{request.title}</strong>
                  <span>{request.detail}</span>
                  {request.counterparty ? (
                    <small>@{request.counterparty}</small>
                  ) : null}
                </div>
                <span className="my-trade-request-status">{request.status}</span>
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

function formatMyKzt(value: number) {
  return `${value.toLocaleString("ru-KZ")} ₸`;
}

function myTradeRequestStatus(status: AccountRequest["status"]) {
  return ({
    pending: "Ожидает ответа",
    accepted: "Можно продолжить",
    rejected: "Отклонена",
    cancelled: "Отменена",
    closed: "Закрыта",
    expired: "Истёк срок"
  } as const)[status];
}

function MyAccountListingsSection({
  listings,
  query,
  onOpenListing,
  onCreateListing
}: {
  listings: AccountListing[];
  query: MyAccountListingsQuery;
  onOpenListing: (listingId: string) => void;
  onCreateListing: () => void;
}) {
  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const services = ["all", ...Array.from(new Set(listings.map((item) => item.service.name)))];
  const statuses = ["all", "active", "paused", "expired"];
  const filteredListings = listings.filter((item) => (serviceFilter === "all" || item.service.name === serviceFilter) && (statusFilter === "all" || item.status === statusFilter));
  const statusLabels: Record<string, string> = { all: "Статус", active: "Опубликовано", paused: "Приостановлено", expired: "Истекло" };
  return (
    <AsyncContent query={query} label="Загружаем объявления...">
      <section className="my-account-listings" data-testid="my-accounts-screen">
        <div className="my-family-filter-row my-generic-section-heading"><div className="my-family-section-heading"><h2 className="my-family-section-title">Аккаунты</h2><span className="my-family-section-count">{filteredListings.length}</span></div><div className="my-account-filter-chips" onPointerDown={(event) => event.stopPropagation()}><button type="button" className={`sm-market-filter-chip${serviceFilter !== "all" ? " is-active" : ""}`} onClick={() => setServiceFilter(services[(services.indexOf(serviceFilter) + 1) % services.length])}><SystemSymbol name="sort" size={14} />{serviceFilter === "all" ? "Сервисы" : serviceFilter}</button><button type="button" className={`sm-market-filter-chip${statusFilter !== "all" ? " is-active" : ""}`} onClick={() => setStatusFilter(statuses[(statuses.indexOf(statusFilter) + 1) % statuses.length])}><SystemSymbol name="sort" size={14} />{statusLabels[statusFilter]}</button></div></div>
        {filteredListings.length === 0 ? (
          <EmptyState title="Объявлений пока нет">
            Опубликуйте первое предложение доступа к сервису.
            <AppButton type="button" variant="secondary" size="sm" onClick={onCreateListing}>
              Добавить объявление
            </AppButton>
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
      </section>
    </AsyncContent>
  );
}

function MyGigabytesListingsSection({
  listings,
  query,
  onOpenListing,
  onCreateListing
}: {
  listings: MarketplaceListing[];
  query: MyGigabytesListingsQuery;
  onOpenListing: (listingId: string) => void;
  onCreateListing: () => void;
}) {
  return (
    <AsyncContent query={query} label="Загружаем объявления...">
      <section className="my-account-listings" data-testid="my-gigabytes-screen">
        {listings.length === 0 ? (
          <EmptyState title="Объявлений пока нет">
            Опубликуйте предложение, чтобы продавать интернет-пакеты.
            <AppButton type="button" variant="secondary" size="sm" onClick={onCreateListing}>
              Добавить объявление
            </AppButton>
          </EmptyState>
        ) : (
          <div className="sm-market-family-list">
            {listings.map((listing) => (
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
      </section>
    </AsyncContent>
  );
}

function MyProductScopePager({
  value,
  onChange,
  renderPane,
  onDragPositionChange
}: {
  value: MyProductScope;
  onChange: (value: MyProductScope) => void;
  renderPane: (scope: MyProductScope) => ReactNode;
  onDragPositionChange?: (position: number | undefined) => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const positionRef = useRef(myProductScopeOrder.indexOf(value));
  const pointerRef = useRef<MyProductScopePointerState | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const wasSwipedRef = useRef(false);
  const activeIndex = myProductScopeOrder.indexOf(value);
  const pagePercent = 100 / myProductScopeOrder.length;

  function setPosition(position: number) {
    positionRef.current = position;
    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(${-position * pagePercent}%, 0, 0)`;
    }
    onDragPositionChange?.(position);
  }

  function stopAnimation() {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = null;
  }

  function animateTo(nextPosition: number, initialVelocity = 0) {
    const target = Math.min(Math.max(nextPosition, 0), myProductScopeOrder.length - 1);
    stopAnimation();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPosition(target);
      return;
    }

    let position = positionRef.current;
    let velocity = Math.max(-4, Math.min(4, initialVelocity));
    let previousTime = performance.now();
    const step = (time: number) => {
      const deltaTime = Math.min((time - previousTime) / 1000, 0.032);
      previousTime = time;
      const acceleration = (target - position) * 260 - velocity * 32;
      velocity += acceleration * deltaTime;
      position += velocity * deltaTime;
      setPosition(position);

      if (Math.abs(target - position) < 0.001 && Math.abs(velocity) < 0.01) {
        setPosition(target);
        animationFrameRef.current = null;
        return;
      }
      animationFrameRef.current = requestAnimationFrame(step);
    };
    animationFrameRef.current = requestAnimationFrame(step);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    stopAnimation();
    wasSwipedRef.current = false;
    pointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originPosition: positionRef.current,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocityX: 0,
      isDragging: false,
      cancelled: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId || pointer.cancelled) return;
    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    if (!pointer.isDragging) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        pointer.cancelled = true;
        pointerRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        return;
      }
      pointer.isDragging = true;
      wasSwipedRef.current = true;
    }

    const now = performance.now();
    const elapsed = Math.max(1, now - pointer.lastTime);
    pointer.velocityX = ((event.clientX - pointer.lastX) / elapsed) * 1000;
    pointer.lastX = event.clientX;
    pointer.lastTime = now;
    const width = viewportRef.current?.clientWidth || 1;
    const rawPosition = pointer.originPosition - deltaX / width;
    const lastIndex = myProductScopeOrder.length - 1;
    const position = rawPosition < 0
      ? rawPosition * 0.25
      : rawPosition > lastIndex
        ? lastIndex + (rawPosition - lastIndex) * 0.25
        : rawPosition;
    setPosition(position);
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    pointerRef.current = null;
    onDragPositionChange?.(undefined);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (pointer.cancelled) return;
    if (cancelled) {
      animateTo(Math.round(positionRef.current));
      return;
    }
    if (!pointer.isDragging) return;

    const deltaX = event.clientX - pointer.startX;
    const width = viewportRef.current?.clientWidth || 1;
    const passedDistance = Math.abs(deltaX) >= width * 0.18;
    const passedVelocity = Math.abs(pointer.velocityX) >= 450;
    let target = Math.round(positionRef.current);
    if (passedDistance || passedVelocity) {
      const direction = deltaX < 0 || pointer.velocityX < 0 ? 1 : -1;
      target = Math.round(pointer.originPosition) + direction;
    }
    target = Math.min(Math.max(target, 0), myProductScopeOrder.length - 1);
    animateTo(target, -pointer.velocityX / width);
    if (target !== activeIndex) onChange(myProductScopeOrder[target]);
  }

  useEffect(() => {
    if (pointerRef.current) return;
    if (Math.abs(positionRef.current - activeIndex) < 0.001) {
      setPosition(activeIndex);
      return;
    }
    animateTo(activeIndex);
  }, [activeIndex]);

  useEffect(() => () => stopAnimation(), []);

  return (
    <div
      className="my-product-scope-swipe-viewport"
      ref={viewportRef}
      role="group"
      aria-label="Разделы Моих объявлений"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => handlePointerEnd(event)}
      onPointerCancel={(event) => handlePointerEnd(event, true)}
      onClickCapture={(event) => {
        if (!wasSwipedRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        wasSwipedRef.current = false;
      }}
    >
      <div
        className="my-product-scope-swipe-track"
        ref={trackRef}
        style={{ transform: `translate3d(${-positionRef.current * pagePercent}%, 0, 0)` }}
      >
        {myProductScopeOrder.map((scope) => (
          <div
            key={scope}
            className="my-product-scope-swipe-pane"
            data-product-scope={scope}
            aria-hidden={scope !== value}
            aria-live={scope === value ? "polite" : undefined}
          >
            {renderPane(scope)}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionSummary({
  totalActionCount,
  pendingRequestCount,
  ownerRequestCount,
  paymentActionCount,
  accessActionCount
}: {
  totalActionCount: number;
  pendingRequestCount: number;
  ownerRequestCount: number;
  paymentActionCount: number;
  accessActionCount: number;
}) {
  return (
    <section className="action-summary" data-testid="actions-summary" aria-label="Сводка действий">
      <div>
        <div className="action-summary-primary-head">
          <span>Требует внимания</span>
          <span className="action-summary-status">Нужно проверить</span>
        </div>
        <strong>{totalActionCount}</strong>
      </div>
      <div>
        <span>Мои заявки</span>
        <strong>{pendingRequestCount}</strong>
      </div>
      <div>
        <span>Входящие</span>
        <strong>{ownerRequestCount}</strong>
      </div>
      <div>
        <span>Оплаты</span>
        <strong>{paymentActionCount}</strong>
      </div>
      <div>
        <span>Доступ</span>
        <strong>{accessActionCount}</strong>
      </div>
    </section>
  );
}

function MyRequestsSection({
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
    <section className="my-requests-section" data-testid="my-requests-section">
      <div className="section-inline-title">
        <span>Активные заявки</span>
        <Badge>{requests.filter((request) => request.status === "pending").length}</Badge>
      </div>
      <div className="stack">
          {requests.map((request) => (
            <article
            className={`list-row request-card request-card-${request.status}`}
            data-testid="request-card"
            key={request.id}
          >
            <div>
              <div className="request-card-heading">
                <div>
                  <span className={`type-label type-label-${request.family_type}`}>
                    {familyKindLabels[request.family_type]}
                  </span>
                  <Typography as="strong" variant="subtitle" level={3}>
                    {familyTitle(request)}
                  </Typography>
                </div>
                <Badge>{statusText(request.status)}</Badge>
              </div>
              <Typography as="p" variant="body" level={3} className="request-card-dates">
                <span>Создана {formatDateTime(request.created_at)}</span>
                <span>Истекает {formatDateTime(request.expires_at)}</span>
              </Typography>
              {request.cancel_reason && (
                <Typography as="small" variant="body" level={4}>
                  {requestCancelReasonLabels[request.cancel_reason] ??
                    request.cancel_reason}
                </Typography>
              )}
            </div>
            {request.status === "pending" && (
              <div className="row-actions">
                {request.owner_username && (
                  <AppButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    data-testid="request-owner-chat-button"
                    onClick={() =>
                      openTelegramUser(
                        request.owner_username!,
                        `Здравствуйте, я оставил заявку в вашу семью ${familyTitle(request)} в SubsMarket.`
                      )
                    }
                  >
                    Написать владельцу
                  </AppButton>
                )}
                <AppButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => onCancelRequest(request.id)}
                >
                  Отменить
                </AppButton>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function hasPendingFamilyAction(item: MyFamily) {
  if (item.pending_requests_count > 0) return true;
  if (["awaiting_access", "awaiting_confirmation"].includes(item.membership.status)) {
    return true;
  }
  return item.payments.some((payment) =>
    ["due", "overdue", "payment_reported"].includes(payment.status)
  );
}

function MemberNextStep({
  member,
  payments
}: {
  member: FamilyMember;
  payments: FamilyPayment[];
}) {
  const openPayment = payments.find((payment) =>
    ["due", "overdue", "payment_reported"].includes(payment.status)
  );
  const step = getMemberStep(member, openPayment);

  return (
    <div className={`member-next-step member-next-step-${step.tone}`}>
      <span>Мой следующий шаг</span>
      <strong>{step.title}</strong>
      <p>{step.text}</p>
    </div>
  );
}

function getMemberStep(member: FamilyMember, payment?: FamilyPayment) {
  if (member.status === "awaiting_access") {
    return {
      tone: "info",
      title: "Ждите доступ от владельца",
      text: "Деньги переводить пока не нужно. Сначала владелец добавляет вас в подписку."
    };
  }
  if (member.status === "awaiting_confirmation") {
    return {
      tone: "warning",
      title: "Проверьте доступ",
      text: "Если подписка работает, нажмите «Доступ получен». После этого откроются реквизиты."
    };
  }
  if (member.status === "removal_pending") {
    return {
      tone: "danger",
      title: "Удаление обрабатывается",
      text: "Это старое отложенное удаление. Новых действий от вас не требуется."
    };
  }
  if (payment?.status === "due" || payment?.status === "overdue") {
    return {
      tone: payment.status === "overdue" ? "danger" : "warning",
      title: "Оплатите владельцу",
      text: "Перевод идет напрямую владельцу. После перевода нажмите «Оплатил»."
    };
  }
  if (payment?.status === "payment_reported") {
    return {
      tone: "info",
      title: "Ждите подтверждение владельца",
      text: "Вы отметили оплату. Владелец должен вручную подтвердить получение."
    };
  }
  return {
    tone: "success",
    title: "Все в порядке",
    text: "Активных действий сейчас нет. Следующее напоминание придет перед датой оплаты."
  };
}

function OwnerWorkSummary({
  pendingRequestsCount,
  activeMembersCount,
  maxMembers,
  freeSlots
}: {
  pendingRequestsCount: number;
  activeMembersCount: number;
  maxMembers: number;
  freeSlots: number;
}) {
  return (
    <div className="owner-work-summary">
      <div>
        <span>Новые заявки</span>
        <strong>{pendingRequestsCount}</strong>
      </div>
      <div>
        <span>Участники</span>
        <strong>
          {activeMembersCount}/{maxMembers}
        </strong>
      </div>
      <div>
        <span>Свободно</span>
        <strong>{freeSlots}</strong>
      </div>
    </div>
  );
}

function OwnerActions({
  family,
  busy,
  onLoadOwnerDetails,
  onUpdateDescription,
  onUpdatePrice,
  onUpdatePaymentDay,
  onCloseFamily,
  onConfirmAvailability
}: {
  family: Family;
  busy: string | null;
  onLoadOwnerDetails: (familyId: string) => void;
  onUpdateDescription: (familyId: string, description: string | null) => void;
  onUpdatePrice: (familyId: string, totalPriceKzt: number) => void;
  onUpdatePaymentDay: (
    familyId: string,
    paymentDay: number,
    nextPaymentDate: string
  ) => void;
  onCloseFamily: (familyId: string, closesOn: string) => void;
  onConfirmAvailability: (familyId: string) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(family.description ?? "");
  const [priceDraft, setPriceDraft] = useState(String(family.total_price_kzt));
  const [paymentDayDraft, setPaymentDayDraft] = useState(String(family.payment_day));
  const [nextPaymentDateDraft, setNextPaymentDateDraft] = useState(
    family.next_payment_date
  );
  const today = new Date().toISOString().slice(0, 10);
  const defaultCloseDate =
    family.next_payment_date < today ? today : family.next_payment_date;
  const [closeDateDraft, setCloseDateDraft] = useState(defaultCloseDate);

  useEffect(() => {
    setDescriptionDraft(family.description ?? "");
    setPriceDraft(String(family.total_price_kzt));
    setPaymentDayDraft(String(family.payment_day));
    setNextPaymentDateDraft(family.next_payment_date);
    setCloseDateDraft(
      family.next_payment_date < today ? today : family.next_payment_date
    );
  }, [
    family.description,
    family.next_payment_date,
    family.payment_day,
    family.total_price_kzt,
    today
  ]);

  const descriptionValue = descriptionDraft.trim();
  const priceValue = Number(priceDraft);
  const paymentDayValue = Number(paymentDayDraft);
  const canSubmitPrice = Number.isFinite(priceValue) && priceValue > 0;
  const canSubmitPaymentDay =
    Number.isInteger(paymentDayValue) &&
    paymentDayValue >= 1 &&
    paymentDayValue <= 31 &&
    Boolean(nextPaymentDateDraft);

  return (
    <div className="owner-settings-card">
      <div className="row-actions">
        <AppButton
          type="button"
          size="sm"
          data-testid="owner-details-button"
          disabled={busy !== null}
          onClick={() => onLoadOwnerDetails(family.id)}
        >
          Заявки и участники
        </AppButton>
        <AppButton
          type="button"
          variant="secondary"
          size="sm"
          data-testid="confirm-availability-button"
          disabled={busy !== null || !["active", "full"].includes(family.status)}
          onClick={() => onConfirmAvailability(family.id)}
        >
          Семья актуальна
        </AppButton>
      </div>
      <Typography as="small" variant="body" level={4} className="muted">
        Последнее подтверждение:{" "}
        {family.availability_confirmed_at
          ? new Intl.DateTimeFormat("ru-KZ", {
              dateStyle: "short",
              timeStyle: "short"
            }).format(new Date(family.availability_confirmed_at))
          : "нет данных"}
      </Typography>

      <AppButton
        type="button"
        variant="tertiary"
        fullWidth
        data-testid="owner-settings-toggle"
        aria-expanded={settingsOpen}
        onClick={() => setSettingsOpen((current) => !current)}
      >
        {settingsOpen ? "Скрыть настройки" : "Настройки семьи"}
      </AppButton>

      {settingsOpen ? <div className="owner-settings-form">
        <div className="owner-settings-grid">
        <Input
          label="Доступ работает до"
          data-testid="close-family-date-input"
          min={today}
          type="date"
          value={closeDateDraft}
          onChange={(event) => setCloseDateDraft(event.target.value)}
        />
        <AppButton
          type="button"
          variant="secondary"
          data-testid="close-family-button"
          disabled={
            busy !== null ||
            !closeDateDraft ||
            closeDateDraft < today ||
            ["closing", "closed"].includes(family.status)
          }
          onClick={() => onCloseFamily(family.id, closeDateDraft)}
        >
          Закрыть семью
        </AppButton>
        </div>
        <Typography as="small" variant="body" level={4} className="muted">
          Семья сразу исчезнет из поиска, а участники увидят точную дату окончания
          доступа.
        </Typography>

        <TextArea
          label="Описание семьи"
          data-testid="owner-description-input"
          rows={3}
          value={descriptionDraft}
          onChange={(event) => setDescriptionDraft(event.target.value)}
        />
        <AppButton
          type="button"
          variant="secondary"
          data-testid="owner-save-description-button"
          disabled={busy !== null}
          onClick={() =>
            onUpdateDescription(family.id, descriptionValue ? descriptionValue : null)
          }
        >
          Сохранить описание
        </AppButton>

        <div className="owner-settings-grid">
          <Input
            label="Общая цена"
            data-testid="owner-price-input"
            min={1}
            type="number"
            value={priceDraft}
            onChange={(event) => setPriceDraft(event.target.value)}
          />
          <AppButton
            type="button"
            variant="secondary"
            data-testid="owner-save-price-button"
            disabled={busy !== null || !canSubmitPrice}
            onClick={() => onUpdatePrice(family.id, priceValue)}
          >
            Изменить цену
          </AppButton>
        </div>
        <Typography as="small" variant="body" level={4} className="muted">
          Цену можно менять один раз в месяц. Участники получат уведомление.
        </Typography>

        <div className="owner-settings-grid">
          <Input
            label="День оплаты"
            data-testid="owner-payment-day-input"
            max={31}
            min={1}
            type="number"
            value={paymentDayDraft}
            onChange={(event) => setPaymentDayDraft(event.target.value)}
          />
          <Input
            label="Следующая дата"
            data-testid="owner-next-payment-date-input"
            type="date"
            value={nextPaymentDateDraft}
            onChange={(event) => setNextPaymentDateDraft(event.target.value)}
          />
          <AppButton
            type="button"
            variant="secondary"
            data-testid="owner-save-payment-day-button"
            disabled={busy !== null || !canSubmitPaymentDay}
            onClick={() =>
              onUpdatePaymentDay(family.id, paymentDayValue, nextPaymentDateDraft)
            }
          >
            Изменить дату оплаты
          </AppButton>
        </div>
        <Typography as="small" variant="body" level={4} className="muted">
          Дату оплаты можно менять только пока семья ещё не была полностью собрана.
        </Typography>
      </div> : null}
    </div>
  );
}

function MemberActions({
  familyId,
  member,
  familyStatus,
  busy,
  onConfirmAccess,
  onGetRequisite,
  onAcknowledgeClosing,
  onLeaveFamily,
  onCreatePrepayment
}: {
  familyId: string;
  member: FamilyMember;
  familyStatus: string;
  busy: string | null;
  onConfirmAccess: (memberId: string) => void;
  onGetRequisite: (memberId: string) => void;
  onAcknowledgeClosing: (familyId: string) => void;
  onLeaveFamily: (memberId: string) => void;
  onCreatePrepayment: (memberId: string) => void;
}) {
  return (
    <>
      {member.status === "awaiting_confirmation" && (
        <AppButton
          type="button"
          data-testid="confirm-access-button"
          disabled={busy !== null}
          onClick={() => onConfirmAccess(member.id)}
        >
          Доступ получен
        </AppButton>
      )}
      {member.access_confirmed_at && (
        <AppButton
          type="button"
          variant="secondary"
          data-testid="show-requisite-button"
          disabled={busy !== null}
          onClick={() => onGetRequisite(member.id)}
        >
          Показать реквизиты
        </AppButton>
      )}
      {member.status === "active" && ["active", "full"].includes(familyStatus) && (
        <AppButton
          type="button"
          variant="secondary"
          data-testid="create-prepayment-button"
          disabled={busy !== null}
          onClick={() => onCreatePrepayment(member.id)}
        >
          Оплатить следующий период заранее
        </AppButton>
      )}
      {familyStatus === "closing" && (
        <AppButton
          type="button"
          data-testid="acknowledge-closing-button"
          disabled={busy !== null}
          onClick={() => onAcknowledgeClosing(familyId)}
        >
          Понятно, семья закрывается
        </AppButton>
      )}
      <AppButton
        type="button"
        variant="secondary"
        data-testid="leave-family-button"
        disabled={busy !== null}
        onClick={() => onLeaveFamily(member.id)}
      >
        Выйти
      </AppButton>
    </>
  );
}
