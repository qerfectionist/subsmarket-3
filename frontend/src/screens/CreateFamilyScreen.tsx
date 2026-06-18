import type { Dispatch, FormEvent, SetStateAction } from "react";

import { FamilyTypeSwitch, Panel } from "../components/layout";
import { serviceTitle } from "../format";
import { bankLabels, familyTypeLabels, periodLabels } from "../labels";
import type { FamilyCreate, FamilyService, FamilyType } from "../types";

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
  return (
    <Panel
      title={`Создать семью: ${familyTypeLabels[familyType].toLowerCase()}`}
      description="Владелец тоже занимает одно место. Цена делится на всех участников автоматически."
    >
      <FamilyTypeSwitch value={familyType} onChange={onChangeFamilyType} />
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
        <label>
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
        <label>
          Всего мест
          <input
            min={2}
            max={service?.max_members ?? 8}
            data-testid="create-max-members-input"
            type="number"
            value={createForm.max_members}
            onChange={(event) =>
              onChangeForm((current) => ({
                ...current,
                max_members: Number(event.target.value)
              }))
            }
          />
        </label>
        <label>
          Общая цена, ₸
          <input
            min={1}
            data-testid="create-total-price-input"
            type="number"
            value={createForm.total_price_kzt}
            onChange={(event) =>
              onChangeForm((current) => ({
                ...current,
                total_price_kzt: Number(event.target.value)
              }))
            }
          />
        </label>
        <label>
          День оплаты
          <input
            min={1}
            max={31}
            data-testid="create-payment-day-input"
            type="number"
            value={createForm.payment_day}
            onChange={(event) =>
              onChangeForm((current) => ({
                ...current,
                payment_day: Number(event.target.value)
              }))
            }
          />
        </label>
        <label>
          Следующая дата оплаты
          <input
            data-testid="create-next-payment-date-input"
            type="date"
            value={createForm.next_payment_date}
            onChange={(event) =>
              onChangeForm((current) => ({
                ...current,
                next_payment_date: event.target.value
              }))
            }
          />
        </label>
        <label>
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
            placeholder="+77001234567"
            value={createForm.payment_phone}
            onChange={(event) =>
              onChangeForm((current) => ({
                ...current,
                payment_phone: event.target.value
              }))
            }
          />
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
          Доля участника будет рассчитана backend-ом и округлена вверх до 50 ₸.
        </div>
        <button
          type="submit"
          data-testid="create-family-submit"
          disabled={busy !== null || servicesCount === 0}
        >
          Создать семью
        </button>
      </form>
    </Panel>
  );
}
