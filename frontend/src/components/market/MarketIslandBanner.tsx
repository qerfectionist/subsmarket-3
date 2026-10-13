import { useEffect, useState, type MouseEvent } from "react";
import { triggerTelegramImpact } from "../../telegram";
import type { MarketBanner } from "./types";

export interface MarketIslandBannerProps {
  bannerItems: MarketBanner[];
  onOpenActions?: (targetTab?: "inbox" | "outbox") => void;
  showIntro?: boolean;
  onDismissIntro?: () => void;
}

export function MarketIslandBanner({
  bannerItems,
  onOpenActions,
  showIntro,
  onDismissIntro
}: MarketIslandBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-cycle through notifications if multiple exist
  useEffect(() => {
    if (bannerItems.length <= 1) return;
    const interval = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % bannerItems.length);
    }, 4500);
    return () => window.clearInterval(interval);
  }, [bannerItems.length]);

  // When bannerItems change, ensure safe index
  const safeIndex = bannerItems.length > 0 ? currentIndex % bannerItems.length : 0;
  const activeBanner = bannerItems[safeIndex];

  // Case 1: Active notifications present
  if (activeBanner) {
    const handlePillClick = () => {
      triggerTelegramImpact("light");
      if (onOpenActions) {
        const isOutbox = activeBanner.id.includes("outbox") || activeBanner.id.includes("buyer");
        onOpenActions(isOutbox ? "outbox" : "inbox");
      }
    };

    return (
      <div className="market-island-wrap" data-testid="market-island-banner">
        <button
          type="button"
          className="market-island-pill"
          onClick={handlePillClick}
          aria-label={`${activeBanner.title} · ${activeBanner.detail}`}
        >
          <span
            className="market-island-dot"
            data-tone={activeBanner.tone || "info"}
            aria-hidden="true"
          />
          <span className="market-island-body">
            <span className="market-island-title">{activeBanner.title}</span>
            {activeBanner.meta && (
              <span className="market-island-badge">{activeBanner.meta}</span>
            )}
            {bannerItems.length > 1 && (
              <span className="market-island-badge">
                {safeIndex + 1}/{bannerItems.length}
              </span>
            )}
          </span>
          <svg
            className="market-island-chevron"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    );
  }

  // Case 2: No active notifications, show safety first-run notice
  if (showIntro) {
    const handleDismiss = (e: MouseEvent) => {
      e.stopPropagation();
      triggerTelegramImpact("light");
      onDismissIntro?.();
    };

    return (
      <div className="market-island-wrap">
        <div
          className="market-island-pill"
          data-testid="market-first-run-banner"
          role="status"
        >
          <span
            className="market-island-dot"
            data-tone="warning"
            aria-hidden="true"
          />
          <span className="market-island-body">
            <span className="market-island-title">Сначала доступ, потом оплата</span>
            <span className="market-island-badge">Безопасно</span>
          </span>
          <button
            type="button"
            className="market-island-dismiss"
            onClick={handleDismiss}
            aria-label="Скрыть подсказку"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return null;
}
