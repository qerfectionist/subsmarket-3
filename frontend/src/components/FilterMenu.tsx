import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { SystemSymbol } from "./SystemSymbol";
import { triggerTelegramSelection } from "../telegram";

export type FilterMenuOption = {
  value: string;
  label: string;
  count?: number;
  disabled?: boolean;
};

export type FilterMenuProps = {
  id: string;
  label: string;
  options: FilterMenuOption[];
  selectedValue: string;
  testIdPrefix?: string;
  align?: "right" | "left";
  onSelect: (value: string) => void;
  onClose?: () => void;
};

export function FilterMenu({
  id,
  label,
  options,
  selectedValue,
  testIdPrefix,
  align = "right",
  onSelect,
  onClose
}: FilterMenuProps) {
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
        transformOrigin: align === "left" ? "top left" : "top right"
      },
      {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.16,
        ease: "power2.out"
      }
    );
  }, [align]);

  useEffect(() => {
    if (!onClose) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !menuRef.current?.contains(target)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const handleSelect = (value: string) => {
    triggerTelegramSelection();
    onSelect(value);
  };

  return (
    <div
      ref={menuRef}
      id={id}
      className={`sm-market-filter-menu${align === "left" ? " sm-market-filter-menu-left" : ""}`}
      role="menu"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="menuitemradio"
          aria-checked={option.value === selectedValue}
          data-testid={testIdPrefix ? `${testIdPrefix}-${option.value}` : undefined}
          disabled={option.disabled}
          onClick={() => handleSelect(option.value)}
        >
          <span className="sm-market-filter-menu-label">{option.label}</span>
          {typeof option.count === "number" ? (
            <span className="sm-market-filter-menu-count">{option.count}</span>
          ) : null}
          {option.value === selectedValue ? (
            <SystemSymbol name="checkmark" size={16} />
          ) : null}
        </button>
      ))}
    </div>
  );
}
