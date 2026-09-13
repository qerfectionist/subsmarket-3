import { SystemSymbol } from "./SystemSymbol";
import { triggerTelegramSelection } from "../telegram";
import type { FamilyType } from "../types";

export interface Ios27CategoryMenuProps {
  onOpenFamilyCatalog: (type: FamilyType) => void;
  onOpenGigabytes: (id?: string) => void;
  onOpenAccounts: (id?: string) => void;
}

interface ItemConfig {
  id: "tariff" | "subscription" | "gigabytes" | "accounts";
  testId: string;
  title: string;
  subtitle: string;
  iconName:
    | "antenna.radiowaves.left.and.right"
    | "person.2"
    | "globe"
    | "key";
  action: () => void;
}

export function Ios27CategoryMenu({
  onOpenFamilyCatalog,
  onOpenGigabytes,
  onOpenAccounts
}: Ios27CategoryMenuProps) {
  const items: ItemConfig[] = [
    {
      id: "tariff",
      testId: "family-type-tariff",
      title: "Тарифы",
      subtitle: "Семейные",
      iconName: "antenna.radiowaves.left.and.right",
      action: () => onOpenFamilyCatalog("tariff")
    },
    {
      id: "subscription",
      testId: "family-type-subscription",
      title: "Подписки",
      subtitle: "Семейные",
      iconName: "person.2",
      action: () => onOpenFamilyCatalog("subscription")
    },
    {
      id: "gigabytes",
      testId: "market-buy-gigabytes",
      title: "Гигабайты",
      subtitle: "Интернет",
      iconName: "globe",
      action: () => onOpenGigabytes()
    },
    {
      id: "accounts",
      testId: "market-buy-accounts",
      title: "Аккаунты",
      subtitle: "Доступы",
      iconName: "key",
      action: () => onOpenAccounts()
    }
  ];

  return (
    <section className="sm-ios27-category-menu" aria-label="Категории">
      <div className="sm-ios27-grid-pods">
        {items.map((item) => (
          <button
            key={item.id}
            className={`sm-ios27-pod sm-ios27-pod-${item.id}`}
            type="button"
            data-testid={item.testId}
            onClick={() => {
              triggerTelegramSelection();
              item.action();
            }}
          >
            <span className="sm-ios27-pod-copy">
              <strong className="sm-ios27-pod-title">
                {item.title}
              </strong>
              <span className="sm-ios27-pod-subtitle">{item.subtitle}</span>
            </span>
            <span className="sm-ios27-pod-icon" aria-hidden="true">
              <SystemSymbol name={item.iconName} size={30} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
