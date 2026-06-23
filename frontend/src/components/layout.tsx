import type { ReactNode } from "react";

import {
  Avatar,
  Button,
  Cell,
  List,
  Section
} from "@telegram-apps/telegram-ui";

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
  const acronym = (firstName ?? userName).slice(0, 2).toUpperCase();
  return (
    <Section>
      <Cell
        before={<Avatar size={28} acronym={acronym} />}
        title={`@${userName}`}
        subtitle={firstName}
      />
    </Section>
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
    <Section
      header="Dev mode"
      aria-label="Dev user switch"
      data-testid="dev-user-switch"
    >
      <Cell subtitle={`Текущий пользователь: @${value.username}`}>
        <select
          data-testid="dev-user-select"
          value={String(value.id)}
          onChange={(event) => onChange(event.target.value)}
          style={{
            background: "var(--app-surface, #fff)",
            border: "1px solid var(--app-border, #cbd5e1)",
            borderRadius: 12,
            padding: "10px 12px",
            width: "100%"
          }}
        >
          {DEV_TELEGRAM_USERS.map((user) => (
            <option key={user.id} value={user.id}>
              {user.label} · @{user.username}
            </option>
          ))}
        </select>
      </Cell>
    </Section>
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
    <Section
      header={
        <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span>{title}</span>
          {action}
        </span>
      }
      footer={description}
    >
      {children}
    </Section>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <div className="empty-state-body">{children}</div>
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
    <List style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8 }}>
      {(["subscription", "tariff"] as FamilyType[]).map((type) => (
        <Button
          key={type}
          type="button"
          data-testid={`family-type-${type}`}
          mode={value === type ? "filled" : "plain"}
          stretched
          onClick={() => onChange(type)}
        >
          {familyTypeLabels[type]}
        </Button>
      ))}
    </List>
  );
}

export function BottomNav({
  active,
  onChange,
  badges
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
  badges?: Partial<Record<Tab, number>>;
}) {
  return (
    <nav className="bottom-nav" aria-label="Главная навигация">
      <NavItem active={active === "home"} label="Главная" onClick={() => onChange("home")} />
      <NavItem active={active === "search"} label="Поиск" onClick={() => onChange("search")} />
      <NavItem active={active === "create"} label="Создать" onClick={() => onChange("create")} />
      <NavItem
        active={active === "mine" || active === "family"}
        label="Семьи"
        badge={badges?.mine}
        onClick={() => onChange("mine")}
      />
      <NavItem
        active={active === "requests"}
        label="Заявки"
        badge={badges?.requests}
        onClick={() => onChange("requests")}
      />
    </nav>
  );
}

function NavItem({
  active,
  label,
  onClick,
  badge
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  badge?: number;
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
      {badge !== undefined && badge > 0 && (
        <span className="nav-badge">{badge > 9 ? "9+" : badge}</span>
      )}
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
