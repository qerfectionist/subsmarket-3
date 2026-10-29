import type { MouseEvent, RefObject } from "react";
import { triggerTelegramImpact } from "../telegram";

export interface ScrollToTopButtonProps {
  onClick?: () => void;
  containerRef?: RefObject<HTMLElement | null>;
  label?: string;
  testId?: string;
  className?: string;
}

export function ScrollToTopButton({
  onClick,
  containerRef,
  label = "Наверх",
  testId = "scroll-to-top-btn",
  className = ""
}: ScrollToTopButtonProps) {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    triggerTelegramImpact("light");
    if (onClick) {
      onClick();
      return;
    }
    if (containerRef?.current) {
      containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Auto-discover nearest scrollable ancestor container
    const button = e.currentTarget;
    let curr = button.parentElement;
    while (curr) {
      if (
        curr.classList.contains("my-feed-scroll") ||
        curr.classList.contains("sm-market-home-feed-scroll") ||
        curr.classList.contains("sm-market-catalog-swipe-pane") ||
        curr.classList.contains("sm-market-catalog-feed-scroll") ||
        curr.classList.contains("actions-tab-content") ||
        curr.classList.contains("actions-archive-content") ||
        curr.classList.contains("subs-screen-scroll") ||
        curr.classList.contains("app-shell")
      ) {
        curr.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const { overflowY } = window.getComputedStyle(curr);
      if ((overflowY === "auto" || overflowY === "scroll") && curr.scrollHeight > curr.clientHeight) {
        curr.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      curr = curr.parentElement;
    }

    // Fallback: window smooth scroll
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className={`scroll-to-top-wrap ${className}`.trim()}>
      <button
        type="button"
        className="scroll-to-top-btn actions-scroll-to-top-btn"
        data-testid={testId}
        onClick={handleClick}
        aria-label={label}
      >
        <svg
          className="scroll-to-top-icon actions-scroll-to-top-icon"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
        <span className="scroll-to-top-text actions-scroll-to-top-text">{label}</span>
      </button>
    </div>
  );
}
