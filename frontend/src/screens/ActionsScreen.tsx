import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import { Button as AppButton } from "../components/ui";
import { hasPendingFamilyAction } from "../components/families";
import {
  ActionsScopePager,
  actionsTabOrder,
  type ActionsTab
} from "../components/actions/ActionsScopePager";
import {
  type ActionsCategoryFilter,
  type ActionsStatusFilter,
  type ActionsArchiveFilter,
  actionsCategoryFilterOptions,
  actionsStatusFilterOptions,
  actionsArchiveFilterOptions,
  ActionsCategoryChip,
  ActionsStatusChip,
  ActionsArchiveFilterChip,
  isTradeRequestStatusMatch,
  isFamilyRequestStatusMatch,
  isFamilyActionStatusMatch,
  getOrderNumber,
  formatArchiveAccountTitle,
  getArchiveDateHeader,
  formatArchiveCardDate
} from "../components/actions/actionsFilterTypes";
import { useActionsTradeMutations } from "../components/actions/useActionsTradeMutations";
import { useActionsArchiveItems } from "../components/actions/useActionsArchiveItems";
import { useActionsDevCards } from "../components/actions/useActionsDevCards";
import { ActionsArchiveDrawer } from "../components/actions/ActionsArchiveDrawer";
import { ActionsFeedPane } from "../components/actions/ActionsFeedPanes";
import { SystemSymbol } from "../components/SystemSymbol";
import { Panel } from "../components/layout";
import { FamilyListSkeleton } from "../components/skeleton";
import { useAccountRequests, useMarketplaceRequests } from "../hooks/useApi";
import { triggerTelegramSelection, triggerTelegramImpact } from "../telegram";
import { useFeedSnap } from "../hooks/useFeedSnap";
import type {
  Family,
  FamilyMember,
  FamilyMemberRemovalReason,
  FamilyPayment,
  FamilyRequest,
  MyFamily,
  OwnerFamilyDetails,
  OwnerFamilyRequest,
  PaymentRequisite
} from "../types";

export type ActionsScreenProps = {
  initialActionsTab?: "inbox" | "outbox";
  families: MyFamily[];
  ownerDetails: Record<string, OwnerFamilyDetails>;
  requisites: Record<string, PaymentRequisite>;
  requests: FamilyRequest[];
  busy: string | null;
  isLoading?: boolean;
  requestsLoading?: boolean;
  loadError?: boolean;
  onRetry?: () => void;
  hasMoreRequests?: boolean;
  isLoadingMoreRequests?: boolean;
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
  onApproveRequest: (familyId: string, request: OwnerFamilyRequest) => Promise<unknown>;
  onRejectRequest: (familyId: string, request: OwnerFamilyRequest) => Promise<unknown>;
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
};

export {
  actionsTabOrder,
  type ActionsTab,
  type ActionsCategoryFilter,
  type ActionsStatusFilter,
  type ActionsArchiveFilter,
  actionsCategoryFilterOptions,
  actionsStatusFilterOptions,
  actionsArchiveFilterOptions,
  ActionsCategoryChip,
  ActionsStatusChip,
  ActionsArchiveFilterChip,
  isTradeRequestStatusMatch,
  isFamilyRequestStatusMatch,
  isFamilyActionStatusMatch,
  getOrderNumber,
  formatArchiveAccountTitle,
  getArchiveDateHeader,
  formatArchiveCardDate
};

export function ActionsScreen({
  initialActionsTab,
  families,
  ownerDetails,
  requisites,
  requests,
  busy,
  isLoading,
  requestsLoading,
  loadError,
  onRetry,
  hasMoreRequests,
  isLoadingMoreRequests,
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
  onCancelRequest
}: ActionsScreenProps) {
  const actionFamilies = families.filter(hasPendingFamilyAction);
  const [expandedFamilyId, setExpandedFamilyId] = useState<string | null>(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState<ActionsArchiveFilter>("all");
  const [actionsCategory, setActionsCategory] = useState<ActionsCategoryFilter>("all");
  const [actionsStatus, setActionsStatus] = useState<ActionsStatusFilter>("all");
  const [selectedArchiveDayISO, setSelectedArchiveDayISO] = useState<string | null>(null);

  const sellerGbRequestsQuery = useMarketplaceRequests("seller", true);
  const buyerGbRequestsQuery = useMarketplaceRequests("buyer", true);
  const sellerAccountRequestsQuery = useAccountRequests("seller", true);
  const buyerAccountRequestsQuery = useAccountRequests("buyer", true);

  const sellerGbRequests = sellerGbRequestsQuery.data ?? [];
  const buyerGbRequests = buyerGbRequestsQuery.data ?? [];
  const sellerAccountRequests = sellerAccountRequestsQuery.data ?? [];
  const buyerAccountRequests = buyerAccountRequestsQuery.data ?? [];

  const userSelectedTabRef = useRef<boolean>(false);
  const [actionsTab, setActionsTab] = useState<ActionsTab>(() => initialActionsTab ?? "inbox");

  const dev = useActionsDevCards({
    actionsTab,
    actionsCategory,
    setActionsCategory,
    setActionsStatus
  });

  const allSellerGbRequests = useMemo(() => [...dev.devCards.sellerGb, ...sellerGbRequests], [dev.devCards.sellerGb, sellerGbRequests]);
  const allBuyerGbRequests = useMemo(() => [...dev.devCards.buyerGb, ...buyerGbRequests], [dev.devCards.buyerGb, buyerGbRequests]);
  const allSellerAccountRequests = useMemo(() => [...dev.devCards.sellerAccounts, ...sellerAccountRequests], [dev.devCards.sellerAccounts, sellerAccountRequests]);
  const allBuyerAccountRequests = useMemo(() => [...dev.devCards.buyerAccounts, ...buyerAccountRequests], [dev.devCards.buyerAccounts, buyerAccountRequests]);
  const allBuyerFamilyRequests = useMemo(() => [...dev.devCards.buyerFamilies, ...requests], [dev.devCards.buyerFamilies, requests]);

  const ownerCandidateRequests = useMemo(() => {
    const list: Array<{ family: Family; request: OwnerFamilyRequest }> = [];
    for (const item of families) {
      if (item.membership.role !== "owner") continue;
      const details = ownerDetails[item.family.id];
      if (details?.requests) {
        for (const req of details.requests) {
          if (req.status === "pending") {
            list.push({ family: item.family, request: req });
          }
        }
      }
    }
    return list;
  }, [families, ownerDetails]);

  const combinedOwnerCandidateRequests = useMemo(
    () => [...dev.devCards.candidates, ...ownerCandidateRequests],
    [dev.devCards.candidates, ownerCandidateRequests]
  );

  const ownerRequestCount = families.reduce(
    (total, item) => total + (item.membership.role === "owner" ? item.pending_requests_count : 0),
    0
  );
  const ownerCandidateTotalCount = Math.max(combinedOwnerCandidateRequests.length, ownerRequestCount);
  const memberActionFamilies = useMemo(() => actionFamilies.filter((item) => item.membership.role !== "owner"), [actionFamilies]);

  const inboxTotalCount =
    allSellerGbRequests.filter((r) => ["pending", "accepted"].includes(r.status)).length +
    allSellerAccountRequests.filter((r) => ["pending", "accepted"].includes(r.status)).length +
    ownerCandidateTotalCount;

  const outboxTotalCount =
    allBuyerGbRequests.filter((r) => ["pending", "accepted"].includes(r.status)).length +
    allBuyerAccountRequests.filter((r) => ["pending", "accepted"].includes(r.status)).length +
    allBuyerFamilyRequests.filter((r) => ["pending", "approved"].includes(r.status)).length +
    memberActionFamilies.length;

  const mutations = useActionsTradeMutations({
    devCards: dev.devCards,
    setDevCards: dev.setDevCards,
    onCancelRequest,
    onApproveRequest,
    onRejectRequest,
    setIsArchiveOpen,
    setActionsTab
  });

  const archive = useActionsArchiveItems({
    actionsTab,
    sellerGbRequests,
    sellerAccountRequests,
    families,
    ownerDetails,
    buyerGbRequests,
    buyerAccountRequests,
    requests
  });

  const actionsRoleSwitchRef = useRef<HTMLDivElement | null>(null);
  function handleScopePositionChange(position: number, isDragging: boolean) {
    const switchElement = actionsRoleSwitchRef.current;
    if (!switchElement) return;
    const clampedPosition = Math.min(Math.max(position, 0), actionsTabOrder.length - 1);
    switchElement.style.setProperty("--scope-position", String(clampedPosition));
    if (isDragging) {
      switchElement.dataset.scopeDragging = "true";
    } else {
      delete switchElement.dataset.scopeDragging;
    }
  }

  useLayoutEffect(() => {
    handleScopePositionChange(actionsTabOrder.indexOf(actionsTab), false);
  }, [actionsTab]);

  useEffect(() => {
    if (initialActionsTab) {
      setActionsTab(initialActionsTab);
      setActionsCategory("all");
      setActionsStatus("all");
      userSelectedTabRef.current = true;
    } else {
      userSelectedTabRef.current = false;
    }
  }, [initialActionsTab]);

  useEffect(() => {
    if (!userSelectedTabRef.current && !initialActionsTab) {
      if (inboxTotalCount === 0 && outboxTotalCount > 0) {
        setActionsTab("outbox");
        setActionsCategory("all");
        setActionsStatus("all");
      } else if (inboxTotalCount > 0 && outboxTotalCount === 0) {
        setActionsTab("inbox");
        setActionsCategory("all");
        setActionsStatus("all");
      }
    }
  }, [inboxTotalCount, outboxTotalCount, initialActionsTab]);

  const loadingOwnerDetailsRef = useRef(new Set<string>());
  useEffect(() => {
    if (!onLoadOwnerDetails) return;
    families.forEach((item) => {
      if (
        item.membership.role === "owner" &&
        item.pending_requests_count > 0 &&
        !ownerDetails[item.family.id] &&
        !loadingOwnerDetailsRef.current.has(item.family.id)
      ) {
        loadingOwnerDetailsRef.current.add(item.family.id);
        Promise.resolve(onLoadOwnerDetails(item.family.id)).finally(() => {
          loadingOwnerDetailsRef.current.delete(item.family.id);
        });
      }
    });
  }, [families, ownerDetails, onLoadOwnerDetails]);

  // Filtered feeds
  const filteredSellerGbRequests = allSellerGbRequests.filter(
    (item) => (actionsCategory === "all" || actionsCategory === "gigabytes") &&
      (isTradeRequestStatusMatch(item.status, actionsStatus) || mutations.cancellingIds.has(item.id))
  );
  const filteredSellerAccountRequests = allSellerAccountRequests.filter(
    (item) => (actionsCategory === "all" || actionsCategory === "accounts") &&
      (isTradeRequestStatusMatch(item.status, actionsStatus) || mutations.cancellingIds.has(item.id))
  );
  const filteredOwnerCandidateRequests = useMemo(() => {
    return combinedOwnerCandidateRequests.filter(({ request }) => {
      const isCategoryMatch = actionsCategory === "all" || actionsCategory === "families";
      const isStatusMatch = isFamilyRequestStatusMatch(request.status, actionsStatus) || mutations.cancellingIds.has(request.id);
      return isCategoryMatch && isStatusMatch;
    });
  }, [combinedOwnerCandidateRequests, actionsCategory, actionsStatus, mutations.cancellingIds]);

  const visibleCandidateCount = Math.max(
    filteredOwnerCandidateRequests.filter((r) => !mutations.cancellingIds.has(r.request.id)).length,
    (actionsCategory === "all" || actionsCategory === "families") && isFamilyActionStatusMatch(actionsStatus) ? ownerRequestCount : 0
  );
  const visibleInboxCount =
    filteredSellerGbRequests.filter((r) => !mutations.cancellingIds.has(r.id)).length +
    filteredSellerAccountRequests.filter((r) => !mutations.cancellingIds.has(r.id)).length +
    visibleCandidateCount;

  const filteredBuyerGbRequests = allBuyerGbRequests.filter(
    (item) => (actionsCategory === "all" || actionsCategory === "gigabytes") &&
      (isTradeRequestStatusMatch(item.status, actionsStatus) || mutations.cancellingIds.has(item.id))
  );
  const filteredBuyerAccountRequests = allBuyerAccountRequests.filter(
    (item) => (actionsCategory === "all" || actionsCategory === "accounts") &&
      (isTradeRequestStatusMatch(item.status, actionsStatus) || mutations.cancellingIds.has(item.id))
  );
  const filteredFamilyRequests = allBuyerFamilyRequests.filter(
    (item) => (actionsCategory === "all" || actionsCategory === "families") &&
      (isFamilyRequestStatusMatch(item.status, actionsStatus) || mutations.cancellingIds.has(item.id))
  );
  const filteredMemberActionFamilies =
    (actionsCategory === "all" || actionsCategory === "families") && isFamilyActionStatusMatch(actionsStatus)
      ? memberActionFamilies
      : [];
  const visibleOutboxCount =
    filteredBuyerGbRequests.filter((r) => !mutations.cancellingIds.has(r.id)).length +
    filteredBuyerAccountRequests.filter((r) => !mutations.cancellingIds.has(r.id)).length +
    filteredFamilyRequests.filter((r) => !mutations.cancellingIds.has(r.id)).length +
    filteredMemberActionFamilies.length;

  const inboxFeedSnap = useFeedSnap({ enabled: actionsTab === "inbox", itemCount: visibleInboxCount });
  const outboxFeedSnap = useFeedSnap({ enabled: actionsTab === "outbox", itemCount: visibleOutboxCount });

  return (
    <div className="my-screen actions-screen" data-testid="actions-screen">
      {loadError && onRetry && (
        <div className="panel error-panel" data-testid="actions-load-error">
          <p>Не удалось обновить список действий</p>
          <AppButton type="button" size="sm" onClick={onRetry}>Повторить</AppButton>
        </div>
      )}

      {isLoading && families.length === 0 ? <FamilyListSkeleton count={3} /> : null}

      <Panel
        title="Заявки"
        action={
          <div className="actions-header-actions">
            <button
              type="button"
              className={`my-screen-context-action${isArchiveOpen ? " is-active" : ""}${mutations.isArchivePulsing ? " is-receiving-item" : ""}`}
              aria-expanded={isArchiveOpen}
              aria-controls="actions-archive-disclosure"
              aria-label="Архив заявок"
              title="Архив заявок"
              data-testid="actions-archive-trigger"
              onClick={() => {
                triggerTelegramImpact("light");
                setIsArchiveOpen((prev) => !prev);
              }}
            >
              <SystemSymbol name="archive" size={24} />
            </button>
          </div>
        }
      >
        <div className="actions-screen-filters">

          <div
            ref={actionsRoleSwitchRef}
            className="product-scope-switch"
            role="group"
            aria-label="Разделы заявок"
            style={{ "--scope-position": actionsTab === "outbox" ? 1 : 0 } as CSSProperties}
          >
            <AppButton
              type="button"
              size="sm"
              data-testid="actions-tab-inbox"
              aria-pressed={actionsTab === "inbox"}
              variant={actionsTab === "inbox" ? "primary" : "tertiary"}
              onClick={() => {
                triggerTelegramSelection();
                userSelectedTabRef.current = true;
                setActionsTab("inbox");
                setActionsCategory("all");
                setActionsStatus("all");
                inboxFeedSnap.containerRef.current?.scrollTo({ top: 0, behavior: "auto" });
              }}
            >
              Входящие
            </AppButton>
            <AppButton
              type="button"
              size="sm"
              data-testid="actions-tab-outbox"
              aria-pressed={actionsTab === "outbox"}
              variant={actionsTab === "outbox" ? "primary" : "tertiary"}
              onClick={() => {
                triggerTelegramSelection();
                userSelectedTabRef.current = true;
                setActionsTab("outbox");
                setActionsCategory("all");
                setActionsStatus("all");
                outboxFeedSnap.containerRef.current?.scrollTo({ top: 0, behavior: "auto" });
              }}
            >
              Исходящие
            </AppButton>
          </div>
        </div>

        <ActionsArchiveDrawer
          isArchiveOpen={isArchiveOpen}
          archiveFilter={archiveFilter}
          setArchiveFilter={setArchiveFilter}
          actionsTab={actionsTab}
          setActionsTab={setActionsTab}
          onUserSelectTab={() => { userSelectedTabRef.current = true; }}
          onDragPositionChange={handleScopePositionChange}
          displayArchiveItems={archive.displayArchiveItems}
          inboxArchiveItems={archive.inboxArchiveItems}
          outboxArchiveItems={archive.outboxArchiveItems}
          selectedArchiveDayISO={selectedArchiveDayISO}
          setSelectedArchiveDayISO={setSelectedArchiveDayISO}
          reapplyingId={mutations.reapplyingId}
          onReapply={mutations.handleReapply}
        />

        <div
          className={`actions-active-view${isArchiveOpen ? " is-hidden" : ""}`}
          aria-hidden={isArchiveOpen}
          inert={isArchiveOpen}
        >
          <div className="my-family-filter-row">
            <div className="my-family-section-heading">
              <h2 className="my-family-section-title">
                {actionsCategory === "families"
                  ? (actionsTab === "inbox" ? "Заявки" : "Мои заявки")
                  : (actionsTab === "inbox" ? "Продажи" : "Покупки")}
              </h2>
              <span className="my-family-section-count">
                {actionsTab === "inbox" ? visibleInboxCount : visibleOutboxCount}
              </span>
            </div>
            <ActionsCategoryChip value={actionsCategory} onChange={setActionsCategory} />
            <ActionsStatusChip value={actionsStatus} onChange={setActionsStatus} />
          </div>

          <ActionsScopePager
            value={actionsTab}
            onChange={(nextTab) => {
              userSelectedTabRef.current = true;
              setActionsTab(nextTab);
              setActionsCategory("all");
              setActionsStatus("all");
            }}
            onDragPositionChange={handleScopePositionChange}
            renderPane={(scope) => (
              <ActionsFeedPane
                scope={scope}
                tradeBusyId={mutations.tradeBusyId}
                cancellingIds={mutations.cancellingIds}
                timerPrototype={dev.timerPrototype}
                onOpenArchive={() => {
                  triggerTelegramImpact("light");
                  setIsArchiveOpen(true);
                }}
                inboxFeedSnap={inboxFeedSnap}
                inboxTotalCount={inboxTotalCount}
                visibleInboxCount={visibleInboxCount}
                inboxArchiveCount={archive.inboxArchiveItems.length}
                filteredSellerGbRequests={filteredSellerGbRequests}
                filteredSellerAccountRequests={filteredSellerAccountRequests}
                filteredOwnerCandidateRequests={filteredOwnerCandidateRequests}
                visibleCandidateCount={visibleCandidateCount}
                onAcceptGbRequest={mutations.handleAcceptGbRequest}
                onRejectGbRequest={mutations.handleRejectGbRequest}
                onCloseGbRequest={mutations.handleCloseGbRequest}
                onAcceptAccountRequest={mutations.handleAcceptAccountRequest}
                onRejectAccountRequest={mutations.handleRejectAccountRequest}
                onCloseAccountRequest={mutations.handleCloseAccountRequest}
                onApproveCandidateRequest={mutations.handleApproveCandidateRequest}
                onRejectCandidateRequest={mutations.handleRejectCandidateRequest}
                outboxFeedSnap={outboxFeedSnap}
                outboxTotalCount={outboxTotalCount}
                visibleOutboxCount={visibleOutboxCount}
                outboxArchiveCount={archive.outboxArchiveItems.length}
                filteredBuyerGbRequests={filteredBuyerGbRequests}
                filteredBuyerAccountRequests={filteredBuyerAccountRequests}
                filteredFamilyRequests={filteredFamilyRequests}
                busy={busy}
                requestsLoading={requestsLoading}
                hasMoreRequests={hasMoreRequests}
                isLoadingMoreRequests={isLoadingMoreRequests}
                onLoadMoreRequests={onLoadMoreRequests}
                onCancelGbRequest={mutations.handleCancelGbRequest}
                onRemindGbRequest={mutations.handleRemindGbRequest}
                onCancelAccountRequest={mutations.handleCancelAccountRequest}
                onRemindAccountRequest={mutations.handleRemindAccountRequest}
                onCancelFamilyRequest={mutations.handleCancelFamilyRequest}
                filteredMemberActionFamilies={filteredMemberActionFamilies}
                familyWorkspaceListProps={{
                  ownerDetails,
                  expandedFamilyId,
                  setExpandedFamilyId,
                  onOpenFamily,
                  busy,
                  requisites,
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
                  onRecordPrepayment
                }}
              />
            )}
          />
        </div>
      </Panel>
    </div>
  );
}
