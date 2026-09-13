import { useId, type CSSProperties, type ReactNode } from "react";

import {
  Button as AppButton,
  Select,
  Typography
} from "./ui";
import { SystemSymbol } from "./SystemSymbol";

import { DEV_TELEGRAM_USERS, type DevTelegramUser } from "../api";
import type { Tab } from "../appTypes";
import { familyTypeLabels } from "../labels";
import { triggerTelegramSelection } from "../telegram";
import type { FamilyType } from "../types";

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

export function EmptyState({
  title,
  children,
  icon,
  className
}: {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={["empty-state", className ?? ""].filter(Boolean).join(" ")}>
      {icon ? <div className="empty-state-icon" aria-hidden="true">{icon}</div> : null}
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
  const position = value === "subscription" ? 0 : 1;
  return (
    <div className="family-type-switch" role="group" aria-label="Тип семейного предложения" style={{ "--family-type-position": position } as CSSProperties}>
      {(["subscription", "tariff"] as FamilyType[]).map((type) => (
        <AppButton
          key={type}
          type="button"
          data-testid={`family-type-${type}`}
          aria-pressed={value === type}
          variant={value === type ? "primary" : "tertiary"}
          size="sm"
          fullWidth
          onClick={() => onChange(type)}
        >
          {familyTypeLabels[type]}
        </AppButton>
      ))}
    </div>
  );
}

export function ProductScopeSwitch({
  value = "families",
  onChange,
  familiesLabel = "Семьи",
  dragPosition
}: {
  value?: "families" | "accounts" | "gigabytes";
  onChange?: (value: "families" | "accounts" | "gigabytes") => void;
  familiesLabel?: string;
  dragPosition?: number;
}) {
  const position = dragPosition ?? ["families", "accounts", "gigabytes"].indexOf(value);
  return (
    <div className="product-scope-switch" role="group" aria-label="Разделы" style={{ "--scope-position": position } as CSSProperties}>
      <AppButton
        type="button"
        size="sm"
        aria-pressed={value === "families"}
        variant={value === "families" ? "primary" : "tertiary"}
        onClick={() => onChange?.("families")}
      >
        {familiesLabel}
      </AppButton>
      <AppButton
        type="button"
        size="sm"
        aria-pressed={value === "accounts"}
        variant={value === "accounts" ? "primary" : "tertiary"}
        onClick={() => onChange?.("accounts")}
      >
        Аккаунты
      </AppButton>
      <AppButton
        type="button"
        size="sm"
        aria-pressed={value === "gigabytes"}
        variant={value === "gigabytes" ? "primary" : "tertiary"}
        onClick={() => onChange?.("gigabytes")}
      >
        ГБ
      </AppButton>
    </div>
  );
}

export function BottomNav({
  active, onChange, onReselect, badges
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
  onReselect?: (tab: Tab) => void;
  badges?: Partial<Record<Tab, number>>;
}) {
  return (
    <div className="subs-dock">
      <nav className="subs-dock-surface" aria-label="Главная навигация">
        <MarketNavItem value="home" icon="home" label="Маркет"
          active={active === "home" || active === "search"}
          onChange={onChange} onReselect={onReselect} />
        <MarketNavItem value="mine" icon="mine" label="Мои"
          badge={badges?.mine} active={active === "mine"}
          onChange={onChange} onReselect={onReselect} />
        <MarketNavItem value="requests" icon="requests" label="Действия"
          badge={badges?.requests} active={active === "requests"}
          onChange={onChange} onReselect={onReselect} />
      </nav>
      <div className="subs-dock-create">
        <MarketNavItem value="create" icon="create" label="Создать"
          active={active === "create"} onChange={onChange} onReselect={onReselect} />
      </div>
    </div>
  );
}

function pluralRu(value: number, one: string, few: string, many: string) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function formatNavBadgeDescription(badge?: number) {
  if (badge === undefined || badge <= 0) return undefined;
  if (badge > 9) return "9 или больше уведомлений";
  return `${badge} ${pluralRu(badge, "уведомление", "уведомления", "уведомлений")}`;
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
  const badgeDescriptionId = useId();
  const badgeDescription = formatNavBadgeDescription(badge);

  return (
    <button
      type="button"
      className="subs-dock-item"
      data-testid="nav-item"
      data-kind={value === "create" ? "create" : "tab"}
      data-active={active ? "true" : "false"}
      aria-current={active ? "page" : undefined}
      aria-describedby={badgeDescription ? badgeDescriptionId : undefined}
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
          <span className="subs-dock-badge" aria-hidden="true">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </span>
      <span className="subs-dock-label">{label}</span>
      {badgeDescription ? (
        <span className="sr-only" id={badgeDescriptionId}>{badgeDescription}</span>
      ) : null}
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
  return <NavIcon icon={icon} active={active} plain />;
}

function NavIcon({
  icon,
  active = false,
  plain = false
}: {
  icon: "home" | "create" | "mine" | "requests";
  active?: boolean;
  plain?: boolean;
}) {
  const common = {
    className: plain ? undefined : "nav-icon"
  } as const;

  if (icon === "home") {
    return <SystemSymbol name={active ? "square.grid.2x2.fill" : "square.grid.2x2"} {...common} size={22} />;
  }

  if (icon === "create") {
    return <SystemSymbol name="plus" {...common} size={23} />;
  }

  if (icon === "requests") {
    return <SystemSymbol name="clipboard.list" {...common} size={22} />;
  }

  return <SystemSymbol name={active ? "person.crop.circle.fill" : "person.crop.circle"} {...common} size={22} />;
}
