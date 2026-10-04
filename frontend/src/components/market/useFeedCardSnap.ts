import { useCallback, useEffect, useRef } from "react";
import type { FamilyType } from "../../types";

export function useFeedCardSnap({
  isCatalog,
  scrollRef,
  displayedLength,
  familyType
}: {
  isCatalog: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  displayedLength: number;
  familyType: FamilyType;
}) {
  const isFeedDraggingRef = useRef(false);
  const snapTimeoutRef = useRef<number | null>(null);
  const feedTouchStartY = useRef<number | null>(null);
  const feedTouchStartX = useRef<number | null>(null);

  const updateFeedPadding = useCallback(() => {
    const updateElementPadding = (container: HTMLElement | null) => {
      if (!container) return;
      const cards = container.querySelectorAll<HTMLElement>(".sm-listing");
      if (cards.length === 0) {
        container.style.paddingBottom = "";
        return;
      }
      const firstCard = cards[0];
      const lastCard = cards[cards.length - 1];
      const totalContentHeight = (lastCard.offsetTop + lastCard.offsetHeight) - firstCard.offsetTop;
      if (totalContentHeight <= container.clientHeight - 76) {
        container.style.paddingBottom = "76px";
        return;
      }
      // Keep at least the last 2 cards visible when scrolled to the end of the feed
      const referenceCard = cards.length >= 2 ? cards[cards.length - 2] : cards[0];
      const tailHeight = (lastCard.offsetTop + lastCard.offsetHeight) - referenceCard.offsetTop;
      const diff = container.clientHeight - tailHeight;
      const targetPadding = Math.max(76, diff);
      container.style.paddingBottom = `${Math.round(targetPadding)}px`;
    };

    if (isCatalog) {
      const panes = document.querySelectorAll<HTMLElement>(".sm-market-catalog-swipe-pane");
      if (panes.length > 0) {
        panes.forEach(pane => updateElementPadding(pane));
      } else {
        updateElementPadding(scrollRef.current);
      }
    } else {
      updateElementPadding(scrollRef.current);
    }
  }, [isCatalog, scrollRef]);

  const snapToNearestCard = useCallback(() => {
    const container = scrollRef.current;
    if (!container || isFeedDraggingRef.current) return;

    updateFeedPadding();

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
  }, [scrollRef, updateFeedPadding]);

  useEffect(() => {
    return () => {
      if (snapTimeoutRef.current) {
        window.clearTimeout(snapTimeoutRef.current);
        snapTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    updateFeedPadding();
    const frame = requestAnimationFrame(() => {
      updateFeedPadding();
    });
    window.addEventListener("resize", updateFeedPadding);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateFeedPadding);
    };
  }, [displayedLength, familyType, updateFeedPadding]);

  const handleFeedTouchStart = (e: React.TouchEvent) => {
    isFeedDraggingRef.current = true;
    if (snapTimeoutRef.current) {
      window.clearTimeout(snapTimeoutRef.current);
      snapTimeoutRef.current = null;
    }
    feedTouchStartY.current = e.touches[0].clientY;
    feedTouchStartX.current = e.touches[0].clientX;
  };

  const handleFeedTouchMove = () => {
    // Just tracks dragging for catalog/search feed
  };

  const handleFeedTouchEnd = () => {
    feedTouchStartY.current = null;
    feedTouchStartX.current = null;
    isFeedDraggingRef.current = false;
    if (snapTimeoutRef.current) {
      window.clearTimeout(snapTimeoutRef.current);
    }
    snapTimeoutRef.current = window.setTimeout(snapToNearestCard, 140);
  };

  const handleFeedWheel = () => {
    if (snapTimeoutRef.current) {
      window.clearTimeout(snapTimeoutRef.current);
    }
    snapTimeoutRef.current = window.setTimeout(snapToNearestCard, 150);
  };

  return {
    isFeedDraggingRef,
    snapTimeoutRef,
    updateFeedPadding,
    snapToNearestCard,
    handleFeedTouchStart,
    handleFeedTouchMove,
    handleFeedTouchEnd,
    handleFeedWheel
  };
}
