import { useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { triggerTelegramImpact } from "../../telegram";

const GAP = 24;
/** Where the chosen name starts, from the wheel's left edge: the screen's side margin. */
const ANCHOR = 20;
/** The names go round three times, so the ring is always wider than the screen and never shows its seam. */
const COPIES = 3;

type Drag = {
  pointerId: number;
  startX: number;
  startY: number;
  startC: number;
  lastX: number;
  lastTime: number;
  velocityX: number;
  mode: "pending" | "drag" | "other";
};

/**
 * Step 1 categories as a wheel: the names sit on a ring, and the chosen one is
 * first in the row, where the list starts. A swipe left turns the ring, so
 * «Популярное» goes off to the left and «Видео» takes its place; after the last
 * name the first comes round again, and a swipe right brings it back from the
 * left. A tap on a name turns the ring the short way to it.
 */
export function CreateCategoryWheel({
  items,
  index,
  onIndexChange
}: {
  items: { id: string; title: string }[];
  index: number;
  onIndexChange: (index: number) => void;
}) {
  const count = items.length;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  // Every copy of every name: [copy * count + i].
  const labelRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lineRef = useRef<HTMLSpanElement | null>(null);
  // Where each name starts on one turn of the ring, its width, and one turn's length, in px.
  const startsRef = useRef<number[]>([]);
  const widthsRef = useRef<number[]>([]);
  const turnRef = useRef(1);
  // The point of the ring at the anchor.
  const cRef = useRef(0);
  const dragRef = useRef<Drag | null>(null);
  const frameRef = useRef<number | null>(null);
  const swipedRef = useRef(false);
  const reportedRef = useRef(index);
  const onIndexChangeRef = useRef(onIndexChange);
  onIndexChangeRef.current = onIndexChange;

  /** The short way round one turn: -turn/2 … turn/2. */
  const shortWay = (value: number) => {
    const turn = turnRef.current;
    let d = value % turn;
    if (d < -turn / 2) d += turn;
    if (d >= turn / 2) d -= turn;
    return d;
  };

  function nearest(c: number) {
    let best = 0;
    let bestDistance = Infinity;
    startsRef.current.forEach((start, i) => {
      const distance = Math.abs(shortWay(start - c));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    return best;
  }

  function place(c: number) {
    cRef.current = c;
    const width = viewportRef.current?.clientWidth ?? 0;
    const ring = turnRef.current * COPIES;
    labelRefs.current.forEach((label, k) => {
      if (!label) return;
      const i = k % count;
      const copy = Math.floor(k / count);
      // Most of the ring lies to the right of the anchor, a little to the left.
      let d = (startsRef.current[i] + copy * turnRef.current - c) % ring;
      if (d < -ring * 0.3) d += ring;
      if (d >= ring * 0.7) d -= ring;
      label.style.transform = `translate3d(${ANCHOR + d}px, 0, 0)`;
      // Names leaving on the left fade out fast; to the right they dim a little.
      label.style.opacity = String(
        d < 0 ? Math.max(0, 1 + d / 48) : 1 - Math.min(d / Math.max(width - ANCHOR, 1), 1) * 0.5
      );
      label.dataset.current = String(Math.abs(d) < widthsRef.current[i] / 2);
    });
    // The line under the first place takes the width of the name over it.
    if (lineRef.current) lineRef.current.style.width = `${widthsRef.current[nearest(c)] ?? 0}px`;
  }

  function report(c: number) {
    const next = nearest(c);
    if (next !== reportedRef.current) {
      reportedRef.current = next;
      triggerTelegramImpact("light");
      onIndexChangeRef.current(next);
    }
  }

  function stop() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }

  function animateTo(target: number, velocity = 0) {
    stop();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      place(target);
      return;
    }
    let c = cRef.current;
    let v = velocity;
    let previous = performance.now();
    const started = previous;
    const step = (time: number) => {
      const dt = Math.min((time - previous) / 1000, 0.032);
      previous = time;
      v += ((target - c) * 220 - v * 30) * dt;
      c += v * dt;
      place(c);
      if ((Math.abs(target - c) < 0.3 && Math.abs(v) < 8) || time - started > 600) {
        place(target);
        frameRef.current = null;
        return;
      }
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  }

  // Lay the names out on the ring once their widths are known.
  useLayoutEffect(() => {
    const measure = () => {
      const widths = items.map((_, i) => labelRefs.current[i]?.offsetWidth ?? 0);
      const starts: number[] = [];
      let run = 0;
      widths.forEach((width) => {
        starts.push(run);
        run += width + GAP;
      });
      widthsRef.current = widths;
      startsRef.current = starts;
      turnRef.current = Math.max(run, 1);
      place(starts[reportedRef.current] ?? 0);
    };
    measure();
    void document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  useEffect(() => () => stop(), []);

  // A tap on a name (or a change from outside): turn the short way to it.
  useEffect(() => {
    if (index === reportedRef.current) return;
    reportedRef.current = index;
    const from = cRef.current;
    animateTo(from + shortWay((startsRef.current[index] ?? 0) - from));
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
      startC: cRef.current,
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
      if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
        drag.mode = "drag";
        swipedRef.current = true;
        try {
          viewportRef.current?.setPointerCapture(event.pointerId);
        } catch {
          // Capture is a nicety; the swipe works without it.
        }
      } else if (Math.abs(dy) > 8) {
        drag.mode = "other";
      }
    }
    if (drag.mode !== "drag") return;
    const now = performance.now();
    drag.velocityX = ((event.clientX - drag.lastX) / Math.max(now - drag.lastTime, 1)) * 1000;
    drag.lastX = event.clientX;
    drag.lastTime = now;
    const c = drag.startC - dx;
    place(c);
    report(c);
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.mode !== "drag") return;
    // A flick carries on a little before it settles on the nearest name; a finger
    // that stopped before lifting has no speed left.
    if (performance.now() - drag.lastTime > 60) drag.velocityX = 0;
    const projected = cRef.current - drag.velocityX * 0.18;
    const target = nearest(projected);
    const landing = projected + shortWay(startsRef.current[target] - projected);
    animateTo(landing, -drag.velocityX);
    report(landing);
  }

  const select = (i: number) => {
    if (i !== reportedRef.current) onIndexChangeRef.current(i);
  };

  return (
    <div
      ref={viewportRef}
      className="create-service-chips create-category-wheel"
      role="tablist"
      aria-label="Категории"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      // A swipe that ends on a name does not also count as a tap on it.
      onClickCapture={(event) => {
        if (!swipedRef.current) return;
        swipedRef.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {Array.from({ length: COPIES }, (_, copy) =>
        items.map((item, i) => {
          const k = copy * count + i;
          // The first turn is the real tab list; the other turns only fill the ring.
          const real = copy === 0;
          return (
            <button
              key={`${copy}-${item.id}`}
              ref={(element) => {
                labelRefs.current[k] = element;
              }}
              type="button"
              role={real ? "tab" : undefined}
              className="create-service-chip"
              data-testid={real ? `create-service-chip-${item.id}` : undefined}
              aria-selected={real ? i === index : undefined}
              aria-hidden={real ? undefined : true}
              tabIndex={real ? undefined : -1}
              onClick={() => select(i)}
            >
              {item.title}
            </button>
          );
        })
      )}
      <span ref={lineRef} className="create-category-wheel-line" aria-hidden="true" />
    </div>
  );
}
