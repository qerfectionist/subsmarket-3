import { SystemSymbol } from "./SystemSymbol";
import { triggerTelegramSelection } from "../telegram";

export type CreateCategory = "subscription" | "tariff" | "accounts" | "gigabytes";

const OPTIONS: {
  id: CreateCategory;
  label: string;
  icon: "person.2" | "antenna.radiowaves.left.and.right" | "key" | "globe";
}[] = [
  { id: "subscription", label: "Подписки", icon: "person.2" },
  { id: "tariff", label: "Тарифы", icon: "antenna.radiowaves.left.and.right" },
  { id: "accounts", label: "Аккаунты", icon: "key" },
  { id: "gigabytes", label: "ГБ", icon: "globe" }
];

/**
 * What the person creates, the same four categories as on the market home:
 * a subscription family, an operator tariff family, an account or gigabytes.
 */
export function CreateCategoryPicker({
  value,
  onChange
}: {
  value: CreateCategory;
  onChange: (value: CreateCategory) => void;
}) {
  return (
    <div className="create-category-picker" role="radiogroup" aria-label="Что создаём">
      {OPTIONS.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            data-testid={`create-kind-${option.id}`}
            className={`create-category-option create-category-option-${option.id}`}
            onClick={() => {
              if (selected) return;
              triggerTelegramSelection();
              onChange(option.id);
            }}
          >
            <span className="create-category-option-icon" aria-hidden="true">
              <SystemSymbol name={option.icon} size={22} />
            </span>
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
