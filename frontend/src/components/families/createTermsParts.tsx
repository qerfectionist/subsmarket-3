import type { ReactNode } from "react";
import { SystemSymbol } from "../SystemSymbol";
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
        <SystemSymbol name="minus" size={16} />
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
        <SystemSymbol name="plus" size={16} />
      </button>
    </div>
  );
}

/** One row of the settings group: the label (and an error if any) on the left, the control on the right. */
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
 * The full price as the one large number on the screen: grouped digits with ₸
 * after them. A tap opens the phone's number keyboard.
 */
export function AmountField({
  value,
  label,
  hint,
  error,
  onChange
}: {
  value: number;
  label: string;
  hint: string;
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
          inputMode="numeric"
          enterKeyHint="done"
          type="text"
          placeholder="0"
          aria-invalid={Boolean(error) || undefined}
          value={shown}
          // As wide as the number, so ₸ stays right after it and the pair stays centred.
          style={{ width: `${Math.max(shown.length, 1) + 0.15}ch` }}
          onChange={(event) => onChange(Number(event.target.value.replace(/\D/g, "").slice(0, MAX_DIGITS)) || 0)}
        />
        <span className="create-amount-currency" aria-hidden="true">
          ₸
        </span>
      </span>
      {error ? (
        <small className="field-error create-amount-note" role="alert" aria-live="polite">
          {error}
        </small>
      ) : (
        <small className="create-amount-note">{hint}</small>
      )}
    </label>
  );
}
