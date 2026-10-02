import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Button as AppButton } from "../components/ui";
import {
  FamilyRoleChip,
  MyAccountListingsSection,
  MyFamilyFilterChip,
  MyFamilyWorkspaceCard,
  MyGigabytesSection,
  MyProductScopePager,
  MyScreenContextAction,
  PaymentCalendar,
  myFamilyFilterOptions,
  myFamilyRoleFilterOptions,
  myProductScopeOrder,
  type MyFamilyFilter,
  type MyFamilyRoleFilter,
  type MyProductScope
} from "../components/families";
import { SystemSymbol } from "../components/SystemSymbol";
import { EmptyState, Panel, ProductScopeSwitch } from "../components/layout";
import { FamilyListSkeleton } from "../components/skeleton";
import { useMyAccountListings, useMyMarketplaceListings } from "../hooks/useApi";
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

export {
  myProductScopeOrder,
  type MyProductScope,
  type MyFamilyRoleFilter,
  myFamilyRoleFilterOptions,
  type MyFamilyFilter,
  myFamilyFilterOptions
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
      return serviceName.includes(term) || planName.includes(term) || desc.includes(term);
    });
  }, [families, searchTerm]);

  const filteredFamilies = searchedFamilies.filter(
    (item) =>
      (familyRoleFilter === "all" || item.membership.role === familyRoleFilter) &&
      (familyFilter === "all" || item.family.family_type === familyFilter)
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
              <AppButton type="button" variant="primary" size="sm" onClick={onOpenMarket}>
                Перейти в Маркет
              </AppButton>
            ) : null}
          </EmptyState>
        ) : (
          <>
            <div className="sm-market-family-list">
              {filteredFamilies.map((item) => (
                <MyFamilyWorkspaceCard
                  key={item.membership.id}
                  item={item}
                  details={ownerDetails[item.family.id]}
                  requisite={requisites[item.membership.id]}
                  isExpanded={expandedFamilyId === item.family.id}
                  busy={busy}
                  onToggleExpand={() =>
                    setExpandedFamilyId((curr) => (curr === item.family.id ? null : item.family.id))
                  }
                  onOpenFamily={onOpenFamily}
                  onLoadOwnerDetails={onLoadOwnerDetails}
                  onUpdateDescription={onUpdateDescription}
                  onUpdatePrice={onUpdatePrice}
                  onUpdatePaymentDay={onUpdatePaymentDay}
                  onCloseFamily={onCloseFamily}
                  onConfirmAvailability={onConfirmAvailability}
                  onConfirmAccess={onConfirmAccess}
                  onGetRequisite={onGetRequisite}
                  onAcknowledgeClosing={onAcknowledgeClosing}
                  onLeaveFamily={onLeaveFamily}
                  onCreatePrepayment={onCreatePrepayment}
                  onReportPayment={onReportPayment}
                  onCancelPaymentReport={onCancelPaymentReport}
                  onApproveRequest={onApproveRequest}
                  onRejectRequest={onRejectRequest}
                  onAccessProvided={onAccessProvided}
                  onRemindAccess={onRemindAccess}
                  onCancelBeforeAccess={onCancelBeforeAccess}
                  onRemoveMember={onRemoveMember}
                  onConfirmPayment={onConfirmPayment}
                  onNotReceived={onNotReceived}
                  onRecordPrepayment={onRecordPrepayment}
                />
              ))}
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
          <AppButton type="button" size="sm" onClick={onRetry}>
            Повторить
          </AppButton>
        </div>
      )}

      {isLoading && families.length === 0 ? <FamilyListSkeleton count={3} /> : null}

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
                  <FamilyRoleChip value={familyRoleFilter} onChange={setFamilyRoleFilter} />
                  <MyFamilyFilterChip value={familyFilter} onChange={setFamilyFilter} />
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
