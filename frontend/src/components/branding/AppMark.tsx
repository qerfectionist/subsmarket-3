export function AppMark({ compact }: { compact?: boolean }) {
  return (
    <div className={compact ? "app-mark app-mark-compact" : "app-mark"} aria-label="SubsMarket">
      <span className="app-mark-icon" aria-hidden>
        <svg viewBox="0 0 32 32" role="presentation">
          <rect fill="currentColor" height="32" rx="8" width="32" />
          <circle cx="11" cy="16" fill="#ffffff" r="4" />
          <circle cx="21" cy="16" fill="#ffffff" r="4" opacity="0.88" />
          <path
            d="M11 16h10"
            stroke="#ffffff"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </svg>
      </span>
      {!compact ? <span className="app-mark-label">SubsMarket</span> : null}
    </div>
  );
}

export function UserAvatar({ name }: { name: string }) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  return (
    <span className="user-avatar" aria-hidden>
      {initial}
    </span>
  );
}