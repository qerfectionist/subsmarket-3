import type { ReactNode } from "react";

import {
  Button as WorldButton,
  ListItem,
  Select,
  Tabs,
  TabItem,
  TopBar,
  Typography
} from "@worldcoin/mini-apps-ui-kit-react";

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
    <TopBar
      className="app-topbar"
      title="SubsMarket"
      startAdornment={
        <span className="app-user-avatar" aria-hidden>
          {acronym}
          <span className="app-user-status" />
        </span>
      }
      endAdornment={
        <WorldButton type="button" size="icon" variant="tertiary" aria-label="Уведомления">
          <BellIcon />
          <span className="app-icon-dot" aria-hidden />
        </WorldButton>
      }
    />
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
    <div className="dev-user-compact" aria-label="Dev user switch" data-testid="dev-user-switch">
      <Typography as="span" variant="label" level={2}>
        Dev: @{value.username}
      </Typography>
      <div data-testid="dev-user-select" data-value={String(value.id)}>
        <Select
          value={String(value.id)}
          onChange={onChange}
          options={DEV_TELEGRAM_USERS.map((user) => ({
            value: String(user.id),
            label: `${user.label} · @${user.username}`
          }))}
        />
      </div>
    </div>
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
    <section className="app-panel">
      <div className="app-panel-head">
        <div>
          <Typography as="h1" variant="heading" level={4}>
            {title}
          </Typography>
          <Typography as="p" variant="body" level={3}>
            {description}
          </Typography>
        </div>
        {action ? <div className="app-panel-action">{action}</div> : null}
      </div>
      <div className="app-panel-body">{children}</div>
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-state">
      <Typography as="strong" variant="subtitle" level={2}>
        {title}
      </Typography>
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
    <div className="family-type-switch">
      {(["subscription", "tariff"] as FamilyType[]).map((type) => (
        <WorldButton
          key={type}
          type="button"
          data-testid={`family-type-${type}`}
          variant={value === type ? "primary" : "tertiary"}
          size="sm"
          fullWidth
          onClick={() => onChange(type)}
        >
          {familyTypeLabels[type]}
        </WorldButton>
      ))}
    </div>
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
  const activeValue = active === "family" ? "mine" : active;

  return (
    <nav className="bottom-nav" aria-label="Главная навигация">
      <Tabs
        value={activeValue}
        onValueChange={(value) => {
          if (value) onChange(value as Tab);
        }}
      >
      <NavItem value="home" icon="home" label="Главная" />
      <NavItem value="search" icon="search" label="Поиск" />
      <NavItem
        value="mine"
        icon="families"
        label="Семьи"
        badge={badges?.mine}
      />
      <NavItem
        value="requests"
        icon="requests"
        label="Заявки"
        badge={badges?.requests}
      />
      </Tabs>
    </nav>
  );
}

function NavItem({
  value,
  icon,
  label,
  badge
}: {
  value: Tab;
  icon: "home" | "search" | "families" | "requests";
  label: string;
  badge?: number;
}) {
  function handlePointerDown() {
    triggerTelegramSelection();
  }

  return (
    <TabItem
      value={value}
      data-testid="nav-item"
      className="nav-item"
      icon={
        <span className="nav-icon-wrap">
          <NavIcon icon={icon} />
          {badge !== undefined && badge > 0 && (
            <span className="nav-badge">{badge > 9 ? "9+" : badge}</span>
          )}
        </span>
      }
      label={label}
      onPointerDown={handlePointerDown}
    />
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="topbar-icon">
      <path d="M18 10.3c0-3.4-2.2-6.1-6-6.1s-6 2.7-6 6.1v2.9l-1.5 2.4c-.4.7.1 1.6.9 1.6h13.2c.8 0 1.3-.9.9-1.6L18 13.2v-2.9Z" />
      <path d="M9.7 19.1c.4.8 1.2 1.3 2.3 1.3s1.9-.5 2.3-1.3" />
    </svg>
  );
}

function NavIcon({ icon }: { icon: "home" | "search" | "families" | "requests" }) {
  const common = {
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    className: "nav-icon"
  } as const;

  if (icon === "home") {
    return (
      <svg {...common}>
        <path d="M4 11.4 12 4l8 7.4" />
        <path d="M6.5 10.2v8.2h11v-8.2" />
        <path d="M9.5 18.4v-5h5v5" />
      </svg>
    );
  }

  if (icon === "search") {
    return (
      <svg {...common}>
        <circle cx="10.8" cy="10.8" r="5.9" />
        <path d="m15.2 15.2 4.2 4.2" />
      </svg>
    );
  }

  if (icon === "families") {
    return (
      <svg {...common}>
        <circle cx="9" cy="8.7" r="3" />
        <circle cx="16.5" cy="9.5" r="2.4" />
        <path d="M3.8 19c.7-3.2 2.4-5 5.2-5s4.5 1.8 5.2 5" />
        <path d="M13.9 15c2.4.1 3.9 1.5 4.5 4" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M7 4.8h8.2l2.8 2.8v11.6H7z" />
      <path d="M15 5v3h3" />
      <path d="M9.8 12h5.2" />
      <path d="M9.8 15h3.5" />
    </svg>
  );
}
