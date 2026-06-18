import type { ReactNode } from "react";

import { DEV_TELEGRAM_USERS, type DevTelegramUser } from "../api";
import type { Tab } from "../appTypes";
import { familyTypeLabels } from "../labels";
import { triggerTelegramSelection } from "../telegram";
import type { FamilyType } from "../types";

export function AppHeader({
  userName,
  firstName
}: {
  userName: string;
  firstName?: string;
}) {
  return (
    <header className="app-header">
      <div>
        <span>SubsMarket</span>
        <h1>Подписки и тарифы</h1>
      </div>
      <div className="avatar-card">
        <strong>@{userName}</strong>
        <small>{firstName}</small>
      </div>
    </header>
  );
}

export function DevUserSwitch({
  value,
  onChange
}: {
  value: DevTelegramUser;
  onChange: (userId: string) => void;
}) {
  return (
    <section
      className="dev-user-switch"
      aria-label="Dev user switch"
      data-testid="dev-user-switch"
    >
      <div>
        <strong>Dev mode</strong>
        <span>Текущий пользователь: @{value.username}</span>
      </div>
      <select
        data-testid="dev-user-select"
        value={String(value.id)}
        onChange={(event) => onChange(event.target.value)}
      >
        {DEV_TELEGRAM_USERS.map((user) => (
          <option key={user.id} value={user.id}>
            {user.label} · @{user.username}
          </option>
        ))}
      </select>
    </section>
  );
}

export function Panel({
  title,
  description,
  action,
  children
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}

export function Shell({ children, title }: { children: ReactNode; title: string }) {
  return (
    <main className="app-shell" aria-label={title}>
      {children}
    </main>
  );
}

export function FamilyTypeSwitch({
  value,
  onChange
}: {
  value: FamilyType;
  onChange: (value: FamilyType) => void;
}) {
  return (
    <div className="family-type-switch" role="tablist" aria-label="Тип семьи">
      {(["subscription", "tariff"] as FamilyType[]).map((type) => (
        <button
          key={type}
          type="button"
          data-testid={`family-type-${type}`}
          className={value === type ? "type-pill type-pill-active" : "type-pill"}
          onClick={() => onChange(type)}
        >
          {familyTypeLabels[type]}
        </button>
      ))}
    </div>
  );
}

export function BottomNav({
  active,
  onChange
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="Главная навигация">
      <NavItem active={active === "home"} label="Главная" onClick={() => onChange("home")} />
      <NavItem active={active === "search"} label="Поиск" onClick={() => onChange("search")} />
      <NavItem active={active === "create"} label="Создать" onClick={() => onChange("create")} />
      <NavItem
        active={active === "mine" || active === "family"}
        label="Семьи"
        onClick={() => onChange("mine")}
      />
      <NavItem active={active === "requests"} label="Заявки" onClick={() => onChange("requests")} />
    </nav>
  );
}

function NavItem({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  function handleClick() {
    triggerTelegramSelection();
    onClick();
  }

  return (
    <button
      type="button"
      data-testid="nav-item"
      className={active ? "nav-item nav-item-active" : "nav-item"}
      onClick={handleClick}
    >
      <span>{navIcon(label)}</span>
      <small>{label}</small>
    </button>
  );
}

function navIcon(label: string) {
  const icons: Record<string, string> = {
    Главная: "⌂",
    Поиск: "⌕",
    Создать: "+",
    Семьи: "◉",
    Заявки: "↗"
  };
  return icons[label] ?? "•";
}
