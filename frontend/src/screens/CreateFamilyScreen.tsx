import { useCallback, useState, type Dispatch, FormEvent, SetStateAction } from "react";

import { FamilyTypeSwitch, Panel } from "../components/layout";
import {
  useTelegramBackButton,
  useTelegramMainButton
} from "../hooks/useTelegramAppEffects";
import { serviceTitle } from "../format";
import { bankLabels, familyTypeLabels, periodLabels } from "../labels";
import type { FamilyCreate, FamilyService, FamilyType } from "../types";

const PHONE_RE = /^\+?7\d{10}$/;
const TODAY = new Date().toISOString().split("T")[0];

const WIZARD_STEPS = [
  { id: "service", label: "Сервис" },
  { id: "terms", label: "Условия" },
  { id: "payment", label: "Оплата" },
  { id: "details", label: "Описание" }
] as const;

type WizardStep = (typeof WIZARD_STEPS)[number]["id"];

interface FieldErrors {
  payment_phone?: string;
  total_price_kzt?: string;
  payment_day?: string;
  next_payment_date?: string;
  max_members?: string;
}

function validateForm(form: FamilyCreate, service: FamilyService | null): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.payment_phone.trim()) {
    errors.payment_phone = "Укажите номер телефона для оплаты";
  } else if (!PHONE_RE.test(form.payment_phone.replace(/[\s()-]/g, ""))) {
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

function stepErrors(step: WizardStep, errors: FieldErrors) {
  if (step === "terms") {
    return ["total_price_kzt", "payment_day", "next_payment_date", "max_members"].some(
      (key) => key in errors
    );
  }
  if (step === "payment") {
    return "payment_phone" in errors;
  }
  return false;
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
  const [step, setStep] = useState<WizardStep>("service");
  const stepIndex = WIZARD_STEPS.findIndex((item) => item.id === step);
  const memberShare = calculatePreviewShare(
    createForm.total_price_kzt,
    createForm.max_members
  );
  const freeMemberSlots = Math.max(0, createForm.max_members - 1);
  const familySubject = familyType === "tariff" ? "тарифа" : "подписки";
  const errors = validateForm(createForm, service);
  const hasErrors = Object.keys(errors).length > 0;
  const canAdvance = !stepErrors(step, errors);

  function goNext() {
    const next = WIZARD_STEPS[stepIndex + 1];
    if (next) setStep(next.id);
  }

  const goBack = useCallback(() => {
    const prev = WIZARD_STEPS[stepIndex - 1];
    if (prev) setStep(prev.id);
  }, [stepIndex]);

  useTelegramBackButton(stepIndex > 0, goBack);

  function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    if (hasErrors) {
      return;
    }
    if (step !== "details") {
      if (!stepErrors(step, errors)) {
        goNext();
      }
      return;
    }
    onSubmit(event);
  }

  const submitDisabled =
    busy !== null ||
    servicesCount === 0 ||
    hasErrors ||
    (step !== "details" && !canAdvance);
  const submitLabel =
    step === "details" ? "Создать семью" : canAdvance ? "Далее" : "Исправьте поля";

  const handleMainButtonClick = useCallback(() => {
    if (step === "details") {
      if (!hasErrors) {
        void onSubmit({ preventDefault: () => {} } as FormEvent);
      }
      return;
    }
    if (canAdvance) {
      goNext();
    }
  }, [canAdvance, goNext, hasErrors, onSubmit, step]);

  useTelegramMainButton({
    visible: true,
    label: submitLabel,
    onClick: handleMainButtonClick,
    isPending: busy !== null,
    disabled: submitDisabled
  });

  return (
    <Panel
      title="Создать семью"
      description={`${familyTypeLabels[familyType]} · доступ и оплата после заявки`}
    >
      <div className="screen-body-inset">
      <FamilyTypeSwitch value={familyType} onChange={onChangeFamilyType} />

      <div className="wizard-progress" aria-hidden>
        <div
          className="wizard-progress-bar"
          style={{ width: `${((stepIndex + 1) / WIZARD_STEPS.length) * 100}%` }}
        />
      </div>

      <ol className="wizard-steps" aria-label="Шаги создания семьи">
        {WIZARD_STEPS.map((item, index) => (
          <li
            key={item.id}
            className={
              index < stepIndex
                ? "wizard-step wizard-step-done"
                : index === stepIndex
                  ? "wizard-step wizard-step-current"
                  : "wizard-step"
            }
            aria-current={index === stepIndex ? "step" : undefined}
          >
            <span className="wizard-step-index">{index + 1}</span>
            <span className="wizard-step-label">{item.label}</span>
          </li>
        ))}
      </ol>

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
          Владелец входит в лимит. Общая цена делится на всех и округляется вверх
          до 50 ₸.
        </p>
      </div>

      <form className="form-grid" data-testid="create-family-form" onSubmit={handleFormSubmit}>
        <div className={step === "service" ? "wizard-pane wizard-pane-active" : "wizard-pane"}>
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
                    max_members: Math.min(
                      current.max_members,
                      nextService?.max_members ?? 8
                    )
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
        </div>

        <div className={step === "terms" ? "wizard-pane wizard-pane-active" : "wizard-pane"}>
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
              {errors.max_members ? (
                <small className="field-error" role="alert" aria-live="polite">
                  {errors.max_members}
                </small>
              ) : null}
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
              {errors.total_price_kzt ? (
                <small className="field-error" role="alert" aria-live="polite">
                  {errors.total_price_kzt}
                </small>
              ) : null}
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
              {errors.payment_day ? (
                <small className="field-error" role="alert" aria-live="polite">
                  {errors.payment_day}
                </small>
              ) : null}
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
              {errors.next_payment_date ? (
                <small className="field-error" role="alert" aria-live="polite">
                  {errors.next_payment_date}
                </small>
              ) : null}
            </label>
        </div>

        <div className={step === "payment" ? "wizard-pane wizard-pane-active" : "wizard-pane"}>
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
                required
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
                  Только номер телефона для Kaspi, Halyk, Freedom или Jusan. Номер
                  карты и IBAN нельзя указывать.
                </small>
              )}
            </label>
        </div>

        <div className={step === "details" ? "wizard-pane wizard-pane-active" : "wizard-pane"}>
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
        </div>

        <div className="create-wizard-footer">
          <div className="wizard-nav">
            {stepIndex > 0 ? (
              <button type="button" className="secondary" onClick={goBack}>
                Назад
              </button>
            ) : null}
            <button
              type="submit"
              data-testid="create-family-submit"
              disabled={submitDisabled}
            >
              {submitLabel}
            </button>
          </div>
        </div>
      </form>
      </div>
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
