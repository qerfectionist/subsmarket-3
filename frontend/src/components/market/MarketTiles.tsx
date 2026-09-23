import type { ReactNode } from "react";
import { SystemSymbol } from "../SystemSymbol";
import { triggerTelegramSelection } from "../../telegram";
import type { MarketBanner } from "./types";

export function BannerIcon({ icon }: { icon: MarketBanner["icon"] }) {
  const props = { size: 22, strokeWidth: 1.9 };
  if (icon === "alert") return <SystemSymbol name="exclamationmark.circle" {...props} />;
  if (icon === "clock") return <SystemSymbol name="clock" {...props} />;
  if (icon === "shield") return <SystemSymbol name="checkmark.shield" {...props} />;
  if (icon === "payment") return <SystemSymbol name="checkmark.circle" {...props} />;
  if (icon === "request") return <SystemSymbol name="person.2.badge.plus" {...props} />;
  if (icon === "message") return <SystemSymbol name="message" {...props} />;
  return <SystemSymbol name="paperplane" {...props} />;
}

export function CategoryIconGradientDefs() {
  return (
    <svg aria-hidden="true" className="sm-category-icon-defs" focusable="false">
      <defs>
        <linearGradient id="sm-category-icon-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--app-category-icon-gradient-start)" />
          <stop offset="52%" stopColor="var(--app-category-icon-gradient-mid)" />
          <stop offset="100%" stopColor="var(--app-category-icon-gradient-end)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function IconButton({
  label,
  testId,
  onClick,
  children
}: {
  label: string;
  testId?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      data-testid={testId}
      className="sm-market-icon-button"
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function MarketTile({
  category,
  title,
  subtitle,
  ariaLabel,
  icon,
  onClick,
  testId
}: {
  category: "tariff" | "subscription" | "gigabytes" | "accounts";
  title: string;
  subtitle?: string;
  ariaLabel?: string;
  icon: ReactNode;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      className={`sm-market-service-tile sm-market-service-tile-${category}`}
      type="button"
      aria-label={ariaLabel}
      data-testid={testId}
      onClick={() => {
        triggerTelegramSelection();
        onClick();
      }}
    >
      <span className="sm-market-service-icon" aria-hidden>
        {icon}
      </span>
      <span className="sm-market-service-copy">
        <strong>{title}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
      <span className="sm-market-service-chevron" aria-hidden>
        ›
      </span>
    </button>
  );
}
