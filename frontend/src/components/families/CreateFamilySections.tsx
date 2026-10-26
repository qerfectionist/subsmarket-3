import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Input, TextArea } from "../ui";
import { ServiceLogo } from "../branding";
import { SystemSymbol } from "../SystemSymbol";
import { serviceTitle } from "../../format";
import { bankLabels } from "../../labels";
import type { FamilyCreate, FamilyService, FamilyType } from "../../types";
import {
  calculatePreviewShare,
  formatKzt,
  matchesServiceQuery,
  nextPaymentDateFor,
  periodOptionLabel,
  periodPhrase,
  pluralRu,
  serviceCategoryLabel,
  serviceCategoryOrder,
  type CreateSection,
  type FieldErrors
} from "./createFamilyForm";

type SectionProps = {
  form: FamilyCreate;
  errors: FieldErrors;
  service: FamilyService | null;
  onChangeForm: Dispatch<SetStateAction<FamilyCreate>>;
};

/** Services a search box is worth showing for. */
const SERVICE_SEARCH_THRESHOLD = 8;

function FieldNote({ error, helper }: { error?: string; helper?: ReactNode }) {
  if (error) {
    return (
      <small className="field-error" role="alert" aria-live="polite">
        {error}
      </small>
    );
  }
  return helper ? <small className="field-helper">{helper}</small> : null;
}

function Choice<T extends string>({
  label,
  value,
  options,
  testIdPrefix,
  onChange
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  testIdPrefix: string;
  onChange: (value: T) => void;
}) {
  return (
    <div className="ui-field">
      <span>{label}</span>
      <div className="create-choice" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            data-testid={`${testIdPrefix}-${option.value}`}
            className="create-choice-option"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Live share preview: what each member pays and how many seats are open. */
export function CreateSharePreview({ form }: { form: FamilyCreate }) {
  const share = calculatePreviewShare(form.total_price_kzt, form.max_members);
  const freeSeats = Math.max(0, form.max_members - 1);
  return (
    <div className="create-preview" data-testid="create-share-preview">
      <div>
        <span>Доля участника</span>
        <strong>
          {formatKzt(share)} {periodPhrase(form.period)}
        </strong>
      </div>
      <div>
        <span>Свободных мест</span>
        <strong>{freeSeats}</strong>
      </div>
      <p>
        Вы тоже занимаете место и платите свою долю. Цена делится на всех и округляется
        вверх до 50 ₸. Пока места свободны, их долю платите вы.
      </p>
    </div>
  );
}

function ServiceSection({
  form,
  errors,
  onChangeForm,
  familyType,
  typedServices,
  onPicked
}: SectionProps & {
  familyType: FamilyType;
  typedServices: FamilyService[];
  onPicked: (planMissing: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [planTouched, setPlanTouched] = useState(false);
  const visible = typedServices.filter((item) => matchesServiceQuery(item, query));
  const groups = new Map<string, FamilyService[]>();
  const ordered = [...visible].sort(
    (a, b) => serviceCategoryOrder(a.category) - serviceCategoryOrder(b.category)
  );
  for (const item of ordered) {
    const key = familyType === "tariff" ? "" : serviceCategoryLabel(item.category);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const planError = planTouched ? errors.plan_name : undefined;

  function pick(item: FamilyService) {
    onChangeForm((current) => ({
      ...current,
      service_id: item.id,
      period: item.supported_periods.includes(current.period)
        ? current.period
        : ((item.supported_periods[0] as FamilyCreate["period"] | undefined) ?? "monthly"),
      max_members: Math.min(current.max_members, item.max_members)
    }));
    const planMissing = familyType === "tariff" && !form.plan_name?.trim();
    if (planMissing) setPlanTouched(true);
    onPicked(planMissing);
  }

  return (
    <>
      {familyType === "tariff" ? (
        <div>
          <Input
            required
            label="Название тарифа"
            data-testid="create-plan-name-input"
            error={Boolean(planError)}
            value={form.plan_name ?? ""}
            onBlur={() => setPlanTouched(true)}
            onChange={(event) =>
              onChangeForm((current) => ({ ...current, plan_name: event.target.value }))
            }
          />
          <FieldNote error={planError} helper="Как у оператора, например «Семейный 5+»" />
        </div>
      ) : null}
      {typedServices.length > SERVICE_SEARCH_THRESHOLD ? (
        <div>
          <Input
            type="search"
            aria-label="Найти сервис"
            placeholder="Найти сервис"
            data-testid="create-service-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      ) : null}
      <div className="create-service-picker" role="radiogroup" aria-label="Сервис">
        {[...groups.entries()].map(([group, items]) => (
          <section key={group || "all"} className="create-service-group">
            {group ? <h3>{group}</h3> : null}
            <div className="create-service-list">
              {items.map((item) => {
                const selected = item.id === form.service_id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-testid={`create-service-option-${item.slug}`}
                    className="create-service-option"
                    onClick={() => pick(item)}
                  >
                    <ServiceLogo
                      serviceSlug={item.slug}
                      serviceName={item.name}
                      familyType={item.family_type === "tariff" ? "tariff" : "subscription"}
                      size={32}
                    />
                    <span className="create-service-option-copy">
                      <strong>{serviceTitle(item)}</strong>
                      <span>
                        До {item.max_members} {pluralRu(item.max_members, "места", "мест", "мест")}
                      </span>
                    </span>
                    {selected ? (
                      <SystemSymbol name="checkmark" size={24} className="create-service-check" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {visible.length === 0 ? (
          <p className="create-service-empty">Ничего не нашлось. Проверьте название.</p>
        ) : null}
      </div>
    </>
  );
}

function PriceSection({ form, errors, service, onChangeForm }: SectionProps) {
  const maxMembers = service?.max_members ?? 8;
  const periods = (service?.supported_periods ?? ["monthly"]) as FamilyCreate["period"][];
  const setSeats = (value: number) =>
    onChangeForm((current) => ({ ...current, max_members: value }));
  return (
    <>
      {periods.length > 1 ? (
        <Choice
          label="Как платите за подписку"
          value={form.period}
          testIdPrefix="create-period"
          options={periods.map((period) => ({ value: period, label: periodOptionLabel(period) }))}
          onChange={(period) => onChangeForm((current) => ({ ...current, period }))}
        />
      ) : null}
      <div>
        <Input
          label={`Полная цена ${periodPhrase(form.period)}, ₸`}
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
        <FieldNote error={errors.total_price_kzt} helper="Сколько стоит подписка целиком" />
      </div>
      <div className="ui-field">
        <label htmlFor="create-max-members">Мест в семье, считая вас</label>
        <div className="create-stepper">
          <button
            type="button"
            aria-label="Меньше мест"
            data-testid="create-max-members-decrease"
            disabled={form.max_members <= 2}
            onClick={() => setSeats(Math.max(2, form.max_members - 1))}
          >
            <SystemSymbol name="minus" size={20} />
          </button>
          <input
            id="create-max-members"
            className="input"
            min={2}
            max={maxMembers}
            data-testid="create-max-members-input"
            inputMode="numeric"
            type="number"
            aria-invalid={Boolean(errors.max_members) || undefined}
            value={form.max_members}
            onChange={(event) => setSeats(Number(event.target.value))}
          />
          <button
            type="button"
            aria-label="Больше мест"
            data-testid="create-max-members-increase"
            disabled={form.max_members >= maxMembers}
            onClick={() => setSeats(Math.min(maxMembers, form.max_members + 1))}
          >
            <SystemSymbol name="plus" size={20} />
          </button>
        </div>
        <FieldNote error={errors.max_members} helper={`От 2 до ${maxMembers}`} />
      </div>
      <CreateSharePreview form={form} />
    </>
  );
}

function ScheduleSection({ form, errors, onChangeForm }: SectionProps) {
  return (
    <>
      <div className="half">
        <Input
          label="Число месяца"
          min={1}
          max={31}
          data-testid="create-payment-day-input"
          inputMode="numeric"
          type="number"
          error={Boolean(errors.payment_day)}
          value={form.payment_day}
          onChange={(event) => {
            const day = Number(event.target.value);
            onChangeForm((current) => ({
              ...current,
              payment_day: day,
              // The first payment follows the day, so the two never disagree.
              next_payment_date:
                day >= 1 && day <= 31 ? nextPaymentDateFor(day) : current.next_payment_date
            }));
          }}
        />
        <FieldNote error={errors.payment_day} />
      </div>
      <div className="half">
        <Input
          label="Первая оплата"
          data-testid="create-next-payment-date-input"
          type="date"
          error={Boolean(errors.next_payment_date)}
          value={form.next_payment_date}
          onChange={(event) =>
            onChangeForm((current) => ({ ...current, next_payment_date: event.target.value }))
          }
        />
        <FieldNote error={errors.next_payment_date} />
      </div>
    </>
  );
}

function PaymentSection({ form, errors, onChangeForm }: SectionProps) {
  return (
    <>
      <Choice
        label="Банк"
        value={form.payment_bank}
        testIdPrefix="create-bank"
        options={(Object.keys(bankLabels) as FamilyCreate["payment_bank"][]).map((bank) => ({
          value: bank,
          label: bankLabels[bank]
        }))}
        onChange={(payment_bank) => onChangeForm((current) => ({ ...current, payment_bank }))}
      />
      <div>
        <Input
          required
          label="Номер телефона для перевода"
          placeholder="+7 700 123 45 67"
          data-testid="create-payment-phone-input"
          inputMode="tel"
          autoComplete="tel"
          error={Boolean(errors.payment_phone)}
          value={form.payment_phone}
          onChange={(event) =>
            onChangeForm((current) => ({ ...current, payment_phone: event.target.value }))
          }
        />
        <FieldNote
          error={errors.payment_phone}
          helper="Номер, привязанный к банку. Номер карты и IBAN указывать нельзя."
        />
      </div>
    </>
  );
}

function DetailsSection({ form, onChangeForm }: SectionProps) {
  return (
    <>
      <div className="wide">
        <TextArea
          label="Описание"
          placeholder="Что входит в подписку, как подключиться"
          data-testid="create-description-input"
          rows={3}
          value={form.description ?? ""}
          onChange={(event) =>
            onChangeForm((current) => ({ ...current, description: event.target.value }))
          }
        />
      </div>
      <div className="wide">
        <TextArea
          label="Правила"
          placeholder="Например: не менять пароль, не делиться доступом"
          data-testid="create-owner-rules-input"
          rows={3}
          value={form.owner_rules ?? ""}
          onChange={(event) =>
            onChangeForm((current) => ({ ...current, owner_rules: event.target.value }))
          }
        />
      </div>
    </>
  );
}

export function CreateFamilySectionFields({
  section,
  familyType,
  typedServices,
  onServicePicked,
  ...props
}: SectionProps & {
  section: CreateSection;
  familyType: FamilyType;
  typedServices: FamilyService[];
  onServicePicked: (planMissing: boolean) => void;
}) {
  switch (section) {
    case "service":
      return (
        <ServiceSection
          {...props}
          familyType={familyType}
          typedServices={typedServices}
          onPicked={onServicePicked}
        />
      );
    case "price":
      return <PriceSection {...props} />;
    case "schedule":
      return <ScheduleSection {...props} />;
    case "payment":
      return <PaymentSection {...props} />;
    case "details":
      return <DetailsSection {...props} />;
  }
}
