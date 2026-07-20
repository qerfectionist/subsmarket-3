import type { ReactNode } from "react";

import {
  Button as WorldButton,
  Select,
  Tabs,
  TabItem,
  TopBar,
  Typography
} from "@worldcoin/mini-apps-ui-kit-react";
import { ClipboardList, Home, Plus, Settings, UsersRound } from "lucide-react";

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
      title=""
      startAdornment={
        <span className="app-user-avatar" aria-hidden>
          {acronym}
          <span className="app-user-status" />
        </span>
      }
      endAdornment={
        <WorldButton
          type="button"
          size="icon"
          variant="tertiary"
          className="app-settings-button"
          aria-label="Настройки"
        >
          <SettingsIcon />
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
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="app-panel">
      {title || description || action ? (
        <div className="app-panel-head">
          <div>
            {title ? (
              <Typography as="h1" variant="heading" level={4}>
                {title}
              </Typography>
            ) : null}
            {description ? (
              <Typography as="p" variant="body" level={3}>
                {description}
              </Typography>
            ) : null}
          </div>
          {action ? <div className="app-panel-action">{action}</div> : null}
        </div>
      ) : null}
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

export function ProductScopeSwitch() {
  return (
    <div className="product-scope-switch" aria-label="Разделы SubsMarket">
      <WorldButton type="button" size="sm" variant="primary">
        Семьи
      </WorldButton>
      <WorldButton type="button" size="sm" variant="tertiary" disabled>
        Аккаунты
      </WorldButton>
      <WorldButton type="button" size="sm" variant="tertiary" disabled>
        ГБ
      </WorldButton>
    </div>
  );
}

export function BottomNav({
  active,
  onChange,
  onReselect,
  badges
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
  onReselect?: (tab: Tab) => void;
  badges?: Partial<Record<Tab, number>>;
}) {
  const activeValue =
    active === "family" || active === "gigabytes" || active === "accounts"
      ? ""
      : active;

  return (
    <nav className="bottom-nav" aria-label="Главная навигация">
      <Tabs
        value={activeValue}
        onValueChange={(value) => {
          if (value) onChange(value as Tab);
        }}
      >
      <NavItem
        value="home"
        icon="home"
        label="Маркет"
        active={active === "home"}
        onReselect={onReselect}
      />
      <NavItem
        value="mine"
        icon="mine"
        label="Мои"
        badge={badges?.mine}
        active={active === "mine"}
        onReselect={onReselect}
      />
      <NavItem
        value="create"
        icon="create"
        label="Создать"
        active={active === "create"}
        onReselect={onReselect}
      />
      <NavItem
        value="requests"
        icon="requests"
        label="Действия"
        badge={badges?.requests}
        active={active === "requests"}
        onReselect={onReselect}
      />
      </Tabs>
    </nav>
  );
}

function NavItem({
  value,
  icon,
  label,
  badge,
  active,
  onReselect
}: {
  value: Tab;
  icon: "home" | "create" | "mine" | "requests";
  label: string;
  badge?: number;
  active?: boolean;
  onReselect?: (tab: Tab) => void;
}) {
  function handlePointerDown() {
    triggerTelegramSelection();
    if (active) {
      onReselect?.(value);
    }
  }

  return (
    <TabItem
      value={value}
      data-testid="nav-item"
      className={`nav-item nav-item-${value}`}
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

function SettingsIcon() {
  return <Settings aria-hidden className="topbar-icon" size={22} strokeWidth={2} />;
}

function NavIcon({ icon }: { icon: "home" | "create" | "mine" | "requests" }) {
  const common = {
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    className: "nav-icon"
  } as const;

  if (icon === "home") {
    return <Home {...common} size={22} strokeWidth={2} />;
  }

  if (icon === "create") {
    return <Plus {...common} size={23} strokeWidth={2.2} />;
  }

  if (icon === "requests") {
    return <ClipboardList {...common} size={22} strokeWidth={2} />;
  }

  return <UsersRound {...common} size={22} strokeWidth={2} />;
}
