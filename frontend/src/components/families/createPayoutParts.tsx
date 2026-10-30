import { useState, type ReactNode } from "react";
import { triggerTelegramSelection } from "../../telegram";

/** A field as its own plate: the small label inside on top, the value under it. */
export function PayoutField({
  label,
  htmlFor,
  invalid,
  locked,
  children
}: {
  label: ReactNode;
  htmlFor: string;
  invalid?: boolean;
  /** Not its turn yet: shown, but greyed out and not editable. */
  locked?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="create-payout-field" data-invalid={invalid || undefined} data-locked={locked || undefined}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

/**
 * How far the person has been led through «Выплата»: 0 bank only, 1 + phone,
 * 2 + name, 3 + chat. `chat` is true once they picked a chat themselves.
 */
export type PayoutProgress = { stage: 0 | 1 | 2 | 3; chat: boolean };
export const PAYOUT_START: PayoutProgress = { stage: 0, chat: false };

/** The last step can be sent only when every block has been walked through. */
export const payoutDone = (progress: PayoutProgress) => progress.stage === 3 && progress.chat;

/** One choice out of a few short names, as a segmented control; `null` = nothing picked yet. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  testId,
  locked,
  onChange
}: {
  label: string;
  options: { value: T; label: string; icon?: string }[];
  value: T | null;
  testId: (value: T) => string;
  /** Not its turn yet: shown, but greyed out and not pressable. */
  locked?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div className="create-segment" role="radiogroup" aria-label={label} data-empty={value === null || undefined} data-locked={locked || undefined}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          disabled={locked}
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

/** «(!) Зачем …»: a quiet question that opens its answer in an InfoPanel. */
export function InfoToggle({
  open,
  controls,
  testId,
  small,
  children,
  onToggle
}: {
  open: boolean;
  controls: string;
  testId: string;
  /** Sized to sit in a 12px plate label instead of a 15px caption. */
  small?: boolean;
  children: ReactNode;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="create-info-toggle"
      data-size={small ? "small" : undefined}
      data-testid={testId}
      aria-expanded={open}
      aria-controls={controls}
      // Keeps the keyboard and focus where they are: a question is not leaving the field.
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        // Inside a field label: open the answer, do not focus the field.
        event.preventDefault();
        onToggle();
      }}
    >
      <span className="create-info-mark" aria-hidden="true">
        !
      </span>
      {children}
    </button>
  );
}

/**
 * The answer to an InfoToggle. Always rendered so it unfolds and folds
 * smoothly; closed, it takes no room and no focus.
 */
export function InfoPanel({
  open,
  id,
  testId,
  children
}: {
  open: boolean;
  id: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      className="create-info-panel"
      data-testid={`${testId}-panel`}
      data-open={open || undefined}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="create-info-clip">
        <p className="create-info-text" data-testid={`${testId}-text`}>
          {children}
        </p>
      </div>
    </div>
  );
}

/** The chat caption with «(!) Зачем нужен чат» right after it, the answer under it. */
export function ChatInfo({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="create-chat-head">
        {children}
        <InfoToggle
          open={open}
          controls="create-chat-info-text"
          testId="create-chat-info"
          onToggle={() => setOpen((current) => !current)}
        >
          Зачем нужен чат
        </InfoToggle>
      </div>
      <InfoPanel open={open} id="create-chat-info-text" testId="create-chat-info">
        В чате удобно решать вопросы: участники и вы на связи в одном месте. Скоро в нём появится бот: он будет
        напоминать об оплате, отвечать на вопросы о семье и сможет сразу проверить чек.
      </InfoPanel>
    </div>
  );
}
