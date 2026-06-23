import type { Dispatch, FormEvent, SetStateAction } from "react";

import { FamilyTypeSwitch, Panel } from "../components/layout";
import { serviceTitle } from "../format";
import { bankLabels, familyTypeLabels, periodLabels } from "../labels";
import type { FamilyCreate, FamilyService, FamilyType } from "../types";

const PHONE_RE = /^\+?7\d{10}$/;
const TODAY = new Date().toISOString().split("T")[0];

interface FieldErrors {
  payment_phone?: string;
  total_price_kzt?: string;
  payment_day?: string;
  next_payment_date?: string;
  max_members?: string;
}

function validateForm(form: FamilyCreate, service: FamilyService | null): FieldErrors {
  const errors: FieldErrors = {};
  if (form.payment_phone && !PHONE_RE.test(form.payment_phone.replace(/[\s()-]/g, ""))) {
    errors.payment_phone = "Формат: +7 и 10 цифр (например, +77001234567)";
  }
  if (form.total_price_kzt <= 0) {
    errors.total_price_kzt = "Цена должна быть больше нуля";
  }
  if (form.payment_day < 1 || form.payment_day > 31) {
    errors.payment_day = "День от 1 до 31";
  }
  if (form.next_payment_date && form.next_payment_date < TODAY) {
    errors.next_payment_date = "Дата не может быть в прошлом";
  }
  if (service && form.max_members > service.max_members) {
    errors.max_members = `Максимум для этого сервиса: ${service.max_members}`;
  }
  return errors;
}

export function CreateFamilyScreen({
  familyType,
  typedServices,
  service,
  createForm,
  servicesCount,
  busy,
  onChangeFamilyType,
  onChangeForm,
  onSubmit
}: {
  familyType: FamilyType;
  typedServices: FamilyService[];
  service: FamilyService | null;
  createForm: FamilyCreate;
  servicesCount: number;
  busy: string | null;
  onChangeFamilyType: (familyType: FamilyType) => void;
  onChangeForm: Dispatch<SetStateAction<FamilyCreate>>;
  onSubmit: (event: FormEvent) => void;
}) {
  const memberShare = calculatePreviewShare(
    createForm.total_price_kzt,
    createForm.max_members
  );
  const freeMemberSlots = Math.max(0, createForm.max_members - 1);
  const familySubject = familyType === "tariff" ? "тарифа" : "подписки";
  const errors = validateForm(createForm, service);
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <Panel
      title={`Создать семью: ${familyTypeLabels[familyType].toLowerCase()}`}
      description={`Заполните только условия ${familySubject}. Доступ и оплата идут уже после заявки.`}
    >
      <FamilyTypeSwitch value={familyType} onChange={onChangeFamilyType} />
      <div className="create-preview" data-testid="create-share-preview">
        <div>
          <span>Участник платит</span>
          <strong>{formatKzt(memberShare)}</strong>
        </div>
        <div>
          <span>Свободных мест</span>
          <strong>{freeMemberSlots}</strong>
        </div>
        <p>
          Владелец входит в лимит. Общая цена делится на всех и округляется
          вверх до 50 ₸.
        </p>
      </div>
      <form className="form-grid" data-testid="create-family-form" onSubmit={onSubmit}>
        <label>
          Сервис
          <select
            required
            data-testid="create-service-select"
            value={createForm.service_id}
            onChange={(event) => {
              const nextService = typedServices.find(
                (item) => item.id === event.target.value
              );
              onChangeForm((current) => ({
                ...current,
                service_id: event.target.value,
                max_members: Math.min(current.max_members, nextService?.max_members ?? 8)
              }));
            }}
          >
            {typedServices.map((item) => (
              <option key={item.id} value={item.id}>
                {serviceTitle(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="half">
          Период
          <select
            data-testid="create-period-select"
            value={createForm.period}
            onChange={(event) =>
              onChangeForm((current) => ({
                ...current,
                period: event.target.value as FamilyCreate["period"]
              }))
            }
          >
            {(service?.supported_periods ?? ["monthly"]).map((period) => (
              <option key={period} value={period}>
                {periodLabels[period]}
              </option>
            ))}
          </select>
        </label>
        <label className="half">
          Всего мест
          <input
            min={2}
            max={service?.max_members ?? 8}
            data-testid="create-max-members-input"
            inputMode="numeric"
            type="number"
            aria-invalid={Boolean(errors.max_members)}
            value={createForm.max_members}
            onChange={(event) =>
              onChangeForm((current) => ({
                ...current,
                max_members: Number(event.target.value)
              }))
            }
          />
          {errors.max_members && (
            <small className="field-error" role="alert" aria-live="polite">
              {errors.max_members}
            </small>
          )}
        </label>
        <label className="half">
          Общая цена, ₸
          <input
            min={1}
            data-testid="create-total-price-input"
            inputMode="numeric"
            type="number"
            aria-invalid={Boolean(errors.total_price_kzt)}
            value={createForm.total_price_kzt}
            onChange={(event) =>
              onChangeForm((current) => ({
                ...current,
                total_price_kzt: Number(event.target.value)
              }))
            }
          />
          {errors.total_price_kzt && (
            <small className="field-error" role="alert" aria-live="polite">
              {errors.total_price_kzt}
            </small>
          )}
        </label>
        <label className="half">
          День оплаты
          <input
            min={1}
            max={31}
            data-testid="create-payment-day-input"
            inputMode="numeric"
            type="number"
            aria-invalid={Boolean(errors.payment_day)}
            value={createForm.payment_day}
            onChange={(event) =>
              onChangeForm((current) => ({
                ...current,
                payment_day: Number(event.target.value)
              }))
            }
          />
          {errors.payment_day && (
            <small className="field-error" role="alert" aria-live="polite">
              {errors.payment_day}
            </small>
          )}
        </label>
        <label className="half">
          Следующая дата оплаты
          <input
            data-testid="create-next-payment-date-input"
            type="date"
            aria-invalid={Boolean(errors.next_payment_date)}
            value={createForm.next_payment_date}
            onChange={(event) =>
              onChangeForm((current) => ({
                ...current,
                next_payment_date: event.target.value
              }))
            }
          />
          {errors.next_payment_date && (
            <small className="field-error" role="alert" aria-live="polite">
              {errors.next_payment_date}
            </small>
          )}
        </label>
        <label className="half">
          Банк
          <select
            data-testid="create-bank-select"
            value={createForm.payment_bank}
            onChange={(event) =>
              onChangeForm((current) => ({
                ...current,
                payment_bank: event.target.value as FamilyCreate["payment_bank"]
              }))
            }
          >
            {Object.entries(bankLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Номер телефона для оплаты
          <input
            data-testid="create-payment-phone-input"
            inputMode="tel"
            placeholder="+77001234567"
            aria-invalid={Boolean(errors.payment_phone)}
            value={createForm.payment_phone}
            onChange={(event) =>
              onChangeForm((current) => ({
                ...current,
                payment_phone: event.target.value
              }))
            }
          />
          {errors.payment_phone ? (
            <small className="field-error" role="alert" aria-live="polite">
              {errors.payment_phone}
            </small>
          ) : (
            <small className="field-helper">
              Только номер телефона для Kaspi, Halyk, Freedom или Jusan. Номер карты
              и IBAN нельзя указывать.
            </small>
          )}
        </label>
        <label className="wide">
          Описание
          <textarea
            data-testid="create-description-input"
            rows={3}
            value={createForm.description ?? ""}
            onChange={(event) =>
              onChangeForm((current) => ({
                ...current,
                description: event.target.value
              }))
            }
          />
        </label>
        <label className="wide">
          Правила владельца
          <textarea
            data-testid="create-owner-rules-input"
            rows={3}
            value={createForm.owner_rules ?? ""}
            onChange={(event) =>
              onChangeForm((current) => ({
                ...current,
                owner_rules: event.target.value
              }))
            }
          />
        </label>
        <div className="wide summary">
          Реквизиты увидит только участник после подтверждения доступа. Номера
          карт и IBAN запрещены.
        </div>
        <button
          type="submit"
          data-testid="create-family-submit"
          disabled={busy !== null || servicesCount === 0 || hasErrors}
        >
          Создать семью
        </button>
      </form>
    </Panel>
  );
}

function calculatePreviewShare(totalPriceKzt: number, maxMembers: number) {
  if (totalPriceKzt <= 0 || maxMembers <= 0) {
    return 0;
  }
  return Math.ceil(Math.ceil(totalPriceKzt / maxMembers) / 50) * 50;
}

function formatKzt(value: number) {
  return new Intl.NumberFormat("ru-KZ").format(value) + " ₸";
}
