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

/**
 * The chat caption with «(!) Зачем нужен чат» right after it; a tap opens a
 * short text on what the chat is for, under the caption.
 */
export function ChatInfo({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="create-chat-info">
      <div className="create-chat-head">
        {children}
        <button
          type="button"
          className="create-chat-info-toggle"
          data-testid="create-chat-info"
          aria-expanded={open}
          aria-controls="create-chat-info-text"
          onClick={() => setOpen((current) => !current)}
        >
          <span className="create-chat-info-mark" aria-hidden="true">
            !
          </span>
          Зачем нужен чат
        </button>
      </div>
      {/* Always rendered so it can unfold and fold smoothly; closed, it takes no room and no focus. */}
      <div
        id="create-chat-info-text"
        className="create-chat-info-panel"
        data-testid="create-chat-info-panel"
        data-open={open || undefined}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="create-chat-info-clip">
          <p className="create-chat-info-text" data-testid="create-chat-info-text">
            В чате удобно решать вопросы: участники и вы на связи в одном месте. Скоро в нём появится бот: он будет
            напоминать об оплате, отвечать на вопросы о семье и сможет сразу проверить чек.
          </p>
        </div>
      </div>
    </div>
  );
}
