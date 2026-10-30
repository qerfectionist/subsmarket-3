import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { CreateFamilyPreview, type PreviewOwner } from "./CreateFamilyPreview";
import { bankLabels } from "../../labels";
import type { FamilyCreate, FamilyService } from "../../types";
import type { FieldErrors } from "./createFamilyForm";
import {
  CaptionInfo,
  formatPhoneInput,
  PayoutField,
  Segmented,
  type PayoutProgress
} from "./createPayoutParts";

/** The banks a new family can take payments to; Jusan is no longer offered. */
const BANKS: FamilyCreate["payment_bank"][] = ["kaspi", "halyk", "freedom"];
const bankLogo = (bank: string) => `${import.meta.env.BASE_URL}brand-assets/banks/${bank}.svg`;
const chatLogo = (kind: string) => `${import.meta.env.BASE_URL}brand-assets/chats/${kind}.svg`;
/** «none» is a family without a group chat: the form then sends no chat kind at all. */
type ChatChoice = NonNullable<FamilyCreate["chat_kind"]> | "none";
const CHAT_OPTIONS: { value: ChatChoice; label: string; icon?: string }[] = [
  { value: "telegram", label: "Telegram", icon: chatLogo("telegram") },
  { value: "whatsapp", label: "WhatsApp", icon: chatLogo("whatsapp") },
  { value: "none", label: "Без чата" }
];

/** The ten digits after +7, grouped as they are typed: 700 123 45 67. */
const PHONE_MASK = "___ ___ __ __";

type Touched = Partial<Record<"payment_phone" | "payment_recipient_name", boolean>>;

/**
 * Step 3: where members send money, one question at a time. The family it is
 * for stays on top; the bank, phone, name and chat are all in view, but each
 * stays greyed out until the one before it is done, so nobody types a number
 * before knowing where it goes.
 */
export function CreateFamilyPayoutStep({
  form,
  errors,
  service,
  owner,
  showAllErrors,
  progress,
  onProgress,
  onEditTerms,
  onChangeForm
}: {
  form: FamilyCreate;
  errors: FieldErrors;
  service: FamilyService;
  owner: PreviewOwner;
  showAllErrors: boolean;
  progress: PayoutProgress;
  onProgress: Dispatch<SetStateAction<PayoutProgress>>;
  onEditTerms: () => void;
  onChangeForm: Dispatch<SetStateAction<FamilyCreate>>;
}) {
  const [touched, setTouched] = useState<Touched>({});
  const shown = (key: keyof Touched) => (showAllErrors || touched[key] ? errors[key] : undefined);
  const phoneError = shown("payment_phone");
  // The stored number is «+7 700 123 45 67»; the field shows what follows the fixed +7.
  const phoneShown = form.payment_phone.replace(/^\+7\s?/, "");
  const nameError = shown("payment_recipient_name");
  const recipientErrors = [phoneError, nameError].filter(Boolean) as string[];
  const chat: ChatChoice = form.chat_kind ?? "none";
  const { stage } = progress;
  const reveal = (to: PayoutProgress["stage"]) =>
    onProgress((current) => (current.stage < to ? { ...current, stage: to } : current));

  // Each new block is brought into view; the field that now needs typing gets the keyboard.
  const phoneRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const seen = useRef({ stage, chat: progress.chat });
  useEffect(() => {
    const before = seen.current;
    seen.current = { stage, chat: progress.chat };
    if (before.stage === stage && before.chat === progress.chat) return;
    if (stage === 1 && before.stage === 0) phoneRef.current?.focus({ preventScroll: true });
    if (stage === 2 && before.stage === 1) nameRef.current?.focus({ preventScroll: true });
    // After the chat is picked its note grows, so the last block is brought into view again.
    // After the next paint, so the new block is laid out and the focus above cannot cancel the scroll.
    const frame = requestAnimationFrame(() =>
      document.querySelector(`[data-scroll="${stage}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    );
    return () => cancelAnimationFrame(frame);
  }, [stage, progress.chat]);

  return (
    <div className="create-step-body create-payout" data-create-step="payout">
      {/* The card stays pinned on top while the questions scroll under it. */}
      <section
        className="create-payout-block create-payout-pinned"
        aria-label="Так увидят в Маркете"
        data-testid="create-terms-summary"
      >
        <div className="create-payout-head">
          <span className="create-terms-caption">Так увидят в Маркете</span>
          <button type="button" className="create-payout-edit" data-testid="create-edit-terms" onClick={onEditTerms}>
            Изменить
          </button>
        </div>
        <CreateFamilyPreview form={form} service={service} owner={owner} />
        <small className="create-payout-note">После создания сервис и места не поменять.</small>
      </section>

      <section className="create-payout-block" aria-label="Банк">
        {/* While it is the open question, the caption says what to do. */}
        <span className="create-terms-caption">{stage === 0 ? "Выберите банк" : "Банк"}</span>
        <Segmented
          label="Банк"
          options={BANKS.map((bank) => ({ value: bank, label: bankLabels[bank], icon: bankLogo(bank) }))}
          value={stage >= 1 ? form.payment_bank : null}
          testId={(bank) => `create-bank-${bank}`}
          onChange={(bank) => {
            onChangeForm((current) => ({ ...current, payment_bank: bank }));
            reveal(1);
          }}
        />
        <small className="create-payout-note">Сюда участники будут переводить оплату.</small>
      </section>

      <section className="create-payout-block" aria-label="Получатель" data-scroll="1">
        <CaptionInfo
          question="Зачем указывать имя"
          testId="create-name-info"
          answer="Имя необязательно, но рекомендуем. При переводе банк покажет имя получателя, и участник сверит его с этим: так он будет уверен, что платит именно вам."
        >
          <span className="create-terms-caption" data-locked={stage < 1 || undefined}>
            {stage === 1 ? `Введите номер ${bankLabels[form.payment_bank]}` : "Получатель"}
          </span>
        </CaptionInfo>
        <div className="create-payout-fields">
          <PayoutField label="Телефон" htmlFor="create-payment-phone" invalid={Boolean(phoneError)} locked={stage < 1}>
            {/* The country code is fixed: +7 stays in front, only the ten digits are typed. */}
            <div className="create-payout-phone">
              <span aria-hidden="true">+7</span>
              {/* The digits still to type show as a faint mask right after the typed ones. */}
              <span className="create-payout-phone-box">
                <input
                  ref={phoneRef}
                  id="create-payment-phone"
                  required
                  disabled={stage < 1}
                  placeholder="700 123 45 67"
                  data-testid="create-payment-phone-input"
                  inputMode="tel"
                  autoComplete="tel-national"
                  enterKeyHint="next"
                  aria-invalid={Boolean(phoneError) || undefined}
                  value={phoneShown}
                  onBlur={() => setTouched((current) => ({ ...current, payment_phone: true }))}
                  onChange={(event) => {
                    const next = formatPhoneInput(event.target.value, phoneShown);
                    onChangeForm((current) => ({ ...current, payment_phone: next }));
                    // Ten digits typed: the name is next.
                    if (next.replace(/\D/g, "").length === 11) reveal(2);
                  }}
                />
                {phoneShown ? (
                  <span className="create-payout-phone-mask" aria-hidden="true">
                    <span>{phoneShown}</span>
                    {PHONE_MASK.slice(phoneShown.length)}
                  </span>
                ) : null}
              </span>
            </div>
          </PayoutField>
          <PayoutField
            label="Имя"
            htmlFor="create-recipient-name"
            invalid={Boolean(nameError)}
            locked={stage < 2}
          >
            <input
              ref={nameRef}
              id="create-recipient-name"
              disabled={stage < 2}
              placeholder="Кайрат Н."
              data-testid="create-recipient-name-input"
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="next"
              onKeyDown={(event) => {
                // Enter moves on to the chat instead of sending the form.
                if (event.key !== "Enter") return;
                event.preventDefault();
                reveal(3);
              }}
              maxLength={40}
              aria-invalid={Boolean(nameError) || undefined}
              value={form.payment_recipient_name ?? ""}
              onBlur={() => {
                setTouched((current) => ({ ...current, payment_recipient_name: true }));
                // Leaving the name, filled or not, wakes the chat: the name is optional.
                reveal(3);
              }}
              onChange={(event) =>
                onChangeForm((current) => ({ ...current, payment_recipient_name: event.target.value }))
              }
            />
          </PayoutField>
        </div>
        {recipientErrors.length > 0 ? (
          <small className="create-payout-note field-error" role="alert" aria-live="polite">
            {recipientErrors.map((error) => (
              <span key={error}>{error}</span>
            ))}
          </small>
        ) : (
          <small className="create-payout-note">
            Номер и имя увидят только участники, которым вы подтвердили доступ.
          </small>
        )}
      </section>

      <section
        className="create-payout-block"
        aria-label="Чат семьи"
        data-scroll="3"
        // The name can be skipped: a tap on the waiting chat wakes it.
        onPointerDown={() => {
          if (stage === 2) reveal(3);
        }}
      >
        <CaptionInfo
          question="Зачем нужен чат"
          testId="create-chat-info"
          answer="В чате удобно решать вопросы: участники и вы на связи в одном месте. Скоро в нём появится бот: он будет напоминать об оплате, отвечать на вопросы о семье и сможет сразу проверить чек."
        >
          <span className="create-terms-caption" data-locked={stage < 3 || undefined}>
            {stage >= 3 && !progress.chat ? "Выберите чат семьи" : "Чат семьи"}
          </span>
        </CaptionInfo>
        <Segmented
          label="Чат семьи"
          options={CHAT_OPTIONS}
          value={progress.chat ? chat : null}
          locked={stage < 3}
          testId={(kind) => `create-chat-${kind}`}
          onChange={(kind) => {
            onChangeForm((current) => ({ ...current, chat_kind: kind === "none" ? null : kind }));
            onProgress((current) => ({ ...current, chat: true }));
          }}
        />
        <small className="create-payout-note">
          {!progress.chat
            ? "Где будет общаться семья."
            : chat === "telegram"
              ? "После создания откроем группу с ботом, останется нажать «Создать»."
              : chat === "whatsapp"
                ? "После создания поможем сделать группу в WhatsApp за три шага."
                : "Семья будет без общего чата: участникам и вам придётся связываться напрямую."}
        </small>
      </section>
    </div>
  );
}
