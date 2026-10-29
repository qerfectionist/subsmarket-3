import { Button as AppButton } from "../ui";
import { ServiceLogo } from "../branding";
import { SystemSymbol } from "../SystemSymbol";
import type {
  MarketplaceListingCreate,
  MarketplaceOperator,
  MarketplacePriceInsight
} from "../../types";

const DEFAULT_MAX_GB = 10;
const MAX_LISTING_GB = 1000;

function formatKzt(value: number) {
  return `${value.toLocaleString("ru-KZ")} ₸`;
}

function formatDayMonth(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(
    new Date(year, month - 1, day)
  );
}

function pluralDays(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}

/** Smallest order the operator allows, in whole GB. */
export function operatorMinimumGb(operator: MarketplaceOperator | null) {
  return Math.max(1, Math.ceil(Number(operator?.min_lot_gb ?? 1)));
}

export function defaultMaxGb(operator: MarketplaceOperator | null) {
  return Math.max(DEFAULT_MAX_GB, operatorMinimumGb(operator));
}

/** The operator's own rules, shown as they are: fee, how long GB live, limits. */
export function OperatorRules({ operator }: { operator: MarketplaceOperator }) {
  return (
    <div className="gb-operator-rules" data-testid="gb-operator-rules">
      <span className="gb-operator-rules-title">Правила {operator.name}</span>
      {operator.fee_note ? <p>{operator.fee_note}</p> : null}
      {operator.validity_days ? (
        <p>
          У покупателя ГБ действуют {operator.validity_days} {pluralDays(operator.validity_days)}.
        </p>
      ) : null}
      {operator.conditions ? <p>{operator.conditions}</p> : null}
      {operator.source_url ? (
        <a href={operator.source_url} target="_blank" rel="noreferrer">
          Правила на сайте оператора
        </a>
      ) : null}
    </div>
  );
}

export function GigabytesListingForm({
  form,
  operator,
  operators,
  editing,
  busy,
  priceInsight,
  onChange,
  onSubmit
}: {
  form: MarketplaceListingCreate;
  operator: MarketplaceOperator | null;
  operators: MarketplaceOperator[];
  editing: boolean;
  busy: boolean;
  priceInsight: MarketplacePriceInsight | null;
  onChange: (value: MarketplaceListingCreate) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const minimum = operatorMinimumGb(operator);
  const maxGb = form.max_gb ?? defaultMaxGb(operator);
  const maxInvalid = !Number.isInteger(maxGb) || maxGb < minimum || maxGb > MAX_LISTING_GB;
  const priceInvalid = !Number.isInteger(form.price_per_gb_kzt) || form.price_per_gb_kzt < 1;
  const setMax = (value: number) => onChange({ ...form, max_gb: value });

  return (
    <form className="gb-form" onSubmit={onSubmit}>
      <div className="ui-field">
        <span>Оператор</span>
        <div className="gb-operator-grid" role="radiogroup" aria-label="Оператор">
          {operators.map((item) => {
            const selected = item.slug === form.operator_slug;
            return (
              <button
                key={item.slug}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={editing && !selected}
                data-testid={`gb-operator-${item.slug}`}
                className="gb-operator-tile"
                onClick={() =>
                  onChange({
                    ...form,
                    operator_slug: item.slug,
                    max_gb: Math.max(form.max_gb ?? defaultMaxGb(item), operatorMinimumGb(item))
                  })
                }
              >
                <ServiceLogo
                  serviceSlug={`${item.slug}-family-tariff`}
                  serviceName={item.name}
                  familyType="tariff"
                  size={28}
                />
                <span>{item.name}</span>
                {selected ? (
                  <span className="gb-operator-check">
                    <SystemSymbol name="checkmark" size={12} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <small className="field-helper">Altel и Izi не передают гигабайты</small>
      </div>

      <div className="gb-form-pair">
        <div className="ui-field">
          <label htmlFor="gb-max-input">Максимум ГБ</label>
          <div className="create-stepper">
            <button
              type="button"
              aria-label="Меньше ГБ"
              disabled={maxGb <= minimum}
              onClick={() => setMax(Math.max(minimum, maxGb - 1))}
            >
              <SystemSymbol name="minus" size={18} />
            </button>
            <input
              id="gb-max-input"
              className="input"
              type="number"
              inputMode="numeric"
              min={minimum}
              max={MAX_LISTING_GB}
              data-testid="gb-max-input"
              aria-invalid={maxInvalid || undefined}
              value={maxGb}
              onChange={(event) => setMax(Number(event.target.value))}
            />
            <button
              type="button"
              aria-label="Больше ГБ"
              disabled={maxGb >= MAX_LISTING_GB}
              onClick={() => setMax(Math.min(MAX_LISTING_GB, maxGb + 1))}
            >
              <SystemSymbol name="plus" size={18} />
            </button>
          </div>
          <small className={maxInvalid ? "field-error" : "field-helper"}>
            {minimum > 1 ? `Покупатель берёт от ${minimum} ГБ` : "Покупатель выбирает сколько"}
          </small>
        </div>
        <label className="ui-field">
          <span>Цена за 1 ГБ, ₸</span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="1000000"
            data-testid="gb-price-input"
            value={form.price_per_gb_kzt}
            onChange={(event) =>
              onChange({ ...form, price_per_gb_kzt: Number(event.target.value) })
            }
            required
          />
        </label>
      </div>

      <PriceInsight insight={priceInsight} price={form.price_per_gb_kzt} />

      {operator ? <OperatorRules operator={operator} /> : null}

      {operator ? (
        <div className="gb-preview" data-testid="gb-preview">
          <ServiceLogo
            serviceSlug={`${operator.slug}-family-tariff`}
            serviceName={operator.name}
            familyType="tariff"
            size={40}
          />
          <div className="gb-preview-copy">
            <span className="gb-preview-caption">Так увидят покупатели</span>
            <strong>
              {operator.name}, до {maxGb} ГБ
            </strong>
            <span>
              покупатель выбирает сколько
              {operator.validity_days
                ? ` · живут ${operator.validity_days} ${pluralDays(operator.validity_days)}`
                : ""}
            </span>
          </div>
          <div className="gb-preview-price">
            <strong>{formatKzt(form.price_per_gb_kzt || 0)}</strong>
            <span>за 1 ГБ</span>
          </div>
        </div>
      ) : null}

      {operator?.available_until ? (
        <p className="gb-operator-deadline">
          {operator.name} обещает услугу до {formatDayMonth(operator.available_until)}. Если её не
          продлят, объявления скроются сами.
        </p>
      ) : null}

      <p className="gb-pay-first">
        <strong>Покупатель платит первым.</strong> Когда вы примете заявку, он напишет вам в
        Telegram. Отправляйте ГБ, когда деньги пришли.
      </p>

      <div className="listing-form-footer">
        <AppButton fullWidth type="submit" disabled={busy || maxInvalid || priceInvalid}>
          {busy ? "Сохраняем..." : editing ? "Сохранить" : "Опубликовать на 7 дней"}
        </AppButton>
      </div>
    </form>
  );
}

export function PriceInsight({
  insight,
  price
}: {
  insight: MarketplacePriceInsight | null;
  price: number;
}) {
  if (!insight) return null;
  const minimum = insight.typical_min_price_per_gb_kzt;
  const maximum = insight.typical_max_price_per_gb_kzt;
  const median = insight.median_price_per_gb_kzt;
  if (insight.sample_size < 5 || minimum == null || maximum == null || median == null) {
    return (
      <div className="gb-price-insight neutral">
        Пока недостаточно объявлений для сравнения цены.
      </div>
    );
  }
  const verdict =
    price < minimum
      ? "Цена ниже обычной"
      : price > maximum
        ? "Цена выше обычной"
        : "Цена в обычном диапазоне";
  return (
    <div className="gb-price-insight">
      <strong>{verdict}</strong>
      <span>
        Обычно {formatKzt(minimum)}–{formatKzt(maximum)} за 1 ГБ · медиана {formatKzt(median)}
      </span>
    </div>
  );
}
