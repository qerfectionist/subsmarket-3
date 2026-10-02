import { useCallback, useEffect, useRef } from "react";

interface UseFeedSnapOptions {
  enabled?: boolean;
  itemCount?: number;
}

export function useFeedSnap({
  enabled = true,
  itemCount = 0
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
    const lastCard = cards[cards.length - 1];
    const lastCardRect = lastCard.getBoundingClientRect();
    const referenceCard = cards.length >= 3 ? cards[cards.length - 3] : cards[0];
    const refRect = referenceCard.getBoundingClientRect();
    const tailHeight = lastCardRect.bottom - refRect.top;
    const diff = container.clientHeight - tailHeight;
    const targetPadding = Math.max(76, diff);
    container.style.paddingBottom = `${Math.round(targetPadding)}px`;
  }, [enabled]);

  const snapToNearestCard = useCallback(() => {
    const container = containerRef.current;
    if (!container || !enabled || isDraggingRef.current) return;

    updatePadding();

    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    if (maxScrollTop <= 1) return;

    const currentScrollTop = container.scrollTop;
    if (currentScrollTop > 0 && currentScrollTop < 35) {
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
      if (targetScroll < -10 || targetScroll > maxScrollTop + 10) return;

      if (Math.abs(distance) < Math.abs(minDistance)) {
        minDistance = distance;
        closestTargetScrollTop = targetScroll;
      }
    });

    if (Math.abs(minDistance) >= 2 && Math.abs(minDistance) < 140) {
      const target = Math.min(maxScrollTop, Math.max(0, Math.round(closestTargetScrollTop)));
      container.scrollTo({ top: target, behavior: "smooth" });
    }
  }, [enabled, updatePadding]);

  useEffect(() => {
    if (!enabled) return;
    updatePadding();
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
    scrollHandlers: {
      onScroll: handleScroll,
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd,
      onWheel: handleWheel
    }
  };
}
