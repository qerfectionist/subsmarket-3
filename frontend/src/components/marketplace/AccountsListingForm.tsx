import { Button as AppButton } from "../ui";
import type { AccountListingCreate, AccountService } from "../../types";

export function AccountsListingForm({
  form,
  services,
  activeService,
  editing,
  busy,
  onChange,
  onSubmit
}: {
  form: AccountListingCreate;
  services: AccountService[];
  activeService?: AccountService;
  editing: boolean;
  busy: boolean;
  onChange: (value: AccountListingCreate) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <form className="gb-form" onSubmit={onSubmit}>
      <label className="ui-field">
        <span>Сервис</span>
        <select
          disabled={editing}
          value={form.service_slug}
          onChange={(event) => onChange({ ...form, service_slug: event.target.value })}
        >
          {services.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="ui-field">
        <span>Что продаёте</span>
        <input
          maxLength={100}
          value={form.title}
          placeholder={`${activeService?.name ?? "Сервис"} на месяц`}
          onChange={(event) => onChange({ ...form, title: event.target.value })}
          required
        />
      </label>
      <label className="ui-field">
        <span>Цена, ₸</span>
        <input
          type="number"
          min="1"
          max="10000000"
          value={form.price_kzt}
          onChange={(event) =>
            onChange({ ...form, price_kzt: Number(event.target.value) })
          }
          required
        />
      </label>
      <label className="ui-field">
        <span>Описание</span>
        <textarea
          rows={3}
          maxLength={500}
          value={form.description ?? ""}
          onChange={(event) =>
            onChange({ ...form, description: event.target.value })
          }
          placeholder="Необязательно"
        />
      </label>
      <AppButton
        fullWidth
        type="submit"
        disabled={busy || form.title.trim().length < 2}
      >
        {editing ? "Сохранить" : "Опубликовать на 30 дней"}
      </AppButton>
      <p className="gb-safety-note">
        Не указывайте логин, пароль, номер карты или банковские реквизиты. Все условия сделки продавец согласует с покупателем напрямую.
      </p>
    </form>
  );
}
