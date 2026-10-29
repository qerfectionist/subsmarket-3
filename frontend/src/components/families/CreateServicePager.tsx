import {
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type UIEvent
} from "react";
import { triggerTelegramImpact } from "../../telegram";

const GAP = 16;

/** -n/2 … n/2: how far page `i` is from position `pos` going the short way round. */
function wrapOffset(i: number, pos: number, n: number) {
  let d = (i - pos) % n;
  if (d < -n / 2) d += n;
  if (d >= n / 2) d -= n;
  return d;
}

const mod = (value: number, n: number) => ((value % n) + n) % n;

type Drag = {
  pointerId: number;
  startX: number;
  startY: number;
  startPos: number;
  lastX: number;
  lastTime: number;
  velocityX: number;
  mode: "pending" | "drag" | "scroll";
};

/**
 * Step 1 categories as pages on a wheel: a swipe left brings the next category
 * in from the right, a swipe right brings the previous one back from the left,
 * and the last and first are neighbours, so it goes round. Each page scrolls
 * up and down on its own.
 */
export function CreateServicePager({
  pages,
  index,
  onIndexChange,
  onPageScroll
}: {
  pages: { id: string; content: ReactNode }[];
  index: number;
  onIndexChange: (index: number) => void;
  onPageScroll: (event: UIEvent<HTMLDivElement>) => void;
}) {
  const count = pages.length;
  const loop = count >= 3;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const posRef = useRef(index);
  const dragRef = useRef<Drag | null>(null);
  const frameRef = useRef<number | null>(null);
  const swipedRef = useRef(false);
  const reportedRef = useRef(index);
  const onIndexChangeRef = useRef(onIndexChange);
  onIndexChangeRef.current = onIndexChange;

  function place(pos: number) {
    posRef.current = pos;
    const width = viewportRef.current?.clientWidth ?? 0;
    pageRefs.current.forEach((page, i) => {
      if (!page) return;
      const d = loop ? wrapOffset(i, pos, count) : i - pos;
      page.style.transform = `translate3d(${d * (width + GAP)}px, 0, 0)`;
      // Only the page on screen and its neighbours are drawn.
      page.style.visibility = Math.abs(d) < 1.05 ? "visible" : "hidden";
      page.setAttribute("aria-hidden", Math.abs(d) < 0.5 ? "false" : "true");
    });
  }

  function report(pos: number) {
    const next = loop ? mod(Math.round(pos), count) : Math.min(Math.max(Math.round(pos), 0), count - 1);
    if (next !== reportedRef.current) {
      reportedRef.current = next;
      onIndexChangeRef.current(next);
    }
  }

  function stop() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }

  function animateTo(target: number, velocity = 0) {
    stop();
    if (!loop) target = Math.min(Math.max(target, 0), count - 1);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      place(target);
      report(target);
      return;
    }
    let pos = posRef.current;
    let v = Math.max(-4, Math.min(4, velocity));
    let previous = performance.now();
    const started = previous;
    const step = (time: number) => {
      const dt = Math.min((time - previous) / 1000, 0.032);
      previous = time;
      v += ((target - pos) * 260 - v * 32) * dt;
      pos += v * dt;
      place(pos);
      if ((Math.abs(target - pos) < 0.002 && Math.abs(v) < 0.04) || time - started > 420) {
        place(target);
        frameRef.current = null;
        return;
      }
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  }

  useLayoutEffect(() => {
    place(posRef.current);
    const onResize = () => place(posRef.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  useEffect(() => () => stop(), []);

  // A tab tap: go the short way round to that page.
  useEffect(() => {
    if (index === reportedRef.current) return;
    reportedRef.current = index;
    const from = posRef.current;
    const delta = loop ? wrapOffset(index, from, count) : index - from;
    animateTo(from + delta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    stop();
    swipedRef.current = false;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPos: posRef.current,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocityX: 0,
      mode: "pending"
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (drag.mode === "pending") {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        drag.mode = "drag";
        swipedRef.current = true;
        try {
          viewportRef.current?.setPointerCapture(event.pointerId);
        } catch {
          // Capture is a nicety; the swipe works without it.
        }
      } else if (Math.abs(dy) > 8) {
        drag.mode = "scroll";
      }
    }
    if (drag.mode !== "drag") return;
    const now = performance.now();
    const dt = Math.max(now - drag.lastTime, 1);
    drag.velocityX = ((event.clientX - drag.lastX) / dt) * 1000;
    drag.lastX = event.clientX;
    drag.lastTime = now;
    const width = viewportRef.current?.clientWidth || 1;
    let pos = drag.startPos - dx / (width + GAP);
    // Without a wheel the ends resist instead of going past.
    if (!loop && (pos < 0 || pos > count - 1)) {
      const edge = pos < 0 ? 0 : count - 1;
      pos = edge + (pos - edge) * 0.3;
    }
    place(pos);
    report(pos);
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.mode !== "drag") return;
    const width = viewportRef.current?.clientWidth || 1;
    const dx = event.clientX - drag.startX;
    const base = Math.round(drag.startPos);
    let target = base;
    if (!cancelled) {
      const fast = Math.abs(drag.velocityX) >= 220;
      const far = Math.abs(dx) >= Math.min(width * 0.14, 48);
      if (fast || far) target = base + ((fast ? drag.velocityX : dx) < 0 ? 1 : -1);
    }
    if (!loop) target = Math.min(Math.max(target, 0), count - 1);
    if (mod(target, count) !== mod(base, count)) triggerTelegramImpact("light");
    animateTo(target, -drag.velocityX / (width + GAP));
    report(target);
  }

  return (
    <div
      ref={viewportRef}
      className="create-service-pager"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => onPointerEnd(event)}
      onPointerCancel={(event) => onPointerEnd(event, true)}
      // A logo dragged as an image would cancel the swipe.
      onDragStart={(event) => event.preventDefault()}
      // A swipe that ends on a tile does not pick it.
      onClickCapture={(event) => {
        if (!swipedRef.current) return;
        swipedRef.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {pages.map((page, i) => (
        <div
          key={page.id}
          ref={(element) => {
            pageRefs.current[i] = element;
          }}
          className="create-service-sections create-service-page"
          data-page-id={page.id}
          data-testid={`create-service-page-${page.id}`}
          onScroll={onPageScroll}
        >
          {page.content}
        </div>
      ))}
    </div>
  );
}
