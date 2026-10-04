import {
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import { triggerTelegramImpact } from "../../telegram";

export type MyProductScope = "families" | "accounts" | "gigabytes";

export const myProductScopeOrder: readonly MyProductScope[] = [
  "families",
  "accounts",
  "gigabytes"
];

type MyProductScopePointerState = {
  pointerId: number;
  startX: number;
  startY: number;
  originPosition: number;
  lastX: number;
  lastTime: number;
  velocityX: number;
  isDragging: boolean;
  cancelled: boolean;
};

export function MyProductScopePager({
  value,
  onChange,
  renderPane,
  onDragPositionChange,
  ariaLabel = "Разделы Моих объявлений"
}: {
  value: MyProductScope;
  onChange: (value: MyProductScope) => void;
  renderPane: (scope: MyProductScope) => ReactNode;
  onDragPositionChange?: (position: number, isDragging: boolean) => void;
  ariaLabel?: string;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const positionRef = useRef(myProductScopeOrder.indexOf(value));
  const pointerRef = useRef<MyProductScopePointerState | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationTargetRef = useRef<number | null>(null);
  const wasSwipedRef = useRef(false);
  const activeIndex = myProductScopeOrder.indexOf(value);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onDragPositionChangeRef = useRef(onDragPositionChange);
  onDragPositionChangeRef.current = onDragPositionChange;
  const SWIPE_GAP = 16;
  const scopeCount = myProductScopeOrder.length;

  function setPosition(position: number) {
    positionRef.current = position;
    if (trackRef.current) {
      const width = viewportRef.current?.clientWidth || 0;
      if (width > 0) {
        trackRef.current.style.transform = `translate3d(${-position * (width + SWIPE_GAP)}px, 0, 0)`;
      } else {
        trackRef.current.style.transform = `translate3d(calc(-${position} * ((100% + ${SWIPE_GAP}px) / ${scopeCount})), 0, 0)`;
      }
    }
  }

  function stopAnimation() {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }

  function animateTo(
    nextPosition: number,
    initialVelocity = 0,
    interaction: "gesture" | "click" = "gesture"
  ) {
    const target = Math.min(Math.max(nextPosition, 0), scopeCount - 1);
    stopAnimation();
    animationTargetRef.current = target;
    if (interaction === "click") {
      onDragPositionChangeRef.current?.(target, false);
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPosition(target);
      onDragPositionChangeRef.current?.(target, false);
      animationTargetRef.current = null;
      return;
    }

    let position = positionRef.current;
    if (Math.abs(target - position) < 0.001 && Math.abs(initialVelocity) < 0.01) {
      setPosition(target);
      onDragPositionChangeRef.current?.(target, false);
      animationTargetRef.current = null;
      return;
    }

    let velocity = Math.max(-4, Math.min(4, initialVelocity));
    const stiffness = 260;
    const damping = 32;
    if (interaction === "gesture") {
      onDragPositionChangeRef.current?.(position, true);
    }
    let previousTime = performance.now();
    const startTime = previousTime;
    const step = (time: number) => {
      const deltaTime = Math.min((time - previousTime) / 1000, 0.032);
      previousTime = time;
      const acceleration = (target - position) * stiffness - velocity * damping;
      velocity += acceleration * deltaTime;
      position += velocity * deltaTime;
      setPosition(position);
      if (interaction === "gesture") {
        onDragPositionChangeRef.current?.(position, true);
      }

      const distance = Math.abs(target - position);
      const isSettled =
        (distance < 0.002 && Math.abs(velocity) < 0.04) ||
        time - startTime > 350;

      if (isSettled) {
        setPosition(target);
        onDragPositionChangeRef.current?.(target, false);
        animationTargetRef.current = null;
        animationFrameRef.current = null;
        return;
      }
      animationFrameRef.current = requestAnimationFrame(step);
    };
    animationFrameRef.current = requestAnimationFrame(step);
  }

  function cleanupPointer() {
    const pointer = pointerRef.current;
    if (pointer && viewportRef.current) {
      try {
        if (viewportRef.current.hasPointerCapture(pointer.pointerId)) {
          viewportRef.current.releasePointerCapture(pointer.pointerId);
        }
      } catch {}
    }
    pointerRef.current = null;
  }

  function finishPointer(clientX: number, cancelled = false) {
    const pointer = pointerRef.current;
    if (!pointer) return;

    const wasDragging = pointer.isDragging;
    const isCancelled = cancelled || pointer.cancelled;
    const currentActive = activeIndexRef.current;
    const finalX = typeof clientX === "number" && clientX > 0 ? clientX : pointer.lastX;
    cleanupPointer();

    if (isCancelled || !wasDragging) {
      animateTo(currentActive, 0, "gesture");
      return;
    }

    const deltaX = finalX - pointer.startX;
    const width = viewportRef.current?.clientWidth || 1;
    const stepSize = width + SWIPE_GAP;
    const passedDistance = Math.abs(deltaX) >= Math.min(width * 0.14, 48);
    const passedVelocity = Math.abs(pointer.velocityX) >= 220;
    let target = currentActive;

    if (passedDistance || passedVelocity) {
      const direction = passedVelocity
        ? (pointer.velocityX < 0 ? 1 : -1)
        : (deltaX < 0 ? 1 : -1);
      target = Math.round(pointer.originPosition) + direction;
    }
    target = Math.min(Math.max(target, 0), scopeCount - 1);
    animateTo(target, -pointer.velocityX / stepSize, "gesture");
    if (target !== currentActive) {
      triggerTelegramImpact("light");
      onChangeRef.current(myProductScopeOrder[target]);
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    stopAnimation();
    animationTargetRef.current = null;
    wasSwipedRef.current = false;
    pointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originPosition: positionRef.current,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocityX: 0,
      isDragging: false,
      cancelled: false
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId || pointer.cancelled) return;
    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;

    if (!pointer.isDragging) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (absX < 8 && absY < 8) return;

      if (absY >= 14 && absY > absX * 1.4) {
        pointer.cancelled = true;
        finishPointer(event.clientX, true);
        return;
      }

      if (absX >= 8 && absX * 1.4 >= absY) {
        pointer.isDragging = true;
        wasSwipedRef.current = true;
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
    const width = viewportRef.current?.clientWidth || 1;
    const stepSize = width + SWIPE_GAP;
    const rawPosition = pointer.originPosition - deltaX / stepSize;
    const lastIndex = scopeCount - 1;
    const position =
      rawPosition < 0
        ? rawPosition * 0.25
        : rawPosition > lastIndex
          ? lastIndex + (rawPosition - lastIndex) * 0.25
          : rawPosition;
    setPosition(position);
    onDragPositionChangeRef.current?.(position, true);
  }

  useLayoutEffect(() => {
    if (pointerRef.current && !pointerRef.current.isDragging) {
      pointerRef.current = null;
    }
    if (pointerRef.current?.isDragging) return;
    if (animationTargetRef.current === activeIndex) return;
    if (Math.abs(positionRef.current - activeIndex) < 0.001) {
      setPosition(activeIndex);
      onDragPositionChangeRef.current?.(activeIndex, false);
      return;
    }
    animateTo(activeIndex, 0, "click");
  }, [activeIndex]);

  useEffect(() => {
    const handleWindowPointerUp = (event: PointerEvent) => {
      if (pointerRef.current && pointerRef.current.pointerId === event.pointerId) {
        finishPointer(event.clientX, false);
      }
    };
    const handleWindowPointerCancel = (event: PointerEvent) => {
      if (pointerRef.current && pointerRef.current.pointerId === event.pointerId) {
        finishPointer(event.clientX, true);
      }
    };
    const handleResize = () => {
      if (!pointerRef.current?.isDragging && animationTargetRef.current === null) {
        setPosition(activeIndexRef.current);
      }
    };
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerCancel);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerCancel);
      window.removeEventListener("resize", handleResize);
      stopAnimation();
      animationTargetRef.current = null;
    };
  }, []);

  return (
    <div
      className="my-product-scope-swipe-viewport"
      ref={viewportRef}
      data-testid="my-product-scope-swipe-viewport"
      role="group"
      aria-label={ariaLabel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onClickCapture={(event) => {
        if (!wasSwipedRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        wasSwipedRef.current = false;
      }}
    >
      <div
        className="my-product-scope-swipe-track"
        ref={trackRef}
        data-testid="my-product-scope-swipe-track"
        style={{
          transform: `translate3d(calc(-${positionRef.current} * ((100% + ${SWIPE_GAP}px) / ${scopeCount})), 0, 0)`
        }}
      >
        {myProductScopeOrder.map((scope) => (
          <div
            key={scope}
            className="my-product-scope-swipe-pane"
            data-testid="my-product-scope-swipe-pane"
            data-product-scope={scope}
            data-scope={scope}
            aria-hidden={scope !== value}
            aria-live={scope === value ? "polite" : undefined}
          >
            {renderPane(scope)}
          </div>
        ))}
      </div>
    </div>
  );
}
