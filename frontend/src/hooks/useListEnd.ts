import { useCallback, useEffect, useState, type RefObject } from "react";

/**
 * For a «Наверх» button at the end of a list that runs on under the bottom menu:
 * `reached` turns true once only the last two rows are left, and `offset` is the
 * distance from the list wrapper's bottom that centres a 40px button between the
 * last row and the menu. Call `check` from the list's onScroll.
 */
export function useListEnd(containerRef: RefObject<HTMLElement | null>, rowSelector: string, itemCount: number) {
  const [reached, setReached] = useState(false);
  const [offset, setOffset] = useState<number | null>(null);
  const check = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rows = Array.from(container.querySelectorAll<HTMLElement>(rowSelector));
    if (rows.length < 3 || container.scrollTop <= 0) {
      setReached(false);
      return;
    }
    // The first row still showing at the top: the end is when it is the second to last.
    const box = container.getBoundingClientRect();
    const first = rows.findIndex((row) => row.getBoundingClientRect().bottom > box.top + 8);
    const atEnd = first >= rows.length - 2;
    setReached(atEnd);
    if (!atEnd) return;
    const dock = document.querySelector(".subs-dock");
    const visibleBottom = Math.min(box.bottom, dock ? dock.getBoundingClientRect().top : Infinity);
    const centre = (rows[rows.length - 1].getBoundingClientRect().bottom + visibleBottom) / 2;
    const wrapBottom = (container.parentElement ?? container).getBoundingClientRect().bottom;
    setOffset(Math.round(wrapBottom - centre - 20));
  }, [containerRef, rowSelector]);
  useEffect(() => {
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [check, itemCount]);
  return { reached, offset, check };
}
