import { useEffect, useId, useState } from "react";
import type { Tab } from "../appTypes";
import { triggerTelegramSelection } from "../telegram";
import { SystemSymbol } from "./SystemSymbol";

export type NavStyle = "classic" | "spotify";

export function setNavStylePreference(style: NavStyle) {
  try {
    localStorage.setItem("subsmarket.navStyle", style);
  } catch {
    // ignore
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("subsmarket:nav-style-change", { detail: style }));
  }
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

function MarketNavIcon({
  icon,
  active,
  size
}: {
  icon: "home" | "create" | "mine" | "requests";
  active: boolean;
  size?: number;
}) {
  return <NavIcon icon={icon} active={active} plain size={size} />;
}

function NavIcon({
  icon,
  active = false,
  plain = false,
  size = 22
}: {
  icon: "home" | "create" | "mine" | "requests";
  active?: boolean;
  plain?: boolean;
  size?: number;
}) {
  const common = {
    className: plain ? undefined : "nav-icon"
  } as const;

  if (icon === "home") {
    return <SystemSymbol name={active ? "square.grid.2x2.fill" : "square.grid.2x2"} {...common} size={size} />;
  }

  if (icon === "create") {
    return <SystemSymbol name="plus" {...common} size={size + 1} />;
  }

  if (icon === "requests") {
    return <SystemSymbol name="clipboard.list" {...common} size={size} />;
  }

  return <SystemSymbol name={active ? "person.crop.circle.fill" : "person.crop.circle"} {...common} size={size} />;
}

function MarketNavItem({
  value,
  icon,
  label,
  badge,
  active,
  onChange,
  onReselect,
  iconSize
}: {
  value: Tab;
  icon: "home" | "create" | "mine" | "requests";
  label: string;
  badge?: number;
  active: boolean;
  onChange: (tab: Tab) => void;
  onReselect?: (tab: Tab) => void;
  iconSize?: number;
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
        <MarketNavIcon icon={icon} active={active} size={iconSize} />
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

export function BottomNav({
  active,
  badges,
  onChange,
  onReselect
}: {
  active: Tab;
  badges?: { mine?: number; requests?: number };
  onChange: (tab: Tab) => void;
  onReselect?: (tab: Tab) => void;
}) {
  const [navStyle, setNavStyle] = useState<NavStyle>(() => {
    if (typeof window === "undefined") return "spotify";
    const param = new URLSearchParams(window.location.search).get("nav");
    if (param === "spotify") return "spotify";
    if (param === "classic") return "classic";
    try {
      const stored = localStorage.getItem("subsmarket.navStyle");
      if (stored === "spotify") return "spotify";
      if (stored === "classic") return "classic";
    } catch {
      // ignore
    }
    return "spotify";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).setNavStyle = setNavStylePreference;
    const handler = (e: Event) => {
      const custom = e as CustomEvent<NavStyle>;
      if (custom.detail) setNavStyle(custom.detail);
    };
    window.addEventListener("subsmarket:nav-style-change", handler);
    return () => window.removeEventListener("subsmarket:nav-style-change", handler);
  }, []);

  const isSpotify = navStyle === "spotify";

  if (isSpotify) {
    return (
      <div className="subs-dock subs-dock--spotify" data-nav-style="spotify">
        <nav className="subs-dock-surface subs-dock-surface--spotify" aria-label="Главная навигация">
          <MarketNavItem
            value="home"
            icon="home"
            label="Маркет"
            active={active === "home" || active === "search"}
            onChange={onChange}
            onReselect={onReselect}
            iconSize={26}
          />
          <MarketNavItem
            value="mine"
            icon="mine"
            label="Мои"
            badge={badges?.mine}
            active={active === "mine"}
            onChange={onChange}
            onReselect={onReselect}
            iconSize={26}
          />
          <MarketNavItem
            value="requests"
            icon="requests"
            label="Заявки"
            badge={badges?.requests}
            active={active === "requests"}
            onChange={onChange}
            onReselect={onReselect}
            iconSize={26}
          />
          <div className="subs-dock-create">
            <MarketNavItem
              value="create"
              icon="create"
              label="Создать"
              active={active === "create"}
              onChange={onChange}
              onReselect={onReselect}
              iconSize={26}
            />
          </div>
        </nav>
      </div>
    );
  }

  return (
    <div className="subs-dock">
      <nav className="subs-dock-surface" aria-label="Главная навигация">
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
          value="requests"
          icon="requests"
          label="Заявки"
          badge={badges?.requests}
          active={active === "requests"}
          onChange={onChange}
          onReselect={onReselect}
        />
      </nav>
      <div className="subs-dock-create">
        <MarketNavItem
          value="create"
          icon="create"
          label="Создать"
          active={active === "create"}
          onChange={onChange}
          onReselect={onReselect}
        />
      </div>
    </div>
  );
}
