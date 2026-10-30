import { useState, type Dispatch, type SetStateAction } from "react";
import { Input } from "../ui";
import { FamilyListingCard } from "../ListingCard";
import type { Family, FamilyCreate, FamilyService } from "../../types";
import {
  calculatePreviewShare,
  nextPaymentDateFor,
  periodPhrase,
  serviceStrings,
  type FieldErrors
} from "./createFamilyForm";
import { FieldNote } from "./createFamilyFields";
import { AmountField, MiniStepper, TermsRow } from "./createTermsParts";

type Touched = Partial<Record<"plan_name" | "full_speed_gb", boolean>>;

/** Who the preview card shows as the organiser. */
export type PreviewOwner = { avatar_name: string; photo_url?: string | null };

/**
 * Step 2: the family as it will show on the Market (the same card, updated
 * as the numbers change), the full price as the one large number, then the
 * places and the payment day as one group of rows.
 */
export function CreateFamilyTermsStep({
  form,
  errors,
  service,
  owner,
  showAllErrors,
  onChangeForm
}: {
  form: FamilyCreate;
  errors: FieldErrors;
  service: FamilyService;
  owner: PreviewOwner;
  showAllErrors: boolean;
  onChangeForm: Dispatch<SetStateAction<FamilyCreate>>;
}) {
  const [touched, setTouched] = useState<Touched>({});
  const isTariff = service.family_type === "tariff";
  const hints = serviceStrings(service, "tariff_hints");
  const shown = (key: keyof Touched) => (showAllErrors || touched[key] ? errors[key] : undefined);

  // Only the fields the Market card reads; the rest of a family does not exist yet.
  const preview = {
    id: "preview",
    family_type: isTariff ? "tariff" : "subscription",
    service_slug: service.slug,
    service_name: service.name,
    service_variant: service.variant ?? null,
    plan_name: isTariff ? form.plan_name?.trim() || "Название тарифа" : null,
    max_members: form.max_members,
    free_slots: Math.max(0, form.max_members - 1),
    period: form.period,
    member_share_kzt: calculatePreviewShare(form.total_price_kzt, form.max_members),
    owner
  } as unknown as Family;

  function setDay(day: number) {
    onChangeForm((current) => ({
      ...current,
      payment_day: day,
      // The first payment follows the day, so the two never disagree.
      next_payment_date: day >= 1 && day <= 31 ? nextPaymentDateFor(day) : current.next_payment_date
    }));
  }

  return (
    <div className="create-step-body create-terms" data-create-step="terms">
      <section className="create-terms-preview" aria-label="Так увидят в Маркете" data-testid="create-share-preview">
        <span className="create-terms-caption">Так увидят в Маркете</span>
        <div className="create-terms-preview-card" aria-hidden="true">
          <FamilyListingCard family={preview} isOwner onClick={() => undefined} testId="create-preview-card" />
        </div>
      </section>

      <AmountField
        label={`Сколько стоит ${isTariff ? "тариф" : "подписка"} ${periodPhrase(form.period)}`}
        hint="Цена делится поровну на всех, включая вас"
        value={form.total_price_kzt}
        error={errors.total_price_kzt}
        onChange={(value) => onChangeForm((current) => ({ ...current, total_price_kzt: value }))}
      />

      {isTariff ? (
        <div className="create-terms-tariff">
          <div>
            <Input
              required
              label="Название тарифа"
              list={hints.length > 0 ? "create-tariff-hints" : undefined}
              data-testid="create-plan-name-input"
              error={Boolean(shown("plan_name"))}
              value={form.plan_name ?? ""}
              onBlur={() => setTouched((current) => ({ ...current, plan_name: true }))}
              onChange={(event) => onChangeForm((current) => ({ ...current, plan_name: event.target.value }))}
            />
            {hints.length > 0 ? (
              <datalist id="create-tariff-hints">
                {hints.map((hint) => (
                  <option key={hint} value={hint} />
                ))}
              </datalist>
            ) : null}
            <FieldNote error={shown("plan_name")} helper="Как в приложении оператора" />
          </div>
          <div>
            <Input
              label="Полная скорость, ГБ"
              min={1}
              data-testid="create-full-speed-input"
              inputMode="numeric"
              type="number"
              error={Boolean(shown("full_speed_gb"))}
              value={form.full_speed_gb ?? ""}
              onBlur={() => setTouched((current) => ({ ...current, full_speed_gb: true }))}
              onChange={(event) =>
                onChangeForm((current) => ({
                  ...current,
                  full_speed_gb: event.target.value === "" ? null : Number(event.target.value)
                }))
              }
            />
            <FieldNote error={shown("full_speed_gb")} helper="Сколько ГБ в месяц на полной скорости" />
          </div>
        </div>
      ) : null}

      <section className="create-terms-group" aria-label="Места и оплата">
        <TermsRow label="Мест, считая вас" error={errors.max_members}>
          <MiniStepper
            id="create-max-members"
            label="Мест, считая вас"
            value={form.max_members}
            min={2}
            max={service.max_members}
            testId="create-max-members"
            onChange={(value) => onChangeForm((current) => ({ ...current, max_members: value }))}
          />
        </TermsRow>
        <TermsRow label="День оплаты" error={errors.payment_day ?? errors.next_payment_date}>
          <MiniStepper
            id="create-payment-day"
            label="День оплаты"
            value={form.payment_day}
            min={1}
            max={31}
            testId="create-payment-day"
            onChange={setDay}
          />
        </TermsRow>
      </section>
      {form.payment_day >= 29 ? (
        <small className="create-terms-note">
          В месяцах без {form.payment_day}-го числа оплата в последний день месяца.
        </small>
      ) : null}
    </div>
  );
}
