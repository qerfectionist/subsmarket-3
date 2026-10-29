import { useState, type Dispatch, type SetStateAction } from "react";
import { Input } from "../ui";
import { ServiceLogo } from "../branding";
import { serviceTitle } from "../../format";
import type { FamilyCreate, FamilyService } from "../../types";
import {
  calculatePreviewShare,
  formatDayMonth,
  formatKzt,
  nextPaymentDateFor,
  periodPhrase,
  serviceStrings,
  type FieldErrors
} from "./createFamilyForm";
import { FieldNote } from "./createFamilyFields";
import { MiniStepper, PriceHero, SeatStrip, TermsRow } from "./createTermsParts";

type Touched = Partial<Record<"plan_name" | "full_speed_gb", boolean>>;

/**
 * Step 2, in the order the person thinks it through: which service (a short
 * row, to go back and change it), how much it costs in full (the one large
 * number), how many places share it and so what each member pays, then the
 * day of payment. The result sits right under what it comes from.
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
  const period = periodPhrase(form.period);

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
      <div className="create-terms-service">
        <ServiceLogo
          serviceSlug={service.slug}
          serviceName={service.name}
          familyType={isTariff ? "tariff" : "subscription"}
          size={36}
          loading="eager"
        />
        <strong>{isTariff ? service.name : serviceTitle(service)}</strong>
        <button type="button" data-testid="create-edit-service" onClick={onEditService}>
          Изменить
        </button>
      </div>

      {isTariff ? (
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
      ) : null}

      <PriceHero
        label={isTariff ? `Сколько стоит тариф ${period}` : `Сколько стоит подписка ${period}`}
        value={form.total_price_kzt}
        error={errors.total_price_kzt}
        onChange={(value) => onChangeForm((current) => ({ ...current, total_price_kzt: value }))}
      />

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
          <FieldNote
            error={shown("full_speed_gb")}
            helper="Сколько ГБ в месяц семья получает на полной скорости, дальше медленнее"
          />
        </div>
      ) : null}

      <section className="create-terms-card" aria-label="Места">
        <TermsRow
          label="Мест, считая вас"
          hint={`Сервис разрешает до ${service.max_members}`}
          error={errors.max_members}
        >
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
        <SeatStrip count={form.max_members} />
        <p className="create-terms-share" data-testid="create-share-preview">
          <span>Каждый участник платит вам</span>
          <strong>
            {formatKzt(share)} <small>{form.period === "yearly" ? "/ год" : "/ мес"}</small>
          </strong>
        </p>
      </section>

      <section className="create-terms-card" aria-label="День оплаты">
        <TermsRow
          label="День оплаты"
          hint={`Ближайшая ${formatDayMonth(form.next_payment_date)}`}
          error={errors.payment_day ?? errors.next_payment_date}
        >
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
        {form.payment_day >= 29 ? (
          <small className="create-terms-note">
            В месяцах без {form.payment_day}-го числа оплата в последний день месяца.
          </small>
        ) : null}
      </section>
    </div>
  );
}
