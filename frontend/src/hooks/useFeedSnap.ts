import { useCallback, useEffect, useRef } from "react";

interface UseFeedSnapOptions {
  enabled?: boolean;
  itemCount?: number;
  tailCardTarget?: "second" | "first";
  enableScrollSnap?: boolean;
}

export function useFeedSnap({
  enabled = true,
  itemCount = 0,
  tailCardTarget = "second",
  enableScrollSnap = true
}: UseFeedSnapOptions = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const snapTimeoutRef = useRef<number | null>(null);

  const updatePadding = useCallback(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;
    const cards = container.querySelectorAll<HTMLElement>(".sm-listing");
    if (cards.length === 0) {
      container.style.paddingBottom = "0px";
      return;
    }
    const firstCard = cards[0];
    const lastCard = cards[cards.length - 1];
    const lastCardRect = lastCard.getBoundingClientRect();
    const totalContentHeight = lastCardRect.bottom - firstCard.getBoundingClientRect().top;
    if (cards.length <= 1) {
      container.style.paddingBottom = "76px";
      return;
    }
    if (tailCardTarget !== "first" && totalContentHeight <= container.clientHeight - 76) {
      container.style.paddingBottom = "76px";
      return;
    }

    // Keep at least the last 2 cards visible when scrolled to the end of the feed,
    // or when tailCardTarget === "first", allow scrolling until the last card is at the top
    const referenceCard =
      tailCardTarget === "first"
        ? lastCard
        : (cards.length >= 2 ? cards[cards.length - 2] : cards[0]);
    const refRect = referenceCard.getBoundingClientRect();
    const tailHeight = lastCardRect.bottom - refRect.top;
    const diff = container.clientHeight - tailHeight;
    const targetPadding = Math.max(76, diff);
    container.style.paddingBottom = `${Math.round(targetPadding)}px`;
  }, [enabled, tailCardTarget]);

  const snapToNearestCard = useCallback(() => {
    if (!enableScrollSnap) return;
    const container = containerRef.current;
    if (!container || !enabled || isDraggingRef.current) return;

    updatePadding();

    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    if (maxScrollTop <= 1) return;

    const currentScrollTop = container.scrollTop;
    if (currentScrollTop <= 0) return;

    if (currentScrollTop < 45) {
      container.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const cards = container.querySelectorAll<HTMLElement>(".sm-listing");
    if (!cards.length) return;

    let closestTargetScrollTop = currentScrollTop;
    let minDistance = Infinity;

    cards.forEach((card) => {
      const cardRect = card.getBoundingClientRect();
      const distance = cardRect.top - containerRect.top;
      const targetScroll = currentScrollTop + distance;
      if (targetScroll < 45 || targetScroll > maxScrollTop + 10) return;

      if (Math.abs(distance) < Math.abs(minDistance)) {
        minDistance = distance;
        closestTargetScrollTop = targetScroll;
      }
    });

    if (Math.abs(minDistance) >= 3 && Math.abs(minDistance) < 140) {
      const target = Math.min(maxScrollTop, Math.max(0, Math.round(closestTargetScrollTop)));
      if (Math.abs(target - currentScrollTop) >= 3) {
        container.scrollTo({ top: target, behavior: "smooth" });
      }
    }
  }, [enabled, updatePadding]);

  useEffect(() => {
    if (!enabled) return;
    updatePadding();
    const transitionTimer = window.setTimeout(updatePadding, 320);
    const container = containerRef.current;
    let observer: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        updatePadding();
      });
      observer.observe(container);
      if (container.firstElementChild) {
        observer.observe(container.firstElementChild);
      }
    }
    window.addEventListener("resize", updatePadding);
    return () => {
      window.clearTimeout(transitionTimer);
      observer?.disconnect();
      window.removeEventListener("resize", updatePadding);
    };
  }, [enabled, itemCount, updatePadding]);

  useEffect(() => {
    return () => {
      if (snapTimeoutRef.current) {
        window.clearTimeout(snapTimeoutRef.current);
        snapTimeoutRef.current = null;
      }
    };
  }, []);

  const handleScroll = useCallback(() => {
    if (!enabled || isDraggingRef.current) return;
    if (snapTimeoutRef.current) window.clearTimeout(snapTimeoutRef.current);
    snapTimeoutRef.current = window.setTimeout(snapToNearestCard, 140);
  }, [enabled, snapToNearestCard]);

  const handleTouchStart = useCallback(() => {
    isDraggingRef.current = true;
    if (snapTimeoutRef.current) window.clearTimeout(snapTimeoutRef.current);
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
    if (!enabled) return;
    if (snapTimeoutRef.current) window.clearTimeout(snapTimeoutRef.current);
    snapTimeoutRef.current = window.setTimeout(snapToNearestCard, 140);
  }, [enabled, snapToNearestCard]);

  const handleWheel = useCallback(() => {
    if (!enabled) return;
    if (snapTimeoutRef.current) window.clearTimeout(snapTimeoutRef.current);
    snapTimeoutRef.current = window.setTimeout(snapToNearestCard, 150);
  }, [enabled, snapToNearestCard]);

  return {
    containerRef,
    updatePadding,
    snapToNearestCard,
    scrollHandlers: enableScrollSnap
      ? {
          onScroll: handleScroll,
          onTouchStart: handleTouchStart,
          onTouchEnd: handleTouchEnd,
          onTouchCancel: handleTouchEnd,
          onWheel: handleWheel
        }
      : {}
  };
}
