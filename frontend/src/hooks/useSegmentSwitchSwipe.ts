import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { triggerTelegramImpact, triggerTelegramSelection } from "../telegram";

export interface UseSegmentSwitchSwipeOptions<T extends string> {
  items: readonly T[];
  value: T;
  onChange: (value: T) => void;
  onPositionChange?: (position: number, isDragging: boolean) => void;
}

export function useSegmentSwitchSwipe<T extends string>({
  items,
  value,
  onChange,
  onPositionChange
}: UseSegmentSwitchSwipeOptions<T>) {
  const switchRef = useRef<HTMLElement | null>(null);
  const pointerRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startPos: number;
    lastX: number;
    lastTime: number;
    velocityX: number;
    isDragging: boolean;
  } | null>(null);
  const wasDraggedRef = useRef(false);

  const activeIndex = items.indexOf(value);
  const itemCount = items.length;

  const handlePointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointerRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startPos: activeIndex >= 0 ? activeIndex : 0,
      lastX: e.clientX,
      lastTime: performance.now(),
      velocityX: 0,
      isDragging: false
    };
    wasDraggedRef.current = false;
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== e.pointerId) return;

    const deltaX = e.clientX - pointer.startX;
    const deltaY = e.clientY - pointer.startY;

    if (!pointer.isDragging) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (absX < 6 && absY < 6) return;
      if (absY >= 10 && absY > absX * 1.2) {
        // Vertical swipe, cancel
        pointerRef.current = null;
        return;
      }
      if (absX >= 6) {
        pointer.isDragging = true;
        wasDraggedRef.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
      } else {
        return;
      }
    }

    const now = performance.now();
    const elapsed = Math.max(1, now - pointer.lastTime);
    pointer.velocityX = ((e.clientX - pointer.lastX) / elapsed) * 1000;
    pointer.lastX = e.clientX;
    pointer.lastTime = now;

    const switchEl = switchRef.current || e.currentTarget;
    const width = switchEl?.clientWidth || 280;
    const stepSize = width / itemCount;
    const posDelta = deltaX / stepSize;
    const maxIndex = itemCount - 1;
    const rawPos = pointer.startPos + posDelta;
    const clampedPos = Math.min(Math.max(rawPos, 0), maxIndex);

    onPositionChange?.(clampedPos, true);
  };

  const finishDrag = (e: ReactPointerEvent<HTMLElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== e.pointerId) return;
    const isDragging = pointer.isDragging;
    const deltaX = e.clientX - pointer.startX;
    const velocityX = pointer.velocityX;
    const startPos = pointer.startPos;
    pointerRef.current = null;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    if (!isDragging) return;

    const switchEl = switchRef.current || e.currentTarget;
    const width = switchEl?.clientWidth || 280;
    const stepSize = width / itemCount;
    const passedDistance = Math.abs(deltaX) >= Math.min(stepSize * 0.25, 24);
    const passedVelocity = Math.abs(velocityX) >= 160;

    let targetIndex = startPos;
    if (passedVelocity) {
      const direction = velocityX > 0 ? 1 : -1;
      targetIndex = Math.min(Math.max(startPos + direction, 0), itemCount - 1);
    } else if (passedDistance) {
      const direction = deltaX > 0 ? 1 : -1;
      const steps = Math.max(1, Math.round(Math.abs(deltaX) / stepSize));
      targetIndex = Math.min(Math.max(startPos + direction * steps, 0), itemCount - 1);
    }

    onPositionChange?.(targetIndex, false);

    if (targetIndex !== activeIndex) {
      triggerTelegramImpact("light");
      triggerTelegramSelection();
      onChange(items[targetIndex]);
    }
  };

  const handleClickCapture = (e: ReactMouseEvent<HTMLElement>) => {
    if (wasDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      wasDraggedRef.current = false;
    }
  };

  return {
    switchRef,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
      onClickCapture: handleClickCapture
    }
  };
}
