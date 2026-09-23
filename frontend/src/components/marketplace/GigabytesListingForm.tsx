import { Button as AppButton } from "../ui";
import type {
  MarketplaceListingCreate,
  MarketplaceOperator,
  MarketplacePriceInsight
} from "../../types";

const MINIMUM_GB_ORDER = 1;

function formatKzt(value: number) {
  return `${value.toLocaleString("ru-KZ")} ₸`;
}

function formatGb(value: number | string | null | undefined) {
  if (value == null) return "0";
  return `${Number(value).toLocaleString("ru-KZ")}`;
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
  return (
    <form className="gb-form" onSubmit={onSubmit}>
      <label className="ui-field">
        <span>Оператор</span>
        <select
          disabled={editing}
          value={form.operator_slug}
          onChange={(event) => onChange({ ...form, operator_slug: event.target.value })}
        >
          {operators.map((item) => (
            <option value={item.slug} key={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      <label className="ui-field">
        <span>Цена за 1 ГБ, ₸</span>
        <input
          type="number"
          min="1"
          max="1000000"
          value={form.price_per_gb_kzt}
          onChange={(event) =>
            onChange({ ...form, price_per_gb_kzt: Number(event.target.value) })
          }
          required
        />
      </label>

      <PriceInsight insight={priceInsight} price={form.price_per_gb_kzt} />

      <label className="ui-field">
        <span>Описание</span>
        <textarea
          maxLength={300}
          rows={3}
          value={form.description ?? ""}
          placeholder="Необязательно"
          onChange={(event) => onChange({ ...form, description: event.target.value })}
        />
      </label>

      {operator ? (
        <div className="gb-operator-hint">
          Один перевод: от {formatGb(Math.max(MINIMUM_GB_ORDER, Number(operator.min_lot_gb ?? 0)))} до {formatGb(operator.max_lot_gb)} ГБ, только целое количество.
        </div>
      ) : null}

      <AppButton fullWidth type="submit" disabled={busy}>
        {busy ? "Сохраняем..." : editing ? "Сохранить" : "Опубликовать на 7 дней"}
      </AppButton>
      <p className="gb-safety-note">
        Номер телефона, карту и банковские реквизиты здесь указывать нельзя.
      </p>
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
