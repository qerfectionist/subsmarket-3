import { Button as AppButton } from "../ui";
import { EmptyState } from "../layout";
import { SystemSymbol } from "../SystemSymbol";
import { FamilyListSkeleton } from "../skeleton";
import { MyRequestsSection } from "../families";
import {
  AccountTradeRequestCard,
  GigabytesTradeRequestCard,
  FamilyCandidateRequestCard
} from "../TradeRequestCard";
import {
  ActionsFamilyWorkspaceList,
  type ActionsFamilyWorkspaceListProps
} from "./ActionsFamilyWorkspaceList";
import type { ActionsTab } from "./ActionsScopePager";
import type { useFeedSnap } from "../../hooks/useFeedSnap";
import type {
  Family,
  OwnerFamilyRequest,
  MarketplaceListingRequest,
  AccountRequest,
  FamilyRequest,
  MyFamily
} from "../../types";
import { triggerTelegramImpact } from "../../telegram";

export interface ActionsFeedPanesProps {
  scope: ActionsTab;
  tradeBusyId: string | null;
  cancellingIds: Set<string>;
  timerPrototype: 1 | 2 | 3 | 4;
  onOpenArchive: () => void;

  // Inbox props
  inboxFeedSnap: ReturnType<typeof useFeedSnap>;
  inboxTotalCount: number;
  visibleInboxCount: number;
  inboxArchiveCount: number;
  filteredSellerGbRequests: MarketplaceListingRequest[];
  filteredSellerAccountRequests: AccountRequest[];
  filteredOwnerCandidateRequests: Array<{ family: Family; request: OwnerFamilyRequest }>;
  visibleCandidateCount: number;
  onAcceptGbRequest: (id: string) => void;
  onRejectGbRequest: (id: string) => void;
  onCloseGbRequest: (id: string, outcome: "sold" | "not_sold") => void;
  onAcceptAccountRequest: (id: string) => void;
  onRejectAccountRequest: (id: string) => void;
  onCloseAccountRequest: (id: string, outcome: "sold" | "not_sold") => void;
  onApproveCandidateRequest: (familyId: string, req: OwnerFamilyRequest) => void;
  onRejectCandidateRequest: (familyId: string, req: OwnerFamilyRequest) => void;

  // Outbox props
  outboxFeedSnap: ReturnType<typeof useFeedSnap>;
  outboxTotalCount: number;
  visibleOutboxCount: number;
  outboxArchiveCount: number;
  filteredBuyerGbRequests: MarketplaceListingRequest[];
  filteredBuyerAccountRequests: AccountRequest[];
  filteredFamilyRequests: FamilyRequest[];
  busy: string | null;
  requestsLoading?: boolean;
  hasMoreRequests?: boolean;
  isLoadingMoreRequests?: boolean;
  onLoadMoreRequests?: () => void;
  onCancelGbRequest: (id: string) => void;
  onRemindGbRequest: (id: string) => void;
  onCancelAccountRequest: (id: string) => void;
  onRemindAccountRequest: (id: string) => void;
  onCancelFamilyRequest: (id: string) => void;

  // Family action workspaces
  filteredMemberActionFamilies: MyFamily[];
  familyWorkspaceListProps: Omit<ActionsFamilyWorkspaceListProps, "items">;
}

export function ActionsFeedPane({
  scope,
  tradeBusyId,
  cancellingIds,
  timerPrototype,
  onOpenArchive,
  inboxFeedSnap,
  inboxTotalCount,
  visibleInboxCount,
  inboxArchiveCount,
  filteredSellerGbRequests,
  filteredSellerAccountRequests,
  filteredOwnerCandidateRequests,
  visibleCandidateCount,
  onAcceptGbRequest,
  onRejectGbRequest,
  onCloseGbRequest,
  onAcceptAccountRequest,
  onRejectAccountRequest,
  onCloseAccountRequest,
  onApproveCandidateRequest,
  onRejectCandidateRequest,
  outboxFeedSnap,
  outboxTotalCount,
  visibleOutboxCount,
  outboxArchiveCount,
  filteredBuyerGbRequests,
  filteredBuyerAccountRequests,
  filteredFamilyRequests,
  busy,
  requestsLoading,
  hasMoreRequests,
  isLoadingMoreRequests,
  onLoadMoreRequests,
  onCancelGbRequest,
  onRemindGbRequest,
  onCancelAccountRequest,
  onRemindAccountRequest,
  onCancelFamilyRequest,
  filteredMemberActionFamilies,
  familyWorkspaceListProps
}: ActionsFeedPanesProps) {
  if (scope === "inbox") {
    return (
      <div
        className="actions-tab-content my-feed-scroll"
        ref={inboxFeedSnap.containerRef}
        {...inboxFeedSnap.scrollHandlers}
        data-testid="actions-inbox-pane"
      >
        {inboxTotalCount === 0 ? (
          <EmptyState
            icon={<SystemSymbol name="checklist" size={32} />}
            title="Нет входящих действий"
          >
            {inboxArchiveCount > 0 ? (
              <>
                <p>Все завершённые сделки и отклонённые запросы находятся в архиве.</p>
                <AppButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    triggerTelegramImpact("light");
                    onOpenArchive();
                  }}
                  style={{ marginTop: 12 }}
                >
                  Открыть архив ({inboxArchiveCount})
                </AppButton>
              </>
            ) : (
              "Когда покупатель запросит гигабайты или аккаунт, либо кандидат подаст заявку в семью, они появятся здесь."
            )}
          </EmptyState>
        ) : visibleInboxCount === 0 ? (
          <EmptyState
            icon={<SystemSymbol name="checklist" size={32} />}
            title="Ничего не найдено"
          >
            Нет входящих действий, соответствующих выбранным фильтрам.
          </EmptyState>
        ) : (
          <div className="sm-market-family-list">
            {filteredSellerGbRequests.length > 0 && (
              <section className="actions-feed-group" data-testid="marketplace-actions-card">
                {filteredSellerGbRequests.map((item) => (
                  <GigabytesTradeRequestCard
                    key={item.id}
                    request={item}
                    busy={tradeBusyId === item.id}
                    isArchiving={cancellingIds.has(item.id)}
                    timerPrototype={timerPrototype}
                    onAccept={(id) => void onAcceptGbRequest(id)}
                    onReject={(id) => void onRejectGbRequest(id)}
                    onClose={(id, outcome) => void onCloseGbRequest(id, outcome)}
                  />
                ))}
              </section>
            )}

            {filteredSellerAccountRequests.length > 0 && (
              <section className="actions-feed-group" data-testid="account-sales-actions-card">
                {filteredSellerAccountRequests.map((item) => (
                  <AccountTradeRequestCard
                    key={item.id}
                    request={item}
                    busy={tradeBusyId === item.id}
                    isArchiving={cancellingIds.has(item.id)}
                    timerPrototype={timerPrototype}
                    onAccept={(id) => void onAcceptAccountRequest(id)}
                    onReject={(id) => void onRejectAccountRequest(id)}
                    onClose={(id, outcome) => void onCloseAccountRequest(id, outcome)}
                  />
                ))}
              </section>
            )}

            {(filteredOwnerCandidateRequests.length > 0 || (visibleCandidateCount > 0 && filteredOwnerCandidateRequests.length === 0)) && (
              <section className="actions-feed-group" data-testid="family-sales-actions-card">
                {filteredOwnerCandidateRequests.length > 0 ? (
                  filteredOwnerCandidateRequests.map(({ family, request }) => (
                    <FamilyCandidateRequestCard
                      key={request.id}
                      family={family}
                      request={request}
                      busy={tradeBusyId === request.id}
                      isArchiving={cancellingIds.has(request.id)}
                      timerPrototype={timerPrototype}
                      onAccept={onApproveCandidateRequest}
                      onReject={onRejectCandidateRequest}
                    />
                  ))
                ) : (
                  <FamilyListSkeleton count={visibleCandidateCount} />
                )}
              </section>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="actions-tab-content my-feed-scroll"
      ref={outboxFeedSnap.containerRef}
      {...outboxFeedSnap.scrollHandlers}
      data-testid="actions-outbox-pane"
    >
      {outboxTotalCount === 0 ? (
        <EmptyState
          icon={<SystemSymbol name="paperplane" size={32} />}
          title="Нет активных заявок"
        >
          {outboxArchiveCount > 0 ? (
            <>
              <p>Все завершённые и отменённые заявки перемещены в архив.</p>
              <AppButton
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  triggerTelegramImpact("light");
                  onOpenArchive();
                }}
                style={{ marginTop: 12 }}
              >
                Открыть архив ({outboxArchiveCount})
              </AppButton>
            </>
          ) : (
            "Здесь отображаются ваши запросы на покупку гигабайтов, аккаунтов и заявки в семьи."
          )}
        </EmptyState>
      ) : visibleOutboxCount === 0 ? (
        <EmptyState
          icon={<SystemSymbol name="paperplane" size={32} />}
          title="Ничего не найдено"
        >
          Нет исходящих заявок, соответствующих выбранным фильтрам.
        </EmptyState>
      ) : (
        <div className="sm-market-family-list">
          {filteredBuyerGbRequests.length > 0 && (
            <section className="actions-feed-group" data-testid="marketplace-purchase-actions-card">
              {filteredBuyerGbRequests.map((item) => (
                <GigabytesTradeRequestCard
                  key={item.id}
                  request={item}
                  busy={tradeBusyId === item.id}
                  isArchiving={cancellingIds.has(item.id)}
                  timerPrototype={timerPrototype}
                  onCancel={(id) => void onCancelGbRequest(id)}
                  onRemind={(id) => void onRemindGbRequest(id)}
                />
              ))}
            </section>
          )}

          {filteredBuyerAccountRequests.length > 0 && (
            <section className="actions-feed-group" data-testid="account-purchase-actions-card">
              {filteredBuyerAccountRequests.map((item) => (
                <AccountTradeRequestCard
                  key={item.id}
                  request={item}
                  busy={tradeBusyId === item.id}
                  isArchiving={cancellingIds.has(item.id)}
                  timerPrototype={timerPrototype}
                  onCancel={(id) => void onCancelAccountRequest(id)}
                  onRemind={(id) => void onRemindAccountRequest(id)}
                />
              ))}
            </section>
          )}

          {filteredFamilyRequests.length > 0 && (
            <>
              <MyRequestsSection
                requests={filteredFamilyRequests}
                busy={busy}
                isLoading={requestsLoading}
                cancellingIds={cancellingIds}
                onCancelRequest={onCancelFamilyRequest}
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
          )}

          {filteredMemberActionFamilies.length > 0 && (
            <section className="actions-feed-group">
              <ActionsFamilyWorkspaceList
                items={filteredMemberActionFamilies}
                {...familyWorkspaceListProps}
              />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
