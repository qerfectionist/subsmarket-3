import { useState, type Dispatch, type SetStateAction } from "react";
import { Input } from "../ui";
import type { FamilyCreate, FamilyService } from "../../types";
import {
  formatDayMonth,
  nextPaymentDateFor,
  periodPhrase,
  serviceStrings,
  type FieldErrors
} from "./createFamilyForm";
import { CreateLiveCard, CreateShareNote, FieldNote, NumberStepper } from "./createFamilyFields";

type Touched = Partial<Record<"plan_name" | "full_speed_gb", boolean>>;

/** Step 2: price, seats and payment day, with the card members will see. */
export function CreateFamilyTermsStep({
  form,
  errors,
  service,
  showAllErrors,
  onChangeForm
}: {
  form: FamilyCreate;
  errors: FieldErrors;
  service: FamilyService;
  showAllErrors: boolean;
  onChangeForm: Dispatch<SetStateAction<FamilyCreate>>;
}) {
  const [touched, setTouched] = useState<Touched>({});
  const isTariff = service.family_type === "tariff";
  const hints = serviceStrings(service, "tariff_hints");
  const shown = (key: keyof Touched) => (showAllErrors || touched[key] ? errors[key] : undefined);

  function setDay(day: number) {
    onChangeForm((current) => ({
      ...current,
      payment_day: day,
      // The first payment follows the day, so the two never disagree.
      next_payment_date: day >= 1 && day <= 31 ? nextPaymentDateFor(day) : current.next_payment_date
    }));
  }

  return (
    <div className="create-step-body" data-create-step="terms">
      <CreateLiveCard form={form} service={service} />
      <CreateShareNote form={form} />

      {isTariff ? (
        <>
          <div>
            <Input
              required
              label="Название тарифа"
              list={hints.length > 0 ? "create-tariff-hints" : undefined}
              data-testid="create-plan-name-input"
              error={Boolean(shown("plan_name"))}
              value={form.plan_name ?? ""}
              onBlur={() => setTouched((current) => ({ ...current, plan_name: true }))}
              onChange={(event) =>
                onChangeForm((current) => ({ ...current, plan_name: event.target.value }))
              }
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
        </>
      ) : null}

      <div className={isTariff ? "create-pair" : undefined}>
        <div>
          <Input
            label={`Цена ${periodPhrase(form.period)}, ₸`}
            min={1}
            data-testid="create-total-price-input"
            inputMode="numeric"
            type="number"
            error={Boolean(errors.total_price_kzt)}
            value={form.total_price_kzt}
            onChange={(event) =>
              onChangeForm((current) => ({ ...current, total_price_kzt: Number(event.target.value) }))
            }
          />
          <FieldNote
            error={errors.total_price_kzt}
            helper={isTariff ? undefined : "Сколько стоит подписка целиком"}
          />
        </div>
        {isTariff ? (
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
            <FieldNote error={shown("full_speed_gb")} />
          </div>
        ) : null}
      </div>
      {isTariff ? (
        <small className="field-helper create-wide-note">
          Сколько ГБ в месяц семья получает на полной скорости. Дальше интернет работает
          медленнее до начала следующего месяца.
        </small>
      ) : null}

      <div className="create-pair">
        <NumberStepper
          id="create-max-members"
          label="Мест, считая вас"
          value={form.max_members}
          min={2}
          max={service.max_members}
          testId="create-max-members"
          error={errors.max_members}
          helper={`До ${service.max_members} для этого сервиса`}
          onChange={(value) => onChangeForm((current) => ({ ...current, max_members: value }))}
        />
        <NumberStepper
          id="create-payment-day"
          label="День оплаты"
          value={form.payment_day}
          min={1}
          max={31}
          testId="create-payment-day"
          error={errors.payment_day ?? errors.next_payment_date}
          helper={`Ближайшая: ${formatDayMonth(form.next_payment_date)}`}
          onChange={setDay}
        />
      </div>
      {form.payment_day >= 29 ? (
        <small className="field-helper create-wide-note">
          В месяцах без {form.payment_day}-го числа оплата в последний день месяца.
        </small>
      ) : null}
    </div>
  );
}
