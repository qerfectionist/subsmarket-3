import type { RefObject } from "react";
import { SystemSymbol } from "../SystemSymbol";

/** The market's search field: magnifier, input, and a clear button once there is text. */
export function MarketSearchField({
  value,
  onChange,
  onEnter,
  inputRef,
  ariaLabel,
  placeholder,
  testId
}: {
  value: string;
  onChange: (value: string) => void;
  onEnter?: (input: HTMLInputElement) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  ariaLabel: string;
  placeholder: string;
  testId: string;
}) {
  return (
    <label className="sm-market-search">
      <SystemSymbol name="magnifyingglass" size={20} />
      <input
        ref={inputRef}
        type="search"
        aria-label={ariaLabel}
        data-testid={testId}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onEnter?.(event.currentTarget);
        }}
      />
      {value ? (
        <button
          type="button"
          className="sm-market-search-clear"
          aria-label="Очистить поиск"
          onClick={() => onChange("")}
        >
          <SystemSymbol name="xmark" size={18} />
        </button>
      ) : null}
    </label>
  );
}
