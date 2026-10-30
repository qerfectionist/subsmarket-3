import type { ReactNode } from "react";
import { triggerTelegramSelection } from "../../telegram";

/** A row of the recipient group: the name on the left, the field filling the rest. */
export function PayoutRow({
  label,
  htmlFor,
  invalid,
  children
}: {
  label: string;
  htmlFor: string;
  invalid?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="create-terms-row create-payout-row" data-invalid={invalid || undefined}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

/** One choice out of a few short names, as a segmented control. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  testId,
  onChange
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  testId: (value: T) => string;
  onChange: (value: T) => void;
}) {
  return (
    <div className="create-segment" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          data-testid={testId(option.value)}
          className="create-segment-option"
          onClick={() => {
            if (option.value === value) return;
            triggerTelegramSelection();
            onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Keeps a Kazakh number readable while it is typed: +7 700 123 45 67. A leading
 * 8 or 7 is the country code; anything else starts the number itself.
 */
export function formatPhoneInput(raw: string, previous: string) {
  let digits = raw.replace(/\D/g, "");
  // A backspace over a space or bracket would change nothing: take the digit before it.
  if (raw.length < previous.length && digits === previous.replace(/\D/g, "")) digits = digits.slice(0, -1);
  if (digits === "") return "";
  const rest = (/^[78]/.test(digits) ? digits.slice(1) : digits).slice(0, 10);
  const parts = [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6, 8), rest.slice(8, 10)].filter(Boolean);
  return ["+7", ...parts].join(" ");
}
