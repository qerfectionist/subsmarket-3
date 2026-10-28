import type { ReactNode } from "react";
import { ServiceLogo } from "../branding";
import { SystemSymbol } from "../SystemSymbol";
import { serviceTitle } from "../../format";
import type { FamilyCreate, FamilyService } from "../../types";
import { calculatePreviewShare, formatKzt, periodPhrase, pluralRu } from "./createFamilyForm";

export function FieldNote({ error, helper }: { error?: string; helper?: ReactNode }) {
  if (error) {
    return (
      <small className="field-error" role="alert" aria-live="polite">
        {error}
      </small>
    );
  }
  return helper ? <small className="field-helper">{helper}</small> : null;
}

/** Minus, number, plus. The number stays editable for quick input. */
export function NumberStepper({
  id,
  label,
  value,
  min,
  max,
  testId,
  error,
  helper,
  onChange
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  testId: string;
  error?: string;
  helper?: ReactNode;
  onChange: (value: number) => void;
}) {
  return (
    <div className="ui-field create-stepper-field">
      <label htmlFor={id}>{label}</label>
      <div className="create-stepper">
        <button
          type="button"
          aria-label={`${label}: меньше`}
          data-testid={`${testId}-decrease`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          <SystemSymbol name="minus" size={20} />
        </button>
        <input
          id={id}
          className="input"
          min={min}
          max={max}
          data-testid={`${testId}-input`}
          inputMode="numeric"
          type="number"
          aria-invalid={Boolean(error) || undefined}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <button
          type="button"
          aria-label={`${label}: больше`}
          data-testid={`${testId}-increase`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          <SystemSymbol name="plus" size={20} />
        </button>
      </div>
      <FieldNote error={error} helper={helper} />
    </div>
  );
}

/** The family as members will see it in the market, updated while the owner types. */
export function CreateLiveCard({
  form,
  service
}: {
  form: FamilyCreate;
  service: FamilyService;
}) {
  const share = calculatePreviewShare(form.total_price_kzt, form.max_members);
  const free = Math.max(0, form.max_members - 1);
  const isTariff = service.family_type === "tariff";
  const plan = form.plan_name?.trim();
  return (
    <section className="create-live-card" data-testid="create-live-card" aria-label="Так увидят участники">
      <span className="create-live-caption">Так увидят участники</span>
      <div className="create-live-head">
        <ServiceLogo
          serviceSlug={service.slug}
          serviceName={service.name}
          familyType={isTariff ? "tariff" : "subscription"}
          size={44}
          loading="eager"
        />
        <div className="create-live-title">
          <strong>{isTariff ? `Тариф «${plan || "название"}»` : serviceTitle(service)}</strong>
          <span>{isTariff ? service.name : "Семья"}</span>
        </div>
        <div className="create-live-price">
          <strong>{formatKzt(share)}</strong>
          <span>{periodPhrase(form.period)}</span>
        </div>
      </div>
      <div className="create-live-chips">
        <span>
          {free} {pluralRu(free, "место свободно", "места свободно", "мест свободно")} из{" "}
          {form.max_members}
        </span>
        <span>оплата {form.payment_day}-го</span>
        {isTariff && form.full_speed_gb ? <span>{form.full_speed_gb} ГБ на полной скорости</span> : null}
      </div>
    </section>
  );
}

/** What each member transfers to the owner. */
export function CreateShareNote({ form }: { form: FamilyCreate }) {
  const share = calculatePreviewShare(form.total_price_kzt, form.max_members);
  return (
    <p className="create-share-note" data-testid="create-share-preview">
      <span aria-hidden="true">₸</span>
      Каждый участник переводит вам {formatKzt(share)} {periodPhrase(form.period)}
    </p>
  );
}
