import { useState } from "react";
import { createPortal } from "react-dom";
import { Button as AppButton } from "../ui";
import { ServiceLogo } from "../branding";
import { SystemSymbol } from "../SystemSymbol";
import type { AccountListingCreate, AccountService } from "../../types";
import {
  DELIVERY_OPTIONS,
  accountListingTitle,
  findPlan,
  matchesServiceSearch,
  periodTitle,
  planPeriodsLabel,
  selectionForPlan,
  selectionForService
} from "./accountPlans";

function formatKzt(value: number) {
  return `${value.toLocaleString("ru-KZ")} ₸`;
}

/**
 * Sell an account: service, what the buyer gets, an official plan, price.
 * No free text: the title is built from the choice.
 */
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
  const [search, setSearch] = useState("");
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const plan = findPlan(activeService, form.plan_code);
  const deliveries = activeService?.deliveries ?? [];
  const visibleServices = editing
    ? services.filter((item) => item.slug === form.service_slug)
    : services.filter((item) => item.slug === form.service_slug || matchesServiceSearch(item, search));
  const priceInvalid = !Number.isInteger(form.price_kzt) || form.price_kzt < 1;
  const ready = Boolean(activeService && plan && plan.periods.includes(form.period_months));
  const title = activeService && plan ? accountListingTitle(activeService, plan, form.period_months, form.delivery) : "";
  const deliveryHelper = DELIVERY_OPTIONS.find((option) => option.value === form.delivery)?.helper;

  return (
    <form className="gb-form account-form" data-testid="account-listing-form" onSubmit={onSubmit}>
      <div className="ui-field">
        <span>Сервис</span>
        {editing ? null : (
          <div className="account-search">
            <SystemSymbol name="magnifyingglass" size={16} />
            <input
              type="search"
              inputMode="search"
              aria-label="Найти сервис"
              data-testid="account-service-search"
              placeholder="Найти сервис: «чат», «телеграм»…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        )}
        <div className="account-service-ribbon" role="radiogroup" aria-label="Сервис">
          {visibleServices.map((item) => {
            const selected = item.slug === form.service_slug;
            return (
              <button
                key={item.slug}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={editing && !selected}
                data-testid={`account-service-${item.slug}`}
                className="account-service-tile"
                onClick={() => {
                  if (!selected) onChange(selectionForService(form, item));
                }}
              >
                <ServiceLogo serviceSlug={item.slug} serviceName={item.name} size={32} />
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
        {visibleServices.length <= 1 && search.trim() && !editing ? (
          <small className="field-helper" data-testid="account-service-empty">
            Других сервисов по запросу «{search.trim()}» нет. Продаём только официальные тарифы.
          </small>
        ) : null}
      </div>

      {deliveries.length > 1 ? (
        <div className="ui-field">
          <span>Что получит покупатель</span>
          <div className="account-segmented" role="radiogroup" aria-label="Что получит покупатель">
            {DELIVERY_OPTIONS.filter((option) => deliveries.includes(option.value)).map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={form.delivery === option.value}
                data-testid={`account-delivery-${option.value}`}
                onClick={() => onChange({ ...form, delivery: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
          {deliveryHelper ? <small className="field-helper">{deliveryHelper}</small> : null}
        </div>
      ) : null}

      <div className="ui-field">
        <span>Тариф</span>
        <button
          type="button"
          className="account-plan-row"
          data-testid="account-plan-row"
          disabled={!activeService?.plans?.length}
          aria-haspopup="dialog"
          onClick={() => setPlanSheetOpen(true)}
        >
          <span className="account-plan-row-copy">
            <strong>{plan?.full_name ?? "Выберите тариф"}</strong>
            {plan ? <span>{periodTitle(form.period_months)}</span> : null}
          </span>
          <SystemSymbol name="chevron.forward" size={18} />
        </button>
      </div>

      <label className="ui-field">
        <span>Цена, ₸</span>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          max="10000000"
          data-testid="account-price-input"
          aria-invalid={priceInvalid || undefined}
          value={form.price_kzt}
          onChange={(event) => onChange({ ...form, price_kzt: Number(event.target.value) })}
          required
        />
      </label>

      {activeService && plan ? (
        <div className="gb-preview" data-testid="account-preview">
          <ServiceLogo serviceSlug={activeService.slug} serviceName={activeService.name} size={40} />
          <div className="gb-preview-copy">
            <span className="gb-preview-caption">Так увидят покупатели</span>
            <strong data-testid="account-preview-title">{title}</strong>
          </div>
          <div className="gb-preview-price">
            <strong>{formatKzt(form.price_kzt || 0)}</strong>
          </div>
        </div>
      ) : null}

      <p className="gb-pay-first">
        Данные для входа передайте покупателю в Telegram после подтверждения заявки. Мы их не храним.
      </p>

      <AppButton fullWidth type="submit" disabled={busy || !ready || priceInvalid}>
        {busy ? "Сохраняем..." : editing ? "Сохранить" : "Опубликовать на 30 дней"}
      </AppButton>

      {planSheetOpen && activeService ? (
        <AccountPlanSheet
          service={activeService}
          form={form}
          onChange={onChange}
          onClose={() => setPlanSheetOpen(false)}
        />
      ) : null}
    </form>
  );
}

function AccountPlanSheet({
  service,
  form,
  onChange,
  onClose
}: {
  service: AccountService;
  form: AccountListingCreate;
  onChange: (value: AccountListingCreate) => void;
  onClose: () => void;
}) {
  const plan = findPlan(service, form.plan_code);
  // Portal: a transformed ancestor would otherwise pin the fixed sheet inside the form.
  return createPortal(
    <div className="account-sheet-backdrop" onClick={onClose}>
      <div
        className="account-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-plan-sheet-title"
        data-testid="account-plan-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="account-sheet-handle" aria-hidden />
        <h2 id="account-plan-sheet-title">Тариф {service.name}</h2>
        <p className="field-helper">Только официальные тарифы. Срок указан справа.</p>
        <div className="account-plan-list" role="radiogroup" aria-label="Тариф">
          {(service.plans ?? []).map((item) => (
            <button
              key={item.code}
              type="button"
              role="radio"
              aria-checked={item.code === form.plan_code}
              data-testid={`account-plan-${item.code}`}
              onClick={() => onChange(selectionForPlan(form, item))}
            >
              <strong>{item.name}</strong>
              <span>{planPeriodsLabel(item)}</span>
            </button>
          ))}
        </div>
        {plan && plan.periods.length > 1 ? (
          <div className="ui-field">
            <span>Срок</span>
            <div className="account-segmented" role="radiogroup" aria-label="Срок">
              {plan.periods.map((months) => (
                <button
                  key={months}
                  type="button"
                  role="radio"
                  aria-checked={form.period_months === months}
                  data-testid={`account-period-${months}`}
                  onClick={() => onChange({ ...form, period_months: months })}
                >
                  {periodTitle(months)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <AppButton fullWidth type="button" data-testid="account-plan-done" onClick={onClose}>
          Готово
        </AppButton>
      </div>
    </div>,
    document.body
  );
}
