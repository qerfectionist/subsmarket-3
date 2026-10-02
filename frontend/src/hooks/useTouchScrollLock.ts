import { useEffect } from "react";
import { initTelegramShell } from "../api";

export function useTouchScrollLock() {
  useEffect(() => {
    const cleanupTelegram = initTelegramShell();

    // Ultimate iOS/TMA vertical rubber-banding preventer
    let lastTouchY = 0;
    let startTouchX = 0;
    let startTouchY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startTouchX = e.touches[0].clientX;
      startTouchY = e.touches[0].clientY;
      lastTouchY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;
      const deltaXFromStart = touchX - startTouchX;
      const deltaYFromStart = touchY - startTouchY;
      const deltaY = touchY - lastTouchY;
      lastTouchY = touchY;

      // 1. Never interfere with horizontal gestures (tabs, carousel, sliders)
      if (Math.abs(deltaXFromStart) > Math.abs(deltaYFromStart)) {
        return;
      }

      // 2. Never interfere with horizontal swipe widgets
      if (
        target.closest(
          ".actions-archive-carousel-viewport, .actions-archive-carousel-track, .actions-scope-swipe-viewport, .actions-scope-swipe-track, .my-product-scope-swipe-viewport, .my-product-scope-swipe-track, .sm-market-catalog-swipe-viewport, .sm-market-catalog-swipe-track, .my-calendar-month-viewport, [data-swipe-track]"
        )
      ) {
        return;
      }

      const scrollable = target.closest(
        ".my-feed-scroll, .actions-tab-content, .actions-archive-feed-scroll, .sm-market-home-feed-scroll, .sm-market-catalog-feed-scroll, .subs-screen-scroll, .my-calendar-disclosure-content, .wizard-scroll, textarea"
      ) as HTMLElement | null;

      if (!scrollable) {
        if (deltaY > 0 && e.cancelable) e.preventDefault();
        return;
      }

      const maxScroll = scrollable.scrollHeight - scrollable.clientHeight;
      if (maxScroll > 1) {
        const isAtTop = scrollable.scrollTop <= 0;
        const isAtBottom = scrollable.scrollTop >= maxScroll - 1;
        if ((isAtTop && deltaY > 0) || (isAtBottom && deltaY < 0)) {
          if (e.cancelable) e.preventDefault();
        }
      } else {
        if (deltaY > 0 && e.cancelable) e.preventDefault();
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      cleanupTelegram();
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);
}
