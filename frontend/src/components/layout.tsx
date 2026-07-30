import type { ReactNode } from "react";

import {
  Button as WorldButton,
  Select,
  Tabs,
  TabItem,
  TopBar,
  Typography
} from "@worldcoin/mini-apps-ui-kit-react";
import Add01Icon from "@hugeicons/core-free-icons/Add01Icon";
import Home01Icon from "@hugeicons/core-free-icons/Home01Icon";
import Task01Icon from "@hugeicons/core-free-icons/Task01Icon";
import UserMultipleIcon from "@hugeicons/core-free-icons/UserMultipleIcon";
import { HugeiconsIcon } from "@hugeicons/react";
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
  return <span className="legacy-badge">{children}</span>;
}

export function Shell({
  children,
  title,
  appearance = "default"
}: {
  children: ReactNode;
  title: string;
  appearance?: "default" | "market";
}) {
  return (
    <main
      className={
        appearance === "market"
          ? "market-shell"
          : "app-shell"
      }
      aria-label={title}
    >
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

export function ProductScopeSwitch({
  value = "families",
  onChange
}: {
  value?: "families" | "accounts" | "gigabytes";
  onChange?: (value: "families" | "accounts" | "gigabytes") => void;
}) {
  return (
    <div className="product-scope-switch" aria-label="Разделы SubsMarket">
      <WorldButton
        type="button"
        size="sm"
        variant={value === "families" ? "primary" : "tertiary"}
        onClick={() => onChange?.("families")}
      >
        Семьи
      </WorldButton>
      <WorldButton
        type="button"
        size="sm"
        variant={value === "accounts" ? "primary" : "tertiary"}
        onClick={() => onChange?.("accounts")}
      >
        Аккаунты
      </WorldButton>
      <WorldButton
        type="button"
        size="sm"
        variant={value === "gigabytes" ? "primary" : "tertiary"}
        onClick={() => onChange?.("gigabytes")}
      >
        ГБ
      </WorldButton>
    </div>
  );
}

export function BottomNav({
  active,
  appearance = "default",
  onChange,
  onReselect,
  badges
}: {
  active: Tab;
  appearance?: "default" | "market";
  onChange: (tab: Tab) => void;
  onReselect?: (tab: Tab) => void;
  badges?: Partial<Record<Tab, number>>;
}) {
  if (appearance === "market") {
    return (
      <nav
        className="subs-dock"
        aria-label="Главная навигация"
      >
        <div className="subs-dock-surface">
          <MarketNavItem
            value="home"
            icon="home"
            label="Маркет"
            active={active === "home" || active === "search"}
            onChange={onChange}
            onReselect={onReselect}
          />
          <MarketNavItem
            value="mine"
            icon="mine"
            label="Мои"
            badge={badges?.mine}
            active={active === "mine"}
            onChange={onChange}
            onReselect={onReselect}
          />
          <MarketNavItem
            value="create"
            icon="create"
            label="Создать"
            active={active === "create"}
            onChange={onChange}
            onReselect={onReselect}
          />
          <MarketNavItem
            value="requests"
            icon="requests"
            label="Действия"
            badge={badges?.requests}
            active={active === "requests"}
            onChange={onChange}
            onReselect={onReselect}
          />
        </div>
      </nav>
    );
  }

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

function MarketNavItem({
  value,
  icon,
  label,
  badge,
  active,
  onChange,
  onReselect
}: {
  value: Tab;
  icon: "home" | "create" | "mine" | "requests";
  label: string;
  badge?: number;
  active: boolean;
  onChange: (tab: Tab) => void;
  onReselect?: (tab: Tab) => void;
}) {
  return (
    <button
      type="button"
      className="subs-dock-item"
      data-testid="nav-item"
      data-kind={value === "create" ? "create" : "tab"}
      data-active={active ? "true" : "false"}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      onClick={() => {
        triggerTelegramSelection();
        if (active) {
          onReselect?.(value);
          return;
        }
        onChange(value);
      }}
    >
      <span className="subs-dock-icon">
        <MarketNavIcon icon={icon} active={active} />
        {badge !== undefined && badge > 0 ? (
          <span className="subs-dock-badge">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </span>
      <span className="subs-dock-label">{label}</span>
    </button>
  );
}

function MarketNavIcon({
  icon,
  active
}: {
  icon: "home" | "create" | "mine" | "requests";
  active: boolean;
}) {
  const strokeWidth = active ? 2.2 : 1.7;

  if (icon === "home") {
    return <HugeiconsIcon aria-hidden icon={Home01Icon} size={22} strokeWidth={strokeWidth} />;
  }

  if (icon === "create") {
    return <HugeiconsIcon aria-hidden icon={Add01Icon} size={22} strokeWidth={2.3} />;
  }

  if (icon === "requests") {
    return <HugeiconsIcon aria-hidden icon={Task01Icon} size={22} strokeWidth={strokeWidth} />;
  }

  return <HugeiconsIcon aria-hidden icon={UserMultipleIcon} size={22} strokeWidth={strokeWidth} />;
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

function NavIcon({
  icon,
  plain = false
}: {
  icon: "home" | "create" | "mine" | "requests";
  plain?: boolean;
}) {
  const common = {
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    className: plain ? undefined : "nav-icon"
  } as const;

  if (icon === "home") {
    return <Home {...common} size={22} strokeWidth={1.8} />;
  }

  if (icon === "create") {
    return <Plus {...common} size={23} strokeWidth={1.8} />;
  }

  if (icon === "requests") {
    return <ClipboardList {...common} size={22} strokeWidth={1.8} />;
  }

  return <UsersRound {...common} size={22} strokeWidth={1.8} />;
}
