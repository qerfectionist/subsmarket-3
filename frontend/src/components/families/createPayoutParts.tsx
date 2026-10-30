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
 * The number is kept as «+7 700 123 45 67». The field fixes «+7 7» (every
 * Kazakh mobile starts with it) and shows only the nine digits after it.
 */
export function phoneRemainder(stored: string) {
  const digits = stored.replace(/\D/g, "");
  return formatGroups(digits.slice(2), [2, 3, 2, 2]);
}

function formatGroups(digits: string, sizes: number[]) {
  const parts: string[] = [];
  let at = 0;
  for (const size of sizes) {
    if (at >= digits.length) break;
    parts.push(digits.slice(at, at + size));
    at += size;
  }
  return parts.join(" ");
}

/** Turns what was typed or pasted in the field into the stored number; «» when nothing is left. */
export function formatPhoneInput(raw: string, shown = "") {
  let digits = raw.replace(/\D/g, "");
  // A paste may bring the whole number: +7 7XX…, 8 7XX… or 7XX….
  if (raw.trim().startsWith("+") || digits.length >= 11) digits = digits.slice(1);
  // Ten digits after a different text is a pasted national number; after the same nine it is just one digit too many.
  if (digits.length === 10 && digits.startsWith("7") && digits.slice(0, 9) !== shown.replace(/\D/g, "")) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 9);
  if (digits === "") return "";
  return `+7 ${formatGroups(`7${digits}`, [3, 3, 2, 2])}`;
}
