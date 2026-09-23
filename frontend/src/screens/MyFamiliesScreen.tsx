import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import { Button as AppButton } from "../components/ui";
import {
  FamilyCard,
  OwnerDetails,
  PaymentList,
  PaymentCalendar,
  OwnerActions,
  MemberActions,
  MemberNextStep,
  OwnerWorkSummary,
  MyAccountListingsSection,
  MyGigabytesSection
} from "../components/families";
import { ServiceLogo } from "../components/branding";
import { FamilyListingCard } from "../components/ListingCard";
import { SystemSymbol, type SystemSymbolName } from "../components/SystemSymbol";
import {
  Badge,
  EmptyState,
  Panel,
  ProductScopeSwitch
} from "../components/layout";
import { RequisiteBox } from "../components/RequisiteBox";
import { FamilyListSkeleton } from "../components/skeleton";
import {
  useMyAccountListings,
  useMyMarketplaceListings
} from "../hooks/useApi";
import { familyTitle, memberCardStatus, statusText } from "../format";
import { triggerTelegramImpact } from "../telegram";
import { useFeedSnap } from "../hooks/useFeedSnap";
import type {
  FamilyMember,
  FamilyMemberRemovalReason,
  FamilyPayment,
  FamilyRequest,
  MyFamily,
  OwnerFamilyDetails,
  PaymentRequisite
} from "../types";

export type MyProductScope = "families" | "accounts" | "gigabytes";
export type MyFamilyRoleFilter = "all" | "member" | "owner";

export const myFamilyRoleFilterOptions: readonly {
  value: MyFamilyRoleFilter;
  label: string;
  icon: SystemSymbolName;
}[] = [
  {
    value: "all",
    label: "Все роли",
    icon: "person.2"
  },
  {
    value: "member",
    label: "Участвую",
    icon: "person.2"
  },
  {
    value: "owner",
    label: "Организую",
    icon: "person.2.badge.plus"
  }
];

export type MyFamilyFilter = "all" | "tariff" | "subscription";

export const myFamilyFilterOptions: readonly { value: MyFamilyFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "tariff", label: "Тарифы" },
  { value: "subscription", label: "Сервисы" }
];

export const myProductScopeOrder: readonly MyProductScope[] = [
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

export type MyFamiliesScreenProps = {
  myProductScope?: MyProductScope;
  families: MyFamily[];
  ownerDetails: Record<string, OwnerFamilyDetails>;
  requisites: Record<string, PaymentRequisite>;
  busy: string | null;
  isLoading?: boolean;
  loadError?: boolean;
  onRetry?: () => void;
  hasMoreFamilies?: boolean;
  isLoadingMoreFamilies?: boolean;
  onLoadMoreFamilies?: () => void;
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
  onChangeProductScope: (scope: MyProductScope) => void;
  onOpenAccountListing: (listingId: string) => void;
  onCreateAccountListing: () => void;
  onOpenGigabytesListing: (listingId: string) => void;
  onCreateGigabytesListing: () => void;
  onOpenMarket?: () => void;
};

export function MyFamiliesScreen({
  myProductScope = "families",
  families,
  ownerDetails,
  requisites,
  busy,
  isLoading,
  loadError,
  onRetry,
  hasMoreFamilies,
  isLoadingMoreFamilies,
  onLoadMoreFamilies,
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
  onChangeProductScope,
  onOpenAccountListing,
  onCreateAccountListing,
  onOpenGigabytesListing,
  onCreateGigabytesListing,
  onOpenMarket
}: MyFamiliesScreenProps) {
  const [expandedFamilyId, setExpandedFamilyId] = useState<string | null>(null);
  const [familyRoleFilter, setFamilyRoleFilter] = useState<MyFamilyRoleFilter>("all");
  const [familyFilter, setFamilyFilter] = useState<MyFamilyFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const scopeSwitchRef = useRef<HTMLDivElement | null>(null);

  function handleScopePositionChange(position: number, isDragging: boolean) {
    const switchElement = scopeSwitchRef.current;
    if (!switchElement) return;
    const clampedPosition = Math.min(Math.max(position, 0), myProductScopeOrder.length - 1);
    switchElement.style.setProperty("--scope-position", String(clampedPosition));
    if (isDragging) {
      switchElement.dataset.scopeDragging = "true";
    } else {
      delete switchElement.dataset.scopeDragging;
    }
  }

  const prevScopeRef = useRef(myProductScope);
  useEffect(() => {
    if (prevScopeRef.current !== myProductScope) {
      prevScopeRef.current = myProductScope;
      if (myProductScope !== "families") setIsCalendarOpen(false);
      setIsHistoryOpen(false);
      setSearchTerm("");
    }
  }, [myProductScope]);

  useLayoutEffect(() => {
    handleScopePositionChange(myProductScopeOrder.indexOf(myProductScope), false);
  }, [myProductScope]);

  const searchedFamilies = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return families;
    return families.filter((item) => {
      const serviceName = item.family.service_name.toLowerCase();
      const planName = (item.family.plan_name ?? "").toLowerCase();
      const desc = (item.family.description ?? "").toLowerCase();
      return (
        serviceName.includes(term) ||
        planName.includes(term) ||
        desc.includes(term)
      );
    });
  }, [families, searchTerm]);

  const filteredFamilies = searchedFamilies.filter(
    (item) =>
      ((familyRoleFilter === "all" || item.membership.role === familyRoleFilter) &&
       (familyFilter === "all" || item.family.family_type === familyFilter))
  );

  const myAccountListingsQuery = useMyAccountListings(true);
  const myAccountListings = myAccountListingsQuery.data ?? [];
  const searchedAccountListings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return myAccountListings;
    return myAccountListings.filter((item) => {
      const title = item.title.toLowerCase();
      const serviceName = item.service.name.toLowerCase();
      const desc = (item.description ?? "").toLowerCase();
      return title.includes(term) || serviceName.includes(term) || desc.includes(term);
    });
  }, [myAccountListings, searchTerm]);

  const myGigabytesListingsQuery = useMyMarketplaceListings(true);
  const myGigabytesListings = myGigabytesListingsQuery.data ?? [];
  const searchedGigabytesListings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return myGigabytesListings;
    return myGigabytesListings.filter((item) => {
      const operatorName = item.operator.name.toLowerCase();
      const desc = (item.description ?? "").toLowerCase();
      return operatorName.includes(term) || desc.includes(term);
    });
  }, [myGigabytesListings, searchTerm]);

  const showFilteredFamiliesEmptyState =
    families.length > 0 &&
    (familyRoleFilter !== "all" || familyFilter !== "all" || Boolean(searchTerm.trim())) &&
    filteredFamilies.length === 0;

  const showFamiliesEmptyState = filteredFamilies.length === 0;

  const familiesFeedSnap = useFeedSnap({
    enabled: myProductScope === "families",
    itemCount: filteredFamilies.length
  });

  const renderFamilyList = (items: MyFamily[]) => (
    <>
      {items.map((item) => {
        const details = ownerDetails[item.family.id];
        const isExpanded = expandedFamilyId === item.family.id;
        return (
          <article
            className={!isExpanded ? "my-family-preview" : "family-workspace"}
            data-family-id={item.family.id}
            data-testid="family-workspace"
            key={item.membership.id}
          >
            <FamilyListingCard
              family={item.family}
              isOwner={item.membership.role === "owner"}
              status={item.membership.role === "owner" ? null : memberCardStatus(item)}
              onClick={() => {
                triggerTelegramImpact("light");
                setExpandedFamilyId((current) => (current === item.family.id ? null : item.family.id));
              }}
            />
            {isExpanded && (
              <>
                <FamilyCard family={item.family}>
                  <Badge>{item.membership.role === "owner" ? statusText(item.membership.status) : memberCardStatus(item)}</Badge>
                  <AppButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    data-testid="workspace-open-family-button"
                    onClick={() => onOpenFamily(item.family.id)}
                  >
                    Подробнее
                  </AppButton>
                  <AppButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      triggerTelegramImpact("light");
                      setExpandedFamilyId(null);
                    }}
                  >
                    Свернуть
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
            )}
          </article>
        );
      })}
    </>
  );

  const renderFamilySection = () => {
    return (
      <div
        className="my-feed-scroll"
        ref={familiesFeedSnap.containerRef}
        {...familiesFeedSnap.scrollHandlers}
      >
        {showFilteredFamiliesEmptyState ? (
          <EmptyState
            className="my-family-empty-state"
            title="Ничего не найдено"
            icon={<SystemSymbol name="magnifyingglass" size={32} />}
          >
            <span>Попробуйте изменить поисковый запрос или фильтр роли.</span>
            <AppButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setFamilyRoleFilter("all");
                setFamilyFilter("all");
                setSearchTerm("");
              }}
            >
              Сбросить фильтры
            </AppButton>
          </EmptyState>
        ) : showFamiliesEmptyState ? (
          <EmptyState
            className="my-family-empty-state"
            title="Семьи не найдены"
            icon={<SystemSymbol name="person.2" size={32} />}
          >
            <span>Найдите подходящую семью в каталоге или создайте свою.</span>
            {onOpenMarket ? (
              <AppButton
                type="button"
                variant="primary"
                size="sm"
                onClick={onOpenMarket}
              >
                Перейти в Маркет
              </AppButton>
            ) : null}
          </EmptyState>
        ) : (
          <>
            <div className="sm-market-family-list">
              {renderFamilyList(filteredFamilies)}
            </div>
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
          </>
        )}
      </div>
    );
  };

  return (
    <div className="my-screen" data-testid="my-screen">
      {loadError && onRetry && (
        <div className="panel error-panel" data-testid="my-load-error">
          <p>Не удалось обновить список семей</p>
          <AppButton type="button" size="sm" onClick={onRetry}>Повторить</AppButton>
        </div>
      )}

      {isLoading && families.length === 0 ? (
        <FamilyListSkeleton count={3} />
      ) : null}

      <Panel
        title="Мои"
        action={
          <MyScreenContextAction
            scope={myProductScope}
            isCalendarOpen={isCalendarOpen}
            onToggleCalendar={() => setIsCalendarOpen((open) => !open)}
            isHistoryOpen={isHistoryOpen}
            onToggleHistory={() => setIsHistoryOpen((open) => !open)}
          />
        }
      >
        <div className="my-screen-filters">
          <ProductScopeSwitch
            ref={scopeSwitchRef}
            value={myProductScope}
            familiesLabel="Подписки"
            activateOnPointerDown
            imperativePosition
            onChange={onChangeProductScope}
          />
        </div>

        <MyProductScopePager
          value={myProductScope}
          onChange={onChangeProductScope}
          onDragPositionChange={handleScopePositionChange}
          renderPane={(scope) => {
            if (scope === "accounts") {
              return (
                <MyAccountListingsSection
                  listings={searchedAccountListings}
                  rawCount={myAccountListings.length}
                  searchTerm={searchTerm}
                  onResetSearch={() => setSearchTerm("")}
                  query={myAccountListingsQuery}
                  onOpenListing={onOpenAccountListing}
                  onCreateListing={onCreateAccountListing}
                  onOpenMarket={onOpenMarket}
                  isHistoryOpen={isHistoryOpen}
                />
              );
            }
            if (scope === "gigabytes") {
              return (
                <MyGigabytesSection
                  listings={searchedGigabytesListings}
                  rawCount={myGigabytesListings.length}
                  searchTerm={searchTerm}
                  onResetSearch={() => setSearchTerm("")}
                  listingsQuery={myGigabytesListingsQuery}
                  onOpenListing={onOpenGigabytesListing}
                  onCreateListing={onCreateGigabytesListing}
                  onOpenMarket={onOpenMarket}
                  isHistoryOpen={isHistoryOpen}
                />
              );
            }
            return (
              <>
                <div className="my-family-filter-row">
                  <div className="my-family-section-heading">
                    <h2 className="my-family-section-title">Семьи</h2>
                    <span className="my-family-section-count">{filteredFamilies.length}</span>
                  </div>
                  <FamilyRoleChip
                    value={familyRoleFilter}
                    onChange={setFamilyRoleFilter}
                  />
                  <MyFamilyFilter
                    value={familyFilter}
                    onChange={setFamilyFilter}
                  />
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
      </Panel>
    </div>
  );
}

function MyScreenContextAction({
  scope,
  isCalendarOpen,
  onToggleCalendar,
  isHistoryOpen,
  onToggleHistory
}: {
  scope: MyProductScope;
  isCalendarOpen: boolean;
  onToggleCalendar: () => void;
  isHistoryOpen: boolean;
  onToggleHistory: () => void;
}) {
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
        onClick={() => {
          triggerTelegramImpact("light");
          onToggleCalendar();
        }}
      >
        <SystemSymbol name="calendar" size={24} />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`my-screen-context-action${isHistoryOpen ? " is-active" : ""}`}
      aria-expanded={isHistoryOpen}
      aria-controls={scope === "accounts" ? "my-account-orders" : "my-gigabytes-orders"}
      aria-label="История"
      title="История заказов"
      data-testid={scope === "accounts" ? "my-accounts-orders-trigger" : "my-gigabytes-orders-trigger"}
      onClick={() => {
        triggerTelegramImpact("light");
        onToggleHistory();
      }}
    >
      <SystemSymbol name="clock" size={24} />
    </button>
  );
}

function FamilyRoleChip({
  value,
  onChange
}: {
  value: MyFamilyRoleFilter;
  onChange: (value: MyFamilyRoleFilter) => void;
}) {
  const activeIndex = myFamilyRoleFilterOptions.findIndex((option) => option.value === value);
  const activeOption = myFamilyRoleFilterOptions[activeIndex >= 0 ? activeIndex : 0];

  return (
    <button
      type="button"
      className={`sm-market-filter-chip${value !== "all" ? " is-active" : ""}`}
      aria-label={`Фильтр роли: ${activeOption.label}. Нажмите для переключения`}
      data-testid="my-family-role-chip"
      onClick={() =>
        onChange(
          myFamilyRoleFilterOptions[
            (activeIndex + 1) % myFamilyRoleFilterOptions.length
          ].value
        )
      }
    >
      <SystemSymbol name={activeOption.icon} size={14} />
      <span data-testid="my-family-role-label">{activeOption.label}</span>
    </button>
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
    <div className="my-family-filter-actions">
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

function MyProductScopePager({
  value,
  onChange,
  renderPane,
  onDragPositionChange,
  ariaLabel = "Разделы Моих объявлений"
}: {
  value: MyProductScope;
  onChange: (value: MyProductScope) => void;
  renderPane: (scope: MyProductScope) => ReactNode;
  onDragPositionChange?: (position: number, isDragging: boolean) => void;
  ariaLabel?: string;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const positionRef = useRef(myProductScopeOrder.indexOf(value));
  const pointerRef = useRef<MyProductScopePointerState | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationTargetRef = useRef<number | null>(null);
  const wasSwipedRef = useRef(false);
  const activeIndex = myProductScopeOrder.indexOf(value);
  const pagePercent = 100 / myProductScopeOrder.length;
  const SWIPE_GAP = 16;

  function setPosition(position: number) {
    positionRef.current = position;
    if (trackRef.current) {
      const width = viewportRef.current?.clientWidth || 0;
      if (width > 0) {
        trackRef.current.style.transform = `translate3d(${-position * (width + SWIPE_GAP)}px, 0, 0)`;
      } else {
        trackRef.current.style.transform = `translate3d(calc(${-position * pagePercent}% - ${position * ((SWIPE_GAP * (myProductScopeOrder.length - 1)) / myProductScopeOrder.length)}px), 0, 0)`;
      }
    }
  }

  function stopAnimation() {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }

  function animateTo(
    nextPosition: number,
    initialVelocity = 0,
    interaction: "gesture" | "click" = "gesture"
  ) {
    const target = Math.min(Math.max(nextPosition, 0), myProductScopeOrder.length - 1);
    stopAnimation();
    animationTargetRef.current = target;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPosition(target);
      onDragPositionChange?.(target, false);
      animationTargetRef.current = null;
      return;
    }

    let position = positionRef.current;
    if (Math.abs(target - position) < 0.001 && Math.abs(initialVelocity) < 0.01) {
      setPosition(target);
      onDragPositionChange?.(target, false);
      animationTargetRef.current = null;
      return;
    }

    let velocity = Math.max(-4, Math.min(4, initialVelocity));
    const stiffness = 260;
    const damping = 32;
    onDragPositionChange?.(position, true);
    let previousTime = performance.now();
    const step = (time: number) => {
      const deltaTime = Math.min((time - previousTime) / 1000, 0.032);
      previousTime = time;
      const acceleration = (target - position) * stiffness - velocity * damping;
      velocity += acceleration * deltaTime;
      position += velocity * deltaTime;
      setPosition(position);
      onDragPositionChange?.(position, true);

      if (Math.abs(target - position) < 0.001 && Math.abs(velocity) < 0.01) {
        setPosition(target);
        onDragPositionChange?.(target, false);
        animationTargetRef.current = null;
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
    animationTargetRef.current = null;
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
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId || pointer.cancelled) return;
    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    if (!pointer.isDragging) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (absX < 8 && absY < 8) return;

      if (absY >= 14 && absY > absX * 1.4) {
        pointer.cancelled = true;
        pointerRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        return;
      }
      if (absX >= 8 && absX * 1.4 >= absY) {
        pointer.isDragging = true;
        wasSwipedRef.current = true;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {}
        if (viewportRef.current) {
          viewportRef.current.dataset.swiping = "true";
        }
      } else {
        return;
      }
    }

    const now = performance.now();
    const elapsed = Math.max(1, now - pointer.lastTime);
    pointer.velocityX = ((event.clientX - pointer.lastX) / elapsed) * 1000;
    pointer.lastX = event.clientX;
    pointer.lastTime = now;
    const width = viewportRef.current?.clientWidth || 1;
    const stepSize = width + SWIPE_GAP;
    const rawPosition = pointer.originPosition - deltaX / stepSize;
    const lastIndex = myProductScopeOrder.length - 1;
    const position = rawPosition < 0
      ? rawPosition * 0.25
      : rawPosition > lastIndex
        ? lastIndex + (rawPosition - lastIndex) * 0.25
        : rawPosition;
    setPosition(position);
    onDragPositionChange?.(position, true);
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
    if (viewportRef.current) {
      delete viewportRef.current.dataset.swiping;
    }
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    pointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (pointer.cancelled) {
      setPosition(activeIndex);
      onDragPositionChange?.(activeIndex, false);
      return;
    }
    if (cancelled) {
      animateTo(activeIndex);
      return;
    }
    if (!pointer.isDragging) return;

    const deltaX = event.clientX - pointer.startX;
    const width = viewportRef.current?.clientWidth || 1;
    const stepSize = width + SWIPE_GAP;
    const passedDistance = Math.abs(deltaX) >= width * 0.18;
    const passedVelocity = Math.abs(pointer.velocityX) >= 450;
    let target = Math.round(positionRef.current);
    if (passedDistance || passedVelocity) {
      const direction = passedVelocity
        ? (pointer.velocityX < 0 ? 1 : -1)
        : (deltaX < 0 ? 1 : -1);
      target = Math.round(pointer.originPosition) + direction;
    }
    target = Math.min(Math.max(target, 0), myProductScopeOrder.length - 1);
    animateTo(target, -pointer.velocityX / stepSize, "gesture");
    if (target !== activeIndex) {
      triggerTelegramImpact("light");
      onChange(myProductScopeOrder[target]);
    }
  }

  useLayoutEffect(() => {
    if (pointerRef.current) return;
    if (animationTargetRef.current === activeIndex) return;
    if (Math.abs(positionRef.current - activeIndex) < 0.001) {
      setPosition(activeIndex);
      onDragPositionChange?.(activeIndex, false);
      return;
    }
    animateTo(activeIndex, 0, "click");
  }, [activeIndex]);

  useEffect(() => () => {
    stopAnimation();
    animationTargetRef.current = null;
    if (viewportRef.current) {
      delete viewportRef.current.dataset.swiping;
    }
  }, []);

  return (
    <div
      className="my-product-scope-swipe-viewport"
      ref={viewportRef}
      data-testid="my-product-scope-swipe-viewport"
      role="group"
      aria-label={ariaLabel}
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
        data-testid="my-product-scope-swipe-track"
        style={{ transform: `translate3d(calc(${-positionRef.current * pagePercent}% - ${positionRef.current * ((SWIPE_GAP * (myProductScopeOrder.length - 1)) / myProductScopeOrder.length)}px), 0, 0)` }}
      >
        {myProductScopeOrder.map((scope) => (
          <div
            key={scope}
            className="my-product-scope-swipe-pane"
            data-testid="my-product-scope-swipe-pane"
            data-product-scope={scope}
            data-scope={scope}
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
