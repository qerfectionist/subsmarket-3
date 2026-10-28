import { useState } from "react";
import { Button as AppButton, Input } from "../ui";
import type { FamilyJoinInfo, FamilyRequestCreate, JoinContactKind } from "../../types";

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const PHONE_RE = /^(\+?7|8)\d{10}$/;

const CONTACT_FIELDS: Record<
  JoinContactKind,
  { label: string; placeholder: string; helper: string; inputMode: "email" | "tel"; error: string }
> = {
  gmail: {
    label: "Ваш Gmail",
    placeholder: "name@gmail.com",
    helper: "На него владелец пришлёт приглашение в семью Google.",
    inputMode: "email",
    error: "Нужна почта вида name@gmail.com"
  },
  apple_id: {
    label: "Ваш Apple ID",
    placeholder: "name@icloud.com",
    helper: "Почта вашего Apple ID: на неё придёт приглашение в «Семейный доступ».",
    inputMode: "email",
    error: "Нужна почта вашего Apple ID"
  },
  email: {
    label: "Почта аккаунта",
    placeholder: "name@mail.com",
    helper: "На неё владелец пришлёт приглашение.",
    inputMode: "email",
    error: "Нужна почта вида name@mail.com"
  },
  phone: {
    label: "Ваш номер",
    placeholder: "+7 700 123 45 67",
    helper: "Этот номер владелец добавит в семейный тариф.",
    inputMode: "tel",
    error: "Нужно +7 и 10 цифр"
  }
};

function contactValid(kind: JoinContactKind, value: string) {
  const trimmed = value.trim();
  if (kind === "phone") return PHONE_RE.test(trimmed.replace(/[\s()-]/g, ""));
  return EMAIL_RE.test(trimmed);
}

/** The request: what the owner needs for the invite and the service rules. */
export function JoinRequestForm({
  join,
  busy,
  onSubmit
}: {
  join: FamilyJoinInfo | undefined;
  busy: boolean;
  onSubmit: (body: FamilyRequestCreate) => void;
}) {
  const [contact, setContact] = useState("");
  const [touched, setTouched] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const kind = join?.contact_kind ?? null;
  const field = kind ? CONTACT_FIELDS[kind] : null;
  const contactOk = !kind || contactValid(kind, contact);
  const ready = contactOk && (!join?.confirm || confirmed);

  return (
    <div className="join-request-form" data-testid="join-request-form">
      {join && join.rules.length > 0 ? (
        <div className="join-request-rules" data-testid="join-request-rules">
          <strong>Правила сервиса</strong>
          <ul>
            {join.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {kind && field ? (
        <div>
          <Input
            label={field.label}
            placeholder={field.placeholder}
            inputMode={field.inputMode}
            autoComplete={kind === "phone" ? "tel" : "email"}
            data-testid="join-contact-input"
            error={touched && !contactOk}
            value={contact}
            onBlur={() => setTouched(true)}
            onChange={(event) => setContact(event.target.value)}
          />
          {touched && !contactOk ? (
            <small className="field-error" role="alert">
              {field.error}
            </small>
          ) : (
            <small className="field-helper">
              {field.helper} Увидит только владелец этой семьи.
            </small>
          )}
        </div>
      ) : null}
      {join?.confirm ? (
        <label className="join-request-confirm">
          <input
            type="checkbox"
            data-testid="join-confirm-checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span>{join.confirm}</span>
        </label>
      ) : null}
      <AppButton
        type="button"
        data-testid="detail-send-request-button"
        disabled={busy || !ready}
        onClick={() => onSubmit({ join_contact: kind ? contact.trim() : null, rules_confirmed: confirmed })}
      >
        Отправить заявку
      </AppButton>
      <small className="field-helper">Платить сейчас не нужно: сначала владелец добавит вас.</small>
    </div>
  );
}
