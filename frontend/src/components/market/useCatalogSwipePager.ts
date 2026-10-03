import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent
} from "react";
import { triggerTelegramSelection } from "../../telegram";
import type { FamilyType } from "../../types";
import type { CatalogFilter, CatalogPointerState } from "./types";

export const CATALOG_SWIPE_GAP = 16;

export function useCatalogSwipePager({
  familyType,
  isCatalog,
  scrollRef,
  onSelectCatalogFilter,
  onOpenFamilyCatalog
}: {
  familyType: FamilyType;
  isCatalog: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onSelectCatalogFilter: (filter: CatalogFilter) => void;
  onOpenFamilyCatalog: (type: FamilyType) => void;
}) {
  const catalogViewportRef = useRef<HTMLDivElement | null>(null);
  const catalogTrackRef = useRef<HTMLDivElement | null>(null);
  const catalogPositionRef = useRef(familyType === "tariff" ? 1 : 0);
  const catalogPointerRef = useRef<CatalogPointerState | null>(null);
  const catalogAnimationFrame = useRef<number | null>(null);
  const catalogAnimationTargetRef = useRef<number | null>(null);
  const familyTypeSwitchRef = useRef<HTMLElement | null>(null);
  const catalogWasSwiped = useRef(false);
  const wasCatalogRef = useRef(isCatalog);

  function setCatalogPosition(position: number) {
    catalogPositionRef.current = position;
    const track = catalogTrackRef.current;
    if (track) {
      const width = catalogViewportRef.current?.clientWidth || 0;
      if (width > 0) {
        track.style.transform = `translate3d(${-position * (width + CATALOG_SWIPE_GAP)}px, 0, 0)`;
      } else {
        track.style.transform = `translate3d(calc(${-position * 50}% - ${position * 8}px), 0, 0)`;
      }
    }
    const switchEl = familyTypeSwitchRef.current || document.querySelector<HTMLElement>(".sm-market-family-type-switch");
    const clampedPosition = Math.min(Math.max(position, 0), 1);
    switchEl?.style.setProperty("--catalog-type-position", String(clampedPosition));
  }

  function stopCatalogAnimation() {
    if (catalogAnimationFrame.current !== null) {
      cancelAnimationFrame(catalogAnimationFrame.current);
      catalogAnimationFrame.current = null;
    }
    catalogTrackRef.current?.classList.remove("is-swiping");
  }

  function animateCatalogTo(
    nextPosition: number,
    initialVelocity = 0,
    interaction: "gesture" | "click" = "gesture"
  ) {
    const target = Math.min(Math.max(nextPosition, 0), 1);
    stopCatalogAnimation();
    catalogAnimationTargetRef.current = target;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCatalogPosition(target);
      catalogAnimationTargetRef.current = null;
      catalogTrackRef.current?.classList.remove("is-swiping");
      return;
    }

    let position = catalogPositionRef.current;
    if (Math.abs(target - position) < 0.001 && Math.abs(initialVelocity) < 0.01) {
      setCatalogPosition(target);
      catalogAnimationTargetRef.current = null;
      catalogTrackRef.current?.classList.remove("is-swiping");
      return;
    }

    catalogTrackRef.current?.classList.add("is-swiping");
    let velocity = Math.max(-4, Math.min(4, initialVelocity));
    const stiffness = 260;
    const damping = 32;
    let previousTime = performance.now();
    const step = (time: number) => {
      const deltaTime = Math.min((time - previousTime) / 1000, 0.032);
      previousTime = time;
      const acceleration = (target - position) * stiffness - velocity * damping;
      velocity += acceleration * deltaTime;
      position += velocity * deltaTime;
      setCatalogPosition(position);

      if (Math.abs(target - position) < 0.001 && Math.abs(velocity) < 0.01) {
        setCatalogPosition(target);
        catalogAnimationTargetRef.current = null;
        catalogAnimationFrame.current = null;
        catalogTrackRef.current?.classList.remove("is-swiping");
        return;
      }
      catalogAnimationFrame.current = requestAnimationFrame(step);
    };
    catalogAnimationFrame.current = requestAnimationFrame(step);
  }

  function handleCatalogPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    stopCatalogAnimation();
    catalogAnimationTargetRef.current = null;
    catalogWasSwiped.current = false;
    catalogPointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originPosition: catalogPositionRef.current,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocityX: 0,
      isDragging: false,
      cancelled: false
    };
  }

  function handleCatalogPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const pointer = catalogPointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId || pointer.cancelled) return;
    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    if (!pointer.isDragging) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (absX < 8 && absY < 8) return;

      if (absY >= 14 && absY > absX * 1.4) {
        pointer.cancelled = true;
        catalogPointerRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        catalogTrackRef.current?.classList.remove("is-swiping");
        const target = familyType === "tariff" ? 1 : 0;
        animateCatalogTo(target, 0, "gesture");
        return;
      }
      if (absX >= 8 && absX * 1.4 >= absY) {
        pointer.isDragging = true;
        catalogWasSwiped.current = true;
        catalogTrackRef.current?.classList.add("is-swiping");
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {}
      } else {
        return;
      }
    }

    const now = performance.now();
    const elapsed = Math.max(1, now - pointer.lastTime);
    pointer.velocityX = ((event.clientX - pointer.lastX) / elapsed) * 1000;
    pointer.lastX = event.clientX;
    pointer.lastTime = now;
    const width = catalogViewportRef.current?.clientWidth || 1;
    const stepSize = width + CATALOG_SWIPE_GAP;
    const rawPosition = pointer.originPosition - deltaX / stepSize;
    const position = rawPosition < 0
      ? rawPosition * 0.25
      : rawPosition > 1
        ? 1 + (rawPosition - 1) * 0.25
        : rawPosition;
    setCatalogPosition(position);
  }

  function handleCatalogPointerEnd(event: ReactPointerEvent<HTMLElement>, cancelled = false) {
    const pointer = catalogPointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    catalogPointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const defaultTarget = familyType === "tariff" ? 1 : 0;
    if (pointer.cancelled || cancelled || !pointer.isDragging) {
      catalogTrackRef.current?.classList.remove("is-swiping");
      animateCatalogTo(defaultTarget, 0, "gesture");
      return;
    }

    const deltaX = event.clientX - pointer.startX;
    const width = catalogViewportRef.current?.clientWidth || 1;
    const stepSize = width + CATALOG_SWIPE_GAP;
    const passedDistance = Math.abs(deltaX) >= width * 0.18;
    const passedVelocity = Math.abs(pointer.velocityX) >= 450;
    let target = Math.round(catalogPositionRef.current);
    if (passedDistance || passedVelocity) {
      const direction = passedVelocity
        ? (pointer.velocityX < 0 ? 1 : -1)
        : (deltaX < 0 ? 1 : -1);
      target = Math.round(pointer.originPosition) + direction;
    }
    target = Math.min(Math.max(target, 0), 1);
    animateCatalogTo(target, -pointer.velocityX / stepSize, "gesture");

    const nextType: FamilyType = target === 1 ? "tariff" : "subscription";
    if (nextType !== familyType) {
      triggerTelegramSelection();
      onSelectCatalogFilter("all");
      onOpenFamilyCatalog(nextType);
    }
  }

  useEffect(() => () => {
    stopCatalogAnimation();
  }, []);

  useEffect(() => {
    const wasCatalog = wasCatalogRef.current;
    wasCatalogRef.current = isCatalog;
    if (!isCatalog) {
      catalogPositionRef.current = familyType === "tariff" ? 1 : 0;
      return;
    }
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    const target = familyType === "tariff" ? 1 : 0;
    if (!wasCatalog) {
      catalogPositionRef.current = target;
      setCatalogPosition(target);
      catalogAnimationTargetRef.current = null;
      stopCatalogAnimation();
      return;
    }
    if (catalogPointerRef.current) return;
    if (catalogAnimationTargetRef.current === target) return;
    if (Math.abs(catalogPositionRef.current - target) < 0.001) {
      setCatalogPosition(target);
      return;
    }
    animateCatalogTo(target, 0, "click");
  }, [familyType, isCatalog, scrollRef]);

  return {
    catalogViewportRef,
    catalogTrackRef,
    catalogPositionRef,
    catalogPointerRef,
    catalogAnimationFrame,
    familyTypeSwitchRef,
    catalogWasSwiped,
    setCatalogPosition,
    stopCatalogAnimation,
    animateCatalogTo,
    handleCatalogPointerDown,
    handleCatalogPointerMove,
    handleCatalogPointerEnd
  };
}
