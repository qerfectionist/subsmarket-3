import { useEffect } from "react";

/**
 * Marks scrolled scroll-containers with data-scrolled="true"
 * and data-scrolling="true" for swipe panes to apply visual headers and prevent conflicts.
 */
export function useAppScrollCapture() {
  useEffect(() => {
    let actionsScrollTimeout: number | null = null;

    const handleScrollCapture = (event: Event) => {
      const target = event.target;
      if (!target || !(target instanceof HTMLElement)) return;
      const isScrolled = target.scrollTop > 2;
      const current = target.getAttribute("data-scrolled") === "true";
      if (isScrolled !== current) {
        if (isScrolled) {
          target.setAttribute("data-scrolled", "true");
          target
            .closest<HTMLElement>(
              ".actions-scope-swipe-pane, .my-product-scope-swipe-pane, .my-feed-wrap, .sm-market-home-feed-wrap, .sm-market-catalog-swipe-viewport, .sm-market-catalog-stack, .gb-stack, .actions-archive-content, .my-calendar-disclosure, .family-details-page, .app-shell"
            )
            ?.setAttribute("data-scrolled", "true");
        } else {
          target.removeAttribute("data-scrolled");
          target
            .closest<HTMLElement>(
              ".actions-scope-swipe-pane, .my-product-scope-swipe-pane, .my-feed-wrap, .sm-market-home-feed-wrap, .sm-market-catalog-swipe-viewport, .sm-market-catalog-stack, .gb-stack, .actions-archive-content, .my-calendar-disclosure, .family-details-page, .app-shell"
            )
            ?.removeAttribute("data-scrolled");
        }
      }

      const actionsPane = target.closest<HTMLElement>(".actions-scope-swipe-pane");
      if (actionsPane) {
        if (isScrolled) {
          target.setAttribute("data-scrolling", "true");
          actionsPane.setAttribute("data-scrolling", "true");
          if (actionsScrollTimeout) {
            window.clearTimeout(actionsScrollTimeout);
          }
          actionsScrollTimeout = window.setTimeout(() => {
            target.removeAttribute("data-scrolling");
            actionsPane.removeAttribute("data-scrolling");
            actionsScrollTimeout = null;
          }, 200);
        } else {
          if (actionsScrollTimeout) {
            window.clearTimeout(actionsScrollTimeout);
            actionsScrollTimeout = null;
          }
          target.removeAttribute("data-scrolling");
          actionsPane.removeAttribute("data-scrolling");
        }
      }
    };

    window.addEventListener("scroll", handleScrollCapture, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", handleScrollCapture, { capture: true });
      if (actionsScrollTimeout) {
        window.clearTimeout(actionsScrollTimeout);
        actionsScrollTimeout = null;
      }
    };
  }, []);
}
