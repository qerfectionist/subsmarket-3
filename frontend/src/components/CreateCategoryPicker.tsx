import type { ReactNode } from "react";
import { SystemSymbol } from "./SystemSymbol";

export type CreateCategory = "subscription" | "tariff" | "accounts" | "gigabytes";

export const CREATE_TITLES: Record<CreateCategory, string> = {
  subscription: "Семейная подписка",
  tariff: "Семейный тариф",
  accounts: "Продать аккаунт",
  gigabytes: "Продать гигабайты"
};

/**
 * A form opened from «Создать»: its own title and a way back to the menu. With a
 * `kicker`, the back button shares its row with that small label (what is being
 * created) and the title below asks the step's question.
 */
export function CreateShell({
  title,
  kicker,
  onBack,
  testId,
  children
}: {
  title: string;
  kicker?: string;
  onBack: () => void;
  testId?: string;
  children: ReactNode;
}) {
  if (kicker) {
    return (
      <div className="create-screen create-form-screen" data-testid={testId}>
        <header className="create-form-header create-form-header-question">
          <div className="create-form-header-row">
            <button
              type="button"
              className="gb-back"
              aria-label="Назад"
              data-testid="create-form-back"
              onClick={onBack}
            >
              <SystemSymbol name="chevron.backward" size={20} />
            </button>
            <span className="create-form-kicker" data-testid="create-form-kicker">
              {kicker}
            </span>
          </div>
          <h1 aria-live="polite">{title}</h1>
        </header>
        {children}
      </div>
    );
  }
  return (
    <div className="create-screen create-form-screen" data-testid={testId}>
      <header className="gb-header create-form-header">
        <button
          type="button"
          className="gb-back"
          aria-label="Назад"
          data-testid="create-form-back"
          onClick={onBack}
        >
          <SystemSymbol name="chevron.backward" size={20} />
        </button>
        <div className="gb-header-title-wrap">
          <h1>{title}</h1>
        </div>
      </header>
      {children}
    </div>
  );
}
