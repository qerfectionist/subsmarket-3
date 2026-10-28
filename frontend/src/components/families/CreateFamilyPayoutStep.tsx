import { useState, type Dispatch, type SetStateAction } from "react";
import { Input, TextArea } from "../ui";
import { ServiceLogo } from "../branding";
import { SystemSymbol } from "../SystemSymbol";
import { serviceTitle } from "../../format";
import { bankLabels } from "../../labels";
import type { FamilyCreate, FamilyService } from "../../types";
import {
  calculatePreviewShare,
  formatKzt,
  periodPhrase,
  pluralRu,
  type FieldErrors
} from "./createFamilyForm";
import { FieldNote } from "./createFamilyFields";

const BANKS = Object.keys(bankLabels) as FamilyCreate["payment_bank"][];

type Touched = Partial<Record<"payment_phone" | "payment_recipient_name", boolean>>;

/** Step 3: where members send money. */
export function CreateFamilyPayoutStep({
  form,
  errors,
  service,
  showAllErrors,
  onEditTerms,
  onChangeForm
}: {
  form: FamilyCreate;
  errors: FieldErrors;
  service: FamilyService;
  showAllErrors: boolean;
  onEditTerms: () => void;
  onChangeForm: Dispatch<SetStateAction<FamilyCreate>>;
}) {
  const [touched, setTouched] = useState<Touched>({});
  const shown = (key: keyof Touched) => (showAllErrors || touched[key] ? errors[key] : undefined);
  const share = calculatePreviewShare(form.total_price_kzt, form.max_members);
  const title =
    service.family_type === "tariff" && form.plan_name?.trim()
      ? `${service.name} «${form.plan_name.trim()}»`
      : serviceTitle(service);

  return (
    <div className="create-step-body" data-create-step="payout">
      <div className="create-terms-summary" data-testid="create-terms-summary">
        <ServiceLogo
          serviceSlug={service.slug}
          serviceName={service.name}
          familyType={service.family_type === "tariff" ? "tariff" : "subscription"}
          size={36}
          loading="eager"
        />
        <div>
          <strong>{title}</strong>
          <span>
            {formatKzt(share)} {periodPhrase(form.period)} · {form.max_members}{" "}
            {pluralRu(form.max_members, "место", "места", "мест")} · оплата {form.payment_day}-го
          </span>
        </div>
        <button type="button" data-testid="create-edit-terms" onClick={onEditTerms}>
          Изменить
        </button>
      </div>

      <div className="ui-field">
        <span>Куда переводить</span>
        <div className="create-bank-grid" role="radiogroup" aria-label="Банк">
          {BANKS.map((bank) => {
            const selected = bank === form.payment_bank;
            return (
              <button
                key={bank}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`create-bank-${bank}`}
                className="create-bank-tile"
                onClick={() => onChangeForm((current) => ({ ...current, payment_bank: bank }))}
              >
                <span className={`create-bank-mark create-bank-mark-${bank}`} aria-hidden="true">
                  {bankLabels[bank].slice(0, 1)}
                </span>
                <span>{bankLabels[bank]}</span>
                {selected ? (
                  <span className="create-service-tile-check">
                    <SystemSymbol name="checkmark" size={14} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Input
          required
          label="Номер телефона"
          placeholder="+7 700 123 45 67"
          data-testid="create-payment-phone-input"
          inputMode="tel"
          autoComplete="tel"
          error={Boolean(shown("payment_phone"))}
          value={form.payment_phone}
          onBlur={() => setTouched((current) => ({ ...current, payment_phone: true }))}
          onChange={(event) =>
            onChangeForm((current) => ({ ...current, payment_phone: event.target.value }))
          }
        />
        <FieldNote
          error={shown("payment_phone")}
          helper="Номер, привязанный к банку. Карту и IBAN указать нельзя."
        />
      </div>

      <div>
        <Input
          required
          label="Имя получателя"
          placeholder="Айгерим Б."
          data-testid="create-recipient-name-input"
          autoComplete="off"
          maxLength={40}
          error={Boolean(shown("payment_recipient_name"))}
          value={form.payment_recipient_name ?? ""}
          onBlur={() => setTouched((current) => ({ ...current, payment_recipient_name: true }))}
          onChange={(event) =>
            onChangeForm((current) => ({ ...current, payment_recipient_name: event.target.value }))
          }
        />
        <FieldNote
          error={shown("payment_recipient_name")}
          helper="Имя и первая буква фамилии, как покажет банк при переводе. Номер и имя увидят только участники, которым вы подтвердили доступ."
        />
      </div>

      <TextArea
        label="Правила семьи · необязательно"
        placeholder="Например: не менять пароль, не делиться доступом"
        data-testid="create-owner-rules-input"
        rows={2}
        value={form.owner_rules ?? ""}
        onChange={(event) =>
          onChangeForm((current) => ({ ...current, owner_rules: event.target.value }))
        }
      />
    </div>
  );
}
