import { Button as AppButton } from "../ui";
import { ActionsArchiveCalendar, type ActionsArchiveItem } from "../families";
import { ActionsScopePager, type ActionsTab } from "./ActionsScopePager";
import { ActionsArchiveCard } from "./ActionsArchiveCard";
import { EmptyState } from "../layout";
import { SystemSymbol } from "../SystemSymbol";
import { triggerTelegramImpact } from "../../telegram";
import { useFeedSnap } from "../../hooks/useFeedSnap";
import {
  type ActionsArchiveFilter,
  actionsArchiveFilterOptions,
  ActionsArchiveFilterChip,
  getArchiveDateHeader,
  formatArchiveCardDate
} from "./actionsFilterTypes";

export interface ActionsArchiveDrawerProps {
  isArchiveOpen: boolean;
  archiveFilter: ActionsArchiveFilter;
  setArchiveFilter: (filter: ActionsArchiveFilter) => void;
  actionsTab: ActionsTab;
  setActionsTab: (tab: ActionsTab) => void;
  onUserSelectTab: () => void;
  onDragPositionChange: (pos: number, isDragging: boolean) => void;
  displayArchiveItems: ActionsArchiveItem[];
  inboxArchiveItems: ActionsArchiveItem[];
  outboxArchiveItems: ActionsArchiveItem[];
  selectedArchiveDayISO: string | null;
  setSelectedArchiveDayISO: (day: string | null) => void;
  reapplyingId: string | null;
  onReapply: (item: ActionsArchiveItem) => Promise<void>;
}

export function ActionsArchiveDrawer({
  isArchiveOpen,
  archiveFilter,
  setArchiveFilter,
  actionsTab,
  setActionsTab,
  onUserSelectTab,
  onDragPositionChange,
  displayArchiveItems,
  inboxArchiveItems,
  outboxArchiveItems,
  selectedArchiveDayISO,
  setSelectedArchiveDayISO,
  reapplyingId,
  onReapply
}: ActionsArchiveDrawerProps) {
  const getFilteredArchiveItems = (scope: ActionsTab) => {
    const raw = scope === "inbox" ? inboxArchiveItems : outboxArchiveItems;
    return raw.filter((item) => {
      if (archiveFilter !== "all" && item.status !== archiveFilter) return false;
      if (selectedArchiveDayISO && !(item.rawDate || "").startsWith(selectedArchiveDayISO)) return false;
      return true;
    });
  };

  const inboxFilteredItems = getFilteredArchiveItems("inbox");
  const outboxFilteredItems = getFilteredArchiveItems("outbox");

  const inboxArchiveFeedSnap = useFeedSnap({
    enabled: isArchiveOpen && actionsTab === "inbox",
    itemCount: inboxFilteredItems.length,
    tailCardTarget: "first",
    enableScrollSnap: false
  });

  const outboxArchiveFeedSnap = useFeedSnap({
    enabled: isArchiveOpen && actionsTab === "outbox",
    itemCount: outboxFilteredItems.length,
    tailCardTarget: "first",
    enableScrollSnap: false
  });

  const activeFilteredArchiveItems = getFilteredArchiveItems(actionsTab);

  const renderArchiveCard = (item: ActionsArchiveItem, scope: ActionsTab) => (
    <ActionsArchiveCard
      key={item.id}
      item={item}
      scope={scope}
      reapplyingId={reapplyingId}
      onReapply={onReapply}
      formatArchiveCardDate={formatArchiveCardDate}
    />
  );

  const renderArchivePane = (scope: ActionsTab) => {
    const raw = scope === "inbox" ? inboxArchiveItems : outboxArchiveItems;
    const items = scope === "inbox" ? inboxFilteredItems : outboxFilteredItems;
    const snap = scope === "inbox" ? inboxArchiveFeedSnap : outboxArchiveFeedSnap;
    const groups: { dateHeader: string; items: ActionsArchiveItem[] }[] = [];
    const map = new Map<string, ActionsArchiveItem[]>();
    for (const item of items) {
      const header = getArchiveDateHeader(item.rawDate);
      let list = map.get(header);
      if (!list) {
        list = [];
        map.set(header, list);
        groups.push({ dateHeader: header, items: list });
      }
      list.push(item);
    }

    return (
      <div
        className="actions-archive-feed-scroll"
        data-testid="actions-archive-feed-scroll"
        ref={snap.containerRef}
        {...snap.scrollHandlers}
      >
        {items.length === 0 ? (
          <EmptyState
            className="my-account-orders-empty-state"
            icon={<SystemSymbol name="archive" size={32} />}
            title={
              selectedArchiveDayISO
                ? "Нет заявок за выбранный день"
                : archiveFilter === "all"
                  ? "В архиве пока нет заявок"
                  : `Нет заявок со статусом «${actionsArchiveFilterOptions.find((o) => o.value === archiveFilter)?.label.toLowerCase()}»`
            }
          >
            {selectedArchiveDayISO ? (
              <>
                <span className="actions-empty-state-text">
                  Выберите другой день
                  <br />
                  или сбросьте выбор даты
                </span>
                <AppButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    triggerTelegramImpact("light");
                    setSelectedArchiveDayISO(null);
                  }}
                >
                  Показать все дни
                </AppButton>
              </>
            ) : archiveFilter !== "all" && raw.length > 0 ? (
              <>
                <span className="actions-empty-state-text">
                  В архиве есть другие заявки ({raw.length})
                  <br />
                  сбросьте фильтр статуса
                </span>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                  {raw.some((i) => i.status === "cancelled") && archiveFilter !== "cancelled" ? (
                    <AppButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        triggerTelegramImpact("light");
                        setArchiveFilter("cancelled");
                      }}
                    >
                      Показать отклонённые
                    </AppButton>
                  ) : null}
                  <AppButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      triggerTelegramImpact("light");
                      setArchiveFilter("all");
                    }}
                  >
                    Показать все ({raw.length})
                  </AppButton>
                </div>
              </>
            ) : scope === "inbox" ? (
              <span className="actions-empty-state-text">
                Завершённые сделки и&nbsp;запросы
                <br />
                появятся здесь
              </span>
            ) : (
              <span className="actions-empty-state-text">
                Завершённые и&nbsp;отменённые заявки
                <br />
                появятся здесь
              </span>
            )}
          </EmptyState>
        ) : (
          <div className="actions-archive-list-wrap" data-testid="actions-archive-list">
            {groups.map((group) => (
              <div className="actions-archive-date-group" key={group.dateHeader}>
                <div className="actions-archive-date-header">{group.dateHeader}</div>
                <div className="my-trade-request-list actions-archive-card-list">
                  {group.items.map((item) => renderArchiveCard(item, scope))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      id="actions-archive-disclosure"
      className={`actions-archive-disclosure${isArchiveOpen ? " is-open" : ""}`}
      aria-hidden={!isArchiveOpen}
      inert={!isArchiveOpen}
    >
      <div className="actions-archive-disclosure-content">
        <section className="my-history-section actions-archive-section" data-testid="actions-archive-section">
          <div className="my-family-filter-row my-generic-section-heading">
            <div className="my-family-section-heading">
              <h2 className="my-family-section-title">Архив заявок</h2>
              <span className="my-family-section-count">{activeFilteredArchiveItems.length}</span>
            </div>
            <ActionsArchiveFilterChip value={archiveFilter} onChange={setArchiveFilter} />
          </div>

          <div className="actions-archive-content">
            <ActionsArchiveCalendar
              items={displayArchiveItems}
              selectedDateKey={selectedArchiveDayISO}
              onSelectDate={setSelectedArchiveDayISO}
              mode={actionsTab}
            />

            <ActionsScopePager
              value={actionsTab}
              onChange={(nextTab) => {
                onUserSelectTab();
                setActionsTab(nextTab);
              }}
              onDragPositionChange={onDragPositionChange}
              ariaLabel="Архив заявок"
              testId="actions-archive-scope-swipe-viewport"
              renderPane={(scope) => renderArchivePane(scope)}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
