import { Button as AppButton } from "../ui";
import { ActionsArchiveCalendar, type ActionsArchiveItem } from "../families";
import { ActionsScopePager, type ActionsTab } from "./ActionsScopePager";
import { ActionsArchiveCard } from "./ActionsArchiveCard";
import { EmptyState } from "../layout";
import { SystemSymbol } from "../SystemSymbol";
import { triggerTelegramImpact } from "../../telegram";
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
    const items = getFilteredArchiveItems(scope);
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
                <p>Попробуйте выбрать другой день или сбросьте выбор даты.</p>
                <AppButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    triggerTelegramImpact("light");
                    setSelectedArchiveDayISO(null);
                  }}
                  style={{ marginTop: 12 }}
                >
                  Показать все дни
                </AppButton>
              </>
            ) : scope === "inbox" ? (
              "Здесь будут отображаться завершённые и отклонённые входящие запросы."
            ) : (
              "Здесь будут отображаться ваши завершённые и закрытые исходящие заявки."
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
