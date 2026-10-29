import { useState, type Dispatch, type SetStateAction } from "react";
import { Input } from "../ui";
import { ServiceLogo } from "../branding";
import { SystemSymbol } from "../SystemSymbol";
import { serviceTitle } from "../../format";
import type { FamilyCreate, FamilyService } from "../../types";
import {
  calculatePreviewShare,
  formatKzt,
  nextPaymentDateFor,
  periodPhrase,
  serviceStrings,
  type FieldErrors
} from "./createFamilyForm";
import { FieldNote } from "./createFamilyFields";
import { AmountDisplay, AmountKeypad, MiniStepper, TermsRow } from "./createTermsParts";

type Touched = Partial<Record<"plan_name" | "full_speed_gb", boolean>>;

/**
 * Step 2 as an amount screen, the way banking apps take a sum: the service as
 * a small pill (a tap goes back to change it), the full price as the one large
 * number, the places, the payment day and each member's share as one group of
 * rows, and a keypad for the digits, so no system keyboard covers the rows.
 */
export function CreateFamilyTermsStep({
  form,
  errors,
  service,
  showAllErrors,
  onEditService,
  onChangeForm
}: {
  form: FamilyCreate;
  errors: FieldErrors;
  service: FamilyService;
  showAllErrors: boolean;
  onEditService: () => void;
  onChangeForm: Dispatch<SetStateAction<FamilyCreate>>;
}) {
  const [touched, setTouched] = useState<Touched>({});
  const isTariff = service.family_type === "tariff";
  const hints = serviceStrings(service, "tariff_hints");
  const shown = (key: keyof Touched) => (showAllErrors || touched[key] ? errors[key] : undefined);
  const share = calculatePreviewShare(form.total_price_kzt, form.max_members);
  const setPrice = (value: number) => onChangeForm((current) => ({ ...current, total_price_kzt: value }));

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
      <button type="button" className="create-terms-pill" data-testid="create-edit-service" onClick={onEditService}>
        <ServiceLogo
          serviceSlug={service.slug}
          serviceName={service.name}
          familyType={isTariff ? "tariff" : "subscription"}
          size={26}
          loading="eager"
        />
        <span>{isTariff ? service.name : serviceTitle(service)}</span>
        <SystemSymbol name="chevron.down" size={16} />
      </button>

      <AmountDisplay
        label={`${isTariff ? "Тариф" : "Подписка"} ${periodPhrase(form.period)}`}
        value={form.total_price_kzt}
        error={errors.total_price_kzt}
        onChange={setPrice}
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
        <p className="create-terms-share" data-testid="create-share-preview">
          <span>Каждый платит вам</span>
          <strong>
            {formatKzt(share)} <small>{form.period === "yearly" ? "/ год" : "/ мес"}</small>
          </strong>
        </p>
      </section>
      {form.payment_day >= 29 ? (
        <small className="create-terms-note">
          В месяцах без {form.payment_day}-го числа оплата в последний день месяца.
        </small>
      ) : null}

      <AmountKeypad value={form.total_price_kzt} onChange={setPrice} />
    </div>
  );
}
