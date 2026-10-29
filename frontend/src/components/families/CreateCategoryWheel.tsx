import { useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { triggerTelegramImpact } from "../../telegram";

const GAP = 26;

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
 * Step 1 categories as a wheel: the names sit on a ring with the chosen one in
 * the middle. A swipe left turns the ring, so «Популярное» goes off to the left
 * and «Видео» comes to the middle; after the last name the first comes round
 * again, and a swipe right brings it back from the left. A tap on a name turns
 * the ring the short way to it. Names further from the middle fade and shrink.
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
  const labelRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lineRef = useRef<HTMLSpanElement | null>(null);
  // Where each name's centre sits on the ring, and the ring's length, in px.
  const centersRef = useRef<number[]>([]);
  const widthsRef = useRef<number[]>([]);
  const ringRef = useRef(1);
  // The point of the ring under the middle of the screen.
  const cRef = useRef(0);
  const dragRef = useRef<Drag | null>(null);
  const frameRef = useRef<number | null>(null);
  const swipedRef = useRef(false);
  const reportedRef = useRef(index);
  const onIndexChangeRef = useRef(onIndexChange);
  onIndexChangeRef.current = onIndexChange;

  const wrap = (value: number) => {
    const ring = ringRef.current;
    let d = value % ring;
    if (d < -ring / 2) d += ring;
    if (d >= ring / 2) d -= ring;
    return d;
  };

  function nearest(c: number) {
    let best = 0;
    let bestDistance = Infinity;
    centersRef.current.forEach((center, i) => {
      const distance = Math.abs(wrap(center - c));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    return best;
  }

  function place(c: number) {
    cRef.current = c;
    const half = (viewportRef.current?.clientWidth ?? 0) / 2;
    labelRefs.current.forEach((label, i) => {
      if (!label) return;
      const x = wrap(centersRef.current[i] - c);
      const far = Math.min(Math.abs(x) / Math.max(half, 1), 1);
      label.style.transform = `translate3d(${half + x - widthsRef.current[i] / 2}px, 0, 0) scale(${1 - far * 0.12})`;
      // Names dim towards the edges and are gone at them, where the ring joins up.
      label.style.opacity = String(far > 0.8 ? (1 - far) * 2.4 : 1 - far * 0.65);
    });
    // The line under the middle takes the width of the name over it.
    const active = nearest(c);
    if (lineRef.current) lineRef.current.style.width = `${widthsRef.current[active] ?? 0}px`;
  }

  function report(c: number) {
    const next = nearest(c);
    labelRefs.current.forEach((label, i) => label?.setAttribute("aria-selected", String(i === next)));
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
      const widths = labelRefs.current.map((label) => label?.offsetWidth ?? 0);
      const centers: number[] = [];
      let run = 0;
      widths.forEach((width) => {
        centers.push(run + width / 2);
        run += width + GAP;
      });
      widthsRef.current = widths;
      centersRef.current = centers;
      ringRef.current = Math.max(run, 1);
      place(centers[reportedRef.current] ?? 0);
    };
    measure();
    void document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  useEffect(() => () => stop(), []);

  // The list below asked for a category (or it changed from outside): turn to it.
  useEffect(() => {
    if (index === reportedRef.current) return;
    reportedRef.current = index;
    labelRefs.current.forEach((label, i) => label?.setAttribute("aria-selected", String(i === index)));
    const from = cRef.current;
    animateTo(from + wrap((centersRef.current[index] ?? 0) - from));
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
    const end = cRef.current + wrap(centersRef.current[target] - cRef.current);
    const landing = projected + wrap(end - projected);
    animateTo(landing, -drag.velocityX);
    report(landing);
  }

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
      {items.map((item, i) => (
        <button
          key={item.id}
          ref={(element) => {
            labelRefs.current[i] = element;
          }}
          type="button"
          role="tab"
          className="create-service-chip"
          data-testid={`create-service-chip-${item.id}`}
          aria-selected={i === index}
          onClick={() => {
            if (i === reportedRef.current) return;
            onIndexChangeRef.current(i);
          }}
        >
          {item.title}
        </button>
      ))}
      <span ref={lineRef} className="create-category-wheel-line" aria-hidden="true" />
    </div>
  );
}
