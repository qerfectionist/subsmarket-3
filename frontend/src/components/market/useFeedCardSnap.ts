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
      if (cards.length <= 3) {
        if (totalContentHeight <= container.clientHeight - 76) {
          container.style.paddingBottom = "0px";
        } else {
          container.style.paddingBottom = "76px";
        }
        return;
      }
      const last3Card = cards[cards.length - 3];
      const last3Height = (lastCard.offsetTop + lastCard.offsetHeight) - last3Card.offsetTop;
      const diff = container.clientHeight - last3Height;
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

    const currentScrollTop = container.scrollTop;
    if (currentScrollTop > 0 && currentScrollTop < 35) {
      container.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const cards = container.querySelectorAll<HTMLElement>(".sm-listing");
    if (!cards.length) return;

    const maxSnapCardIndex = Math.max(0, cards.length - 3);
    let closestTargetScrollTop = currentScrollTop;
    let minDistance = Infinity;

    cards.forEach((card, index) => {
      if (cards.length >= 3 && index > maxSnapCardIndex) return;

      const cardRect = card.getBoundingClientRect();
      const distance = cardRect.top - containerRect.top;
      if (Math.abs(distance) < Math.abs(minDistance)) {
        minDistance = distance;
        closestTargetScrollTop = currentScrollTop + distance;
      }
    });

    if (Math.abs(minDistance) >= 2 && Math.abs(minDistance) < 120) {
      const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
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
