import type { ReactNode } from "react";
import { SystemSymbol } from "./SystemSymbol";

export type CreateCategory = "subscription" | "tariff" | "accounts" | "gigabytes";

export const CREATE_TITLES: Record<CreateCategory, string> = {
  subscription: "Семейная подписка",
  tariff: "Семейный тариф",
  accounts: "Продать аккаунт",
  gigabytes: "Продать гигабайты"
};

/** A form opened from «Создать»: its own title and a way back to the menu. */
export function CreateShell({
  title,
  onBack,
  testId,
  children
}: {
  title: string;
  onBack: () => void;
  testId?: string;
  children: ReactNode;
}) {
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
