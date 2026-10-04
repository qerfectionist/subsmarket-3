import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties
} from "react";
import { Button as AppButton } from "../components/ui";
import { useSegmentSwitchSwipe } from "../hooks/useSegmentSwitchSwipe";
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
import { useActionsFeedData } from "../components/actions/useActionsFeedData";
import { ActionsArchiveDrawer } from "../components/actions/ActionsArchiveDrawer";
import { ActionsFeedPane } from "../components/actions/ActionsFeedPanes";
import { SystemSymbol } from "../components/SystemSymbol";
import { Panel } from "../components/layout";
import { FamilyListSkeleton } from "../components/skeleton";
import { triggerTelegramSelection, triggerTelegramImpact } from "../telegram";
import { useFeedSnap } from "../hooks/useFeedSnap";
import type { ActionsScreenProps } from "../components/actions/actionsScreenTypes";
export type { ActionsScreenProps };

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
  const [actionsCategory, setActionsCategory] = useState<ActionsCategoryFilter>("all");
  const [actionsStatus, setActionsStatus] = useState<ActionsStatusFilter>("all");
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState<ActionsArchiveFilter>("all");
  const [selectedArchiveDayISO, setSelectedArchiveDayISO] = useState<string | null>(null);
  const [expandedFamilyId, setExpandedFamilyId] = useState<string | null>(null);

  const feed = useActionsFeedData({
    initialActionsTab,
    families,
    ownerDetails,
    requests,
    onLoadOwnerDetails,
    actionsCategory,
    setActionsCategory,
    actionsStatus,
    setActionsStatus,
    setIsArchiveOpen,
    onCancelRequest,
    onApproveRequest,
    onRejectRequest
  });

  const {
    actionsTab,
    setActionsTab,
    userSelectedTabRef,
    dev,
    mutations,
    archive,
    inboxTotalCount,
    outboxTotalCount,
    visibleInboxCount,
    visibleOutboxCount,
    visibleCandidateCount,
    filteredSellerGbRequests,
    filteredSellerAccountRequests,
    filteredOwnerCandidateRequests,
    filteredBuyerGbRequests,
    filteredBuyerAccountRequests,
    filteredFamilyRequests,
    filteredMemberActionFamilies
  } = feed;

  const inboxFeedSnap = useFeedSnap({ enabled: actionsTab === "inbox", itemCount: visibleInboxCount });
  const outboxFeedSnap = useFeedSnap({ enabled: actionsTab === "outbox", itemCount: visibleOutboxCount });

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

  const handleScopeTabChange = (nextTab: ActionsTab) => {
    triggerTelegramSelection();
    userSelectedTabRef.current = true;
    setActionsTab(nextTab);
    setActionsCategory("all");
    setActionsStatus("all");
    const snap = nextTab === "inbox" ? inboxFeedSnap : outboxFeedSnap;
    snap.containerRef.current?.scrollTo({ top: 0, behavior: "auto" });
  };

  const switchSwipe = useSegmentSwitchSwipe<ActionsTab>({
    items: actionsTabOrder,
    value: actionsTab,
    onChange: handleScopeTabChange,
    onPositionChange: handleScopePositionChange
  });

  useLayoutEffect(() => {
    handleScopePositionChange(actionsTabOrder.indexOf(actionsTab), false);
  }, [actionsTab]);

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
            ref={(node) => {
              actionsRoleSwitchRef.current = node;
              switchSwipe.switchRef.current = node;
            }}
            className="product-scope-switch"
            role="group"
            aria-label="Разделы заявок"
            {...switchSwipe.handlers}
          >
            <AppButton
              type="button"
              size="sm"
              data-testid="actions-tab-inbox"
              aria-pressed={actionsTab === "inbox"}
              variant={actionsTab === "inbox" ? "primary" : "tertiary"}
              onClick={() => handleScopeTabChange("inbox")}
            >
              Входящие
            </AppButton>
            <AppButton
              type="button"
              size="sm"
              data-testid="actions-tab-outbox"
              aria-pressed={actionsTab === "outbox"}
              variant={actionsTab === "outbox" ? "primary" : "tertiary"}
              onClick={() => handleScopeTabChange("outbox")}
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
