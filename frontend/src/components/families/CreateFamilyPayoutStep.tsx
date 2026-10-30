import { useState, type Dispatch, type SetStateAction } from "react";
import { CreateFamilyPreview, type PreviewOwner } from "./CreateFamilyPreview";
import { bankLabels } from "../../labels";
import type { FamilyCreate, FamilyService } from "../../types";
import type { FieldErrors } from "./createFamilyForm";
import { formatPhoneInput, PayoutField, Segmented } from "./createPayoutParts";

/** The banks a new family can take payments to; Jusan is no longer offered. */
const BANKS: FamilyCreate["payment_bank"][] = ["kaspi", "halyk", "freedom"];
const bankLogo = (bank: string) => `${import.meta.env.BASE_URL}brand-assets/banks/${bank}.svg`;
const chatLogo = (kind: string) => `${import.meta.env.BASE_URL}brand-assets/chats/${kind}.svg`;
const CHAT_OPTIONS: { value: NonNullable<FamilyCreate["chat_kind"]>; label: string; icon: string }[] = [
  { value: "telegram", label: "Telegram", icon: chatLogo("telegram") },
  { value: "whatsapp", label: "WhatsApp", icon: chatLogo("whatsapp") }
];

type Touched = Partial<Record<"payment_phone" | "payment_recipient_name", boolean>>;

/**
 * Step 3: where members send money. The family it is for on top, then the
 * bank, the recipient as two field plates and the chat; each
 * block has its caption above and one short note below, as on step 2.
 */
export function CreateFamilyPayoutStep({
  form,
  errors,
  service,
  owner,
  showAllErrors,
  onEditTerms,
  onChangeForm
}: {
  form: FamilyCreate;
  errors: FieldErrors;
  service: FamilyService;
  owner: PreviewOwner;
  showAllErrors: boolean;
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
  const chat = form.chat_kind ?? "telegram";

  return (
    <div className="create-step-body create-payout" data-create-step="payout">
      <section className="create-payout-block" aria-label="Так увидят в Маркете" data-testid="create-terms-summary">
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
        <span className="create-terms-caption">Банк</span>
        <Segmented
          label="Банк"
          options={BANKS.map((bank) => ({ value: bank, label: bankLabels[bank], icon: bankLogo(bank) }))}
          value={form.payment_bank}
          testId={(bank) => `create-bank-${bank}`}
          onChange={(bank) => onChangeForm((current) => ({ ...current, payment_bank: bank }))}
        />
      </section>

      <section className="create-payout-block" aria-label="Получатель">
        <span className="create-terms-caption">Получатель</span>
        <div className="create-payout-fields">
          <PayoutField label="Телефон" htmlFor="create-payment-phone" invalid={Boolean(phoneError)}>
            {/* The country code is fixed: +7 stays in front, only the ten digits are typed. */}
            <div className="create-payout-phone">
              <span aria-hidden="true">+7</span>
              <input
                id="create-payment-phone"
                required
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
                }}
              />
            </div>
          </PayoutField>
          <PayoutField label={
              <>
                Имя <span className="create-payout-field-hint">рекомендуем, для сверки перевода</span>
              </>
            } htmlFor="create-recipient-name" invalid={Boolean(nameError)}>
            <input
              id="create-recipient-name"
              placeholder="Кайрат Н."
              data-testid="create-recipient-name-input"
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="done"
              maxLength={40}
              aria-invalid={Boolean(nameError) || undefined}
              value={form.payment_recipient_name ?? ""}
              onBlur={() => setTouched((current) => ({ ...current, payment_recipient_name: true }))}
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

      <section className="create-payout-block" aria-label="Чат семьи">
        <span className="create-terms-caption">Чат семьи</span>
        <Segmented
          label="Чат семьи"
          options={CHAT_OPTIONS}
          value={chat}
          testId={(kind) => `create-chat-${kind}`}
          onChange={(kind) => onChangeForm((current) => ({ ...current, chat_kind: kind }))}
        />
        <small className="create-payout-note">
          {chat === "telegram"
            ? "После создания откроем группу с ботом, останется нажать «Создать»."
            : "После создания поможем сделать группу в WhatsApp за три шага."}
        </small>
      </section>
    </div>
  );
}
