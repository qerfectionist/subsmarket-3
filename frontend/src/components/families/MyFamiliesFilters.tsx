import { SystemSymbol, type SystemSymbolName } from "../SystemSymbol";
import { triggerTelegramImpact } from "../../telegram";
import type { MyProductScope } from "./MyProductScopePager";

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

export function FamilyRoleChip({
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

export function MyFamilyFilterChip({
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

export function MyScreenContextAction({
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
