import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";

export type CategoryTabsHandle = {
  /** Moves the line under the tabs to a page position, 1.5 being halfway between the second and third. */
  move: (position: number) => void;
};

/**
 * The tabs over the category pages: a row that scrolls sideways when it is
 * wider than the screen, with one line under it that follows the pages as they
 * are swiped, so it slides and stretches from one name to the next.
 */
export const CreateCategoryTabs = forwardRef<
  CategoryTabsHandle,
  { items: { id: string; title: string }[]; index: number; onSelect: (index: number) => void }
>(function CreateCategoryTabs({ items, index, onSelect }, ref) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lineRef = useRef<HTMLSpanElement | null>(null);
  const positionRef = useRef(index);

  function move(position: number) {
    positionRef.current = position;
    const tabs = tabRefs.current;
    const last = tabs.length - 1;
    const at = Math.min(Math.max(position, 0), last);
    const from = Math.floor(at);
    const to = Math.min(from + 1, last);
    const t = at - from;
    const a = tabs[from];
    const b = tabs[to];
    if (!a || !b || !lineRef.current) return;
    const left = a.offsetLeft + (b.offsetLeft - a.offsetLeft) * t;
    const width = a.offsetWidth + (b.offsetWidth - a.offsetWidth) * t;
    lineRef.current.style.transform = `translate3d(${left}px, 0, 0)`;
    lineRef.current.style.width = `${width}px`;
  }

  useImperativeHandle(ref, () => ({ move }));

  // The line starts under the chosen tab, and finds it again once fonts load.
  useLayoutEffect(() => {
    move(positionRef.current);
    void document.fonts?.ready.then(() => move(positionRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // The chosen tab comes first in view when the row is wider than the screen.
  useEffect(() => {
    const row = rowRef.current;
    const tab = tabRefs.current[index];
    if (!row || !tab) return;
    row.scrollTo({ left: Math.max(tab.offsetLeft - 16, 0), behavior: "smooth" });
  }, [index]);

  return (
    <div ref={rowRef} className="create-service-chips create-category-tabs" role="tablist" aria-label="Категории">
      {items.map((item, i) => (
        <button
          key={item.id}
          ref={(element) => {
            tabRefs.current[i] = element;
          }}
          type="button"
          role="tab"
          className="create-service-chip"
          data-testid={`create-service-chip-${item.id}`}
          aria-selected={i === index}
          onClick={() => onSelect(i)}
        >
          {item.title}
        </button>
      ))}
      <span ref={lineRef} className="create-category-tabs-line" aria-hidden="true" />
    </div>
  );
});
