import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { SystemSymbol } from "../SystemSymbol";
import { triggerTelegramSelection } from "../../telegram";
import type { FilterMenuOption } from "./types";

export function MarketFilterMenu({
  id,
  label,
  options,
  selectedValue,
  testIdPrefix,
  onSelect
}: {
  id: string;
  label: string;
  options: FilterMenuOption[];
  selectedValue: string;
  testIdPrefix: string;
  onSelect: (value: string) => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    gsap.fromTo(
      el,
      {
        opacity: 0,
        scale: 0.95,
        y: -4,
        transformOrigin: "top right"
      },
      {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.16,
        ease: "power2.out"
      }
    );
  }, []);

  const handleSelect = (value: string) => {
    triggerTelegramSelection();
    onSelect(value);
  };

  return (
    <div ref={menuRef} id={id} className="sm-market-filter-menu" role="menu" aria-label={label}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="menuitemradio"
          aria-checked={option.value === selectedValue}
          data-testid={`${testIdPrefix}-${option.value}`}
          disabled={option.disabled}
          onClick={() => handleSelect(option.value)}
        >
          <span className="sm-market-filter-menu-label">{option.label}</span>
          {typeof option.count === "number" ? (
            <span className="sm-market-filter-menu-count">{option.count}</span>
          ) : null}
          {option.value === selectedValue ? <SystemSymbol name="checkmark" size={16} /> : null}
        </button>
      ))}
    </div>
  );
}
