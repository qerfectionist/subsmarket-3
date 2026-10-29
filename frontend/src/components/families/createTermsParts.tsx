import type { ReactNode } from "react";
import { SystemSymbol } from "../SystemSymbol";
import { triggerTelegramSelection } from "../../telegram";
import { formatKzt } from "./createFamilyForm";

/** Up to 9 999 999 ₸: more digits than any family subscription costs. */
const MAX_DIGITS = 7;

/** A compact − value + control for a row; keeps the test ids of the old stepper. */
export function MiniStepper({
  id,
  label,
  value,
  min,
  max,
  testId,
  onChange
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  testId: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="create-mini-stepper">
      <button
        type="button"
        aria-label={`${label}: меньше`}
        data-testid={`${testId}-decrease`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <SystemSymbol name="minus" size={18} />
      </button>
      <input
        id={id}
        aria-label={label}
        min={min}
        max={max}
        data-testid={`${testId}-input`}
        inputMode="numeric"
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <button
        type="button"
        aria-label={`${label}: больше`}
        data-testid={`${testId}-increase`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <SystemSymbol name="plus" size={18} />
      </button>
    </div>
  );
}

/** One row of the settings group: what it is (and an error if any) on the left, the control or value on the right. */
export function TermsRow({ label, error, children }: { label: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div className="create-terms-row">
      <div className="create-terms-row-copy">
        <strong>{label}</strong>
        {error ? <span className="create-terms-row-error">{error}</span> : null}
      </div>
      {children}
    </div>
  );
}

/**
 * The total as the one large number on the screen, as banking apps show an
 * amount being typed: grouped digits, ₸ after them and a blinking caret. The
 * field asks for no system keyboard (the keypad below types into it), but
 * still takes typing from a hardware keyboard.
 */
export function AmountDisplay({
  value,
  label,
  error,
  onChange
}: {
  value: number;
  label: string;
  error?: string;
  onChange: (value: number) => void;
}) {
  const shown = value > 0 ? formatKzt(value).replace(/\s*₸$/, "") : "";
  return (
    <label className="create-amount" data-invalid={Boolean(error) || undefined}>
      <span className="create-amount-label">{label}</span>
      <span className="create-amount-value">
        <input
          data-testid="create-total-price-input"
          inputMode="none"
          type="text"
          placeholder="0"
          aria-invalid={Boolean(error) || undefined}
          value={shown}
          // As wide as the number, so the caret and ₸ stay right after it.
          style={{ width: `${Math.max(shown.length, 1) + 0.2}ch` }}
          onChange={(event) => onChange(Number(event.target.value.replace(/\D/g, "").slice(0, MAX_DIGITS)) || 0)}
        />
        <span className="create-amount-caret" aria-hidden="true" />
        <span className="create-amount-currency" aria-hidden="true">
          ₸
        </span>
      </span>
      {error ? (
        <small className="field-error create-amount-error" role="alert" aria-live="polite">
          {error}
        </small>
      ) : null}
    </label>
  );
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"] as const;

/** The digits for the amount, on the screen itself, so no system keyboard covers the rows. */
export function AmountKeypad({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  function press(key: (typeof KEYS)[number]) {
    const digits = value > 0 ? String(value) : "";
    const next = key === "back" ? digits.slice(0, -1) : (digits + key).slice(0, MAX_DIGITS);
    triggerTelegramSelection();
    onChange(Number(next) || 0);
  }
  return (
    <div className="create-keypad" role="group" aria-label="Цифры цены">
      {KEYS.map((key) =>
        key === "" ? (
          <span key="blank" aria-hidden="true" />
        ) : (
          <button
            key={key}
            type="button"
            data-testid={`create-keypad-${key}`}
            aria-label={key === "back" ? "Стереть цифру" : key}
            onClick={() => press(key)}
          >
            {key === "back" ? <SystemSymbol name="delete.left" size={24} /> : key}
          </button>
        )
      )}
    </div>
  );
}
