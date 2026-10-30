import type { ReactNode } from "react";
import { triggerTelegramSelection } from "../../telegram";

/** A field as its own plate: the small label inside on top, the value under it. */
export function PayoutField({
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
    <div className="create-payout-field" data-invalid={invalid || undefined}>
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
  options: { value: T; label: string; icon?: string }[];
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
          {option.icon ? <img src={option.icon} alt="" aria-hidden="true" draggable={false} /> : null}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Keeps a Kazakh number readable while it is typed: +7 700 123 45 67. The
 * country code is dropped when the text starts with «+» (our own format or a
 * paste), with 8, or has 11 digits; a bare 10-digit number is the number itself.
 */
export function formatPhoneInput(raw: string, previous: string) {
  let digits = raw.replace(/\D/g, "");
  // A backspace over a space would change nothing: take the digit before it.
  if (raw.length < previous.length && digits === previous.replace(/\D/g, "")) digits = digits.slice(0, -1);
  const hasCode =
    raw.trim().startsWith("+") || digits.startsWith("8") || (digits.length >= 11 && digits.startsWith("7"));
  const rest = (hasCode ? digits.slice(1) : digits).slice(0, 10);
  if (rest === "") return "";
  const parts = [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6, 8), rest.slice(8, 10)].filter(Boolean);
  return ["+7", ...parts].join(" ");
}
