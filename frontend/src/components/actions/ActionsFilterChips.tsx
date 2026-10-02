import { SystemSymbol } from "../SystemSymbol";
import { triggerTelegramSelection } from "../../telegram";
import {
  type ActionsCategoryFilter,
  actionsCategoryFilterOptions,
  type ActionsStatusFilter,
  actionsStatusFilterOptions,
  type ActionsArchiveFilter,
  actionsArchiveFilterOptions
} from "./actionsFilterTypes";

export function ActionsCategoryChip({
  value,
  onChange
}: {
  value: ActionsCategoryFilter;
  onChange: (value: ActionsCategoryFilter) => void;
}) {
  const activeOption =
    actionsCategoryFilterOptions.find((option) => option.value === value) ??
    actionsCategoryFilterOptions[0];
  const activeIndex = actionsCategoryFilterOptions.findIndex(
    (option) => option.value === activeOption.value
  );

  return (
    <button
      type="button"
      className={`sm-market-filter-chip${value !== "all" ? " is-active" : ""}`}
      aria-pressed={value !== "all"}
      aria-label={`Категория заявок: ${activeOption.label}. Нажмите для переключения`}
      data-testid="actions-category-filter-chip"
      onClick={() =>
        onChange(
          actionsCategoryFilterOptions[
            (activeIndex + 1) % actionsCategoryFilterOptions.length
          ].value
        )
      }
    >
      <SystemSymbol name={activeOption.icon} size={14} />
      <span data-testid="actions-category-filter-label">{activeOption.label}</span>
    </button>
  );
}

export function ActionsStatusChip({
  value,
  onChange
}: {
  value: ActionsStatusFilter;
  onChange: (value: ActionsStatusFilter) => void;
}) {
  const activeOption =
    actionsStatusFilterOptions.find((option) => option.value === value) ??
    actionsStatusFilterOptions[0];
  const activeIndex = actionsStatusFilterOptions.findIndex(
    (option) => option.value === activeOption.value
  );

  return (
    <div className="my-family-filter-actions">
      <button
        type="button"
        className={`sm-market-filter-chip${value !== "all" ? " is-active" : ""}`}
        aria-pressed={value !== "all"}
        aria-label={`Статус действий: ${activeOption.label}. Нажмите для переключения`}
        data-testid="actions-status-filter-chip"
        onClick={() =>
          onChange(
            actionsStatusFilterOptions[
              (activeIndex + 1) % actionsStatusFilterOptions.length
            ].value
          )
        }
      >
        <SystemSymbol name={activeOption.icon} size={14} />
        <span data-testid="actions-status-filter-label">{activeOption.label}</span>
      </button>
    </div>
  );
}

export function ActionsArchiveFilterChip({
  value,
  onChange
}: {
  value: ActionsArchiveFilter;
  onChange: (value: ActionsArchiveFilter) => void;
}) {
  const activeOption =
    actionsArchiveFilterOptions.find((option) => option.value === value) ??
    actionsArchiveFilterOptions[0];
  const activeIndex = actionsArchiveFilterOptions.findIndex(
    (option) => option.value === activeOption.value
  );

  return (
    <div className="my-family-filter-actions">
      <button
        type="button"
        className={`sm-market-filter-chip${value !== "all" ? " is-active" : ""}`}
        aria-pressed={value !== "all"}
        aria-label={`Статус архива: ${activeOption.label}. Нажмите для переключения`}
        data-testid="actions-archive-filter-chip"
        onClick={() => {
          triggerTelegramSelection();
          onChange(
            actionsArchiveFilterOptions[
              (activeIndex + 1) % actionsArchiveFilterOptions.length
            ].value
          );
        }}
      >
        <SystemSymbol name={activeOption.icon} size={14} />
        <span data-testid="actions-archive-filter-label">{activeOption.label}</span>
      </button>
    </div>
  );
}
