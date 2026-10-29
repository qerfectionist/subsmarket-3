import type { ReactNode } from "react";
import { SystemSymbol } from "../SystemSymbol";
import { formatKzt } from "./createFamilyForm";

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

/** One row of a settings card: what it is with a hint under it, the control on the right. */
export function TermsRow({
  label,
  hint,
  error,
  children
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="create-terms-row">
      <div className="create-terms-row-copy">
        <strong>{label}</strong>
        {error ? <span className="create-terms-row-error">{error}</span> : hint ? <span>{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

/**
 * The total as one large number, the way banking apps take an amount: digits
 * only, grouped as they are typed, with ₸ after them.
 */
export function PriceHero({
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
    <label className="create-price-hero" data-invalid={Boolean(error) || undefined}>
      <span className="create-price-hero-label">{label}</span>
      <span className="create-price-hero-amount">
        <input
          data-testid="create-total-price-input"
          inputMode="numeric"
          type="text"
          placeholder="0"
          aria-invalid={Boolean(error) || undefined}
          value={shown}
          // The field is as wide as the number, so ₸ stays right after it.
          style={{ width: `${Math.max(shown.length, 1) + 0.4}ch` }}
          onChange={(event) => onChange(Number(event.target.value.replace(/\D/g, "")) || 0)}
        />
        <span aria-hidden="true">₸</span>
      </span>
      {error ? (
        <small className="field-error create-price-hero-error" role="alert" aria-live="polite">
          {error}
        </small>
      ) : null}
    </label>
  );
}

/** The seats as places: «Вы» first, then one per member. */
export function SeatStrip({ count }: { count: number }) {
  return (
    <div className="create-seat-strip" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} data-owner={i === 0 || undefined}>
          {i === 0 ? "Вы" : i}
        </span>
      ))}
    </div>
  );
}
