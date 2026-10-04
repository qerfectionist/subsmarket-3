import { forwardRef, useId, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useSegmentSwitchSwipe } from "../hooks/useSegmentSwitchSwipe";

import {
  Button as AppButton,
  Typography
} from "./ui";
import { SystemSymbol } from "./SystemSymbol";

import type { Tab } from "../appTypes";
import { familyTypeLabels } from "../labels";
import { triggerTelegramSelection } from "../telegram";
import type { FamilyType } from "../types";

export { DevUserSwitch } from "./DevControls";

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

const familyTypeOptions = ["subscription", "tariff"] as const;

export function FamilyTypeSwitch({ value, onChange }: { value: FamilyType; onChange: (value: FamilyType) => void }) {
  const switchRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    switchRef.current?.style.setProperty(
      "--family-type-position",
      String(value === "subscription" ? 0 : 1)
    );
  }, [value]);

  const switchSwipe = useSegmentSwitchSwipe<FamilyType>({
    items: familyTypeOptions,
    value,
    onChange,
    onPositionChange: (pos, dragging) => {
      const el = switchRef.current;
      if (!el) return;
      el.style.setProperty("--family-type-position", String(pos));
      if (dragging) el.setAttribute("data-scope-dragging", "true");
      else el.removeAttribute("data-scope-dragging");
    }
  });

  return (
    <div
      ref={(node) => {
        switchRef.current = node;
        switchSwipe.switchRef.current = node;
      }}
      className="family-type-switch"
      role="group"
      aria-label="Тип семейного предложения"
      {...switchSwipe.handlers}
    >
      {familyTypeOptions.map((type) => (
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

const myProductScopes = ["families", "accounts", "gigabytes"] as const;

export const ProductScopeSwitch = forwardRef<HTMLDivElement, {
  value?: "families" | "accounts" | "gigabytes";
  onChange?: (value: "families" | "accounts" | "gigabytes") => void;
  familiesLabel?: string;
  badges?: Partial<Record<"families" | "accounts" | "gigabytes", number>>;
  dragPosition?: number;
  activateOnPointerDown?: boolean;
  /**
   * Капсулой управляет внешний контроллер (свайп-пейджер), поэтому React не
   * пишет --scope-position: иначе ре-рендер во время анимации затирает её, и
   * капсула на кадр прыгает в начало.
   */
  imperativePosition?: boolean;
}>(function ProductScopeSwitch({
  value = "families",
  onChange,
  familiesLabel = "Семьи",
  badges,
  dragPosition,
  activateOnPointerDown = false,
  imperativePosition = false
}, ref) {
  const position = dragPosition ?? myProductScopes.indexOf(value);
  const innerRef = useRef<HTMLDivElement | null>(null);

  const switchSwipe = useSegmentSwitchSwipe<"families" | "accounts" | "gigabytes">({
    items: myProductScopes,
    value,
    onChange: (nextValue) => onChange?.(nextValue),
    onPositionChange: (pos, dragging) => {
      const node = innerRef.current;
      if (!node) return;
      node.style.setProperty("--scope-position", String(pos));
      if (dragging) {
        node.dataset.scopeDragging = "true";
      } else {
        delete node.dataset.scopeDragging;
      }
    }
  });

  const setRef = (node: HTMLDivElement | null) => {
    innerRef.current = node;
    switchSwipe.switchRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  const handlePointerDown = (nextValue: "families" | "accounts" | "gigabytes") => {
    if (activateOnPointerDown && nextValue !== value) onChange?.(nextValue);
  };
  const handleClick = (nextValue: "families" | "accounts" | "gigabytes") => {
    if (activateOnPointerDown && nextValue === value) return;
    onChange?.(nextValue);
  };
  const style = imperativePosition ? undefined : ({ "--scope-position": position } as CSSProperties);

  return (
    <div ref={setRef} className="product-scope-switch" role="group" aria-label="Разделы" style={style} {...switchSwipe.handlers}>
      <AppButton
        type="button"
        size="sm"
        data-testid="product-scope-families"
        aria-pressed={value === "families"}
        variant={value === "families" ? "primary" : "tertiary"}
        onPointerDown={() => handlePointerDown("families")}
        onClick={() => handleClick("families")}
      >
        {familiesLabel}
        {badges?.families ? (
          <span className="actions-tab-badge">{badges.families}</span>
        ) : null}
      </AppButton>
      <AppButton
        type="button"
        size="sm"
        data-testid="product-scope-accounts"
        aria-pressed={value === "accounts"}
        variant={value === "accounts" ? "primary" : "tertiary"}
        onPointerDown={() => handlePointerDown("accounts")}
        onClick={() => handleClick("accounts")}
      >
        Аккаунты
        {badges?.accounts ? (
          <span className="actions-tab-badge">{badges.accounts}</span>
        ) : null}
      </AppButton>
      <AppButton
        type="button"
        size="sm"
        data-testid="product-scope-gigabytes"
        aria-pressed={value === "gigabytes"}
        variant={value === "gigabytes" ? "primary" : "tertiary"}
        onPointerDown={() => handlePointerDown("gigabytes")}
        onClick={() => handleClick("gigabytes")}
      >
        ГБ
        {badges?.gigabytes ? (
          <span className="actions-tab-badge">{badges.gigabytes}</span>
        ) : null}
      </AppButton>
    </div>
  );
});

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
        <MarketNavItem value="requests" icon="requests" label="Заявки"
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
