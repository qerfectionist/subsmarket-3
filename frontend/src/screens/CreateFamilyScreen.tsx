import { useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Button as AppButton } from "../components/ui";
import { CREATE_TITLES, CreateShell } from "../components/CreateCategoryPicker";
import { CreateFamilyServiceStep } from "../components/families/CreateFamilyServiceStep";
import { CreateFamilyTermsStep } from "../components/families/CreateFamilyTermsStep";
import { CreateFamilyPayoutStep } from "../components/families/CreateFamilyPayoutStep";
import {
  CREATE_STEPS,
  fixHint,
  stepErrorFields,
  stepHasErrors,
  validateCreateForm,
  type CreateStep
} from "../components/families/createFamilyForm";
import { useTelegramBackButton, useTelegramMainButton } from "../hooks/useTelegramAppEffects";
import { canUseTelegramMainButton } from "../telegram";
import type { FamilyCreate, FamilyService, FamilyType } from "../types";

/** The title of each step is the question it asks. */
const STEP_QUESTIONS: Record<CreateStep, (familyType: FamilyType) => string> = {
  service: (familyType) => (familyType === "tariff" ? "Какой тариф делите?" : "Какой сервис делите?"),
  terms: () => "Сколько стоит и сколько мест?",
  payout: () => "Куда переводить деньги?"
};

export function CreateFamilyScreen({
  services,
  service,
  familyType,
  createForm,
  busy,
  onPickService,
  initialStep = "service",
  onBack,
  onChangeForm,
  onSubmit
}: {
  services: FamilyService[];
  service: FamilyService | null;
  familyType: FamilyType;
  createForm: FamilyCreate;
  busy: string | null;
  onPickService: (service: FamilyService) => void;
  /** «Условия» when a popular service was picked on «Создать». */
  initialStep?: CreateStep;
  onBack: () => void;
  onChangeForm: Dispatch<SetStateAction<FamilyCreate>>;
  onSubmit: (event: FormEvent) => void;
}) {
  const [step, setStep] = useState<CreateStep>(initialStep);
  const [attempted, setAttempted] = useState<ReadonlySet<CreateStep>>(() => new Set());
  const errors = validateCreateForm(createForm, service);
  const stepIndex = CREATE_STEPS.findIndex((item) => item.id === step);
  const isLast = step === "payout";
  const blocked = stepHasErrors(step, errors) || (isLast && busy !== null);
  const hint = fixHint(stepErrorFields(step, errors), isLast ? "создать семью" : "продолжить");

  function goTo(next: CreateStep) {
    setStep(next);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function goBack() {
    if (stepIndex === 0) onBack();
    else goTo(CREATE_STEPS[stepIndex - 1].id);
  }

  useTelegramBackButton(true, goBack);

  const formRef = useRef<HTMLFormElement | null>(null);
  function advance() {
    if (stepHasErrors(step, errors)) {
      setAttempted((current) => new Set(current).add(step));
      return;
    }
    if (isLast) formRef.current?.requestSubmit();
    else goTo(CREATE_STEPS[stepIndex + 1].id);
  }

  function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isLast) {
      // Enter inside a step moves on instead of creating the family.
      advance();
      return;
    }
    if (Object.keys(errors).length === 0 && busy === null) onSubmit(event);
  }

  const mainLabel = isLast
    ? "Создать семью"
    : step === "service" && service
      ? `Далее · ${service.name}`
      : "Далее";

  // Inside Telegram the main action moves to the native bottom button; the page
  // keeps its own buttons for the browser and tests.
  const [nativeMainButton] = useState(canUseTelegramMainButton);
  useTelegramMainButton({
    visible: nativeMainButton,
    label: mainLabel,
    onClick: () => {
      if (!blocked) advance();
    },
    isPending: busy !== null,
    disabled: blocked
  });

  return (
    <CreateShell
      title={STEP_QUESTIONS[step](familyType)}
      kicker={CREATE_TITLES[familyType]}
      onBack={goBack}
      testId="create-family-screen"
    >
      <div className="screen-body-inset">
        <form
          ref={formRef}
          className="create-step-form"
          data-testid="create-family-form"
          data-step={step}
          onSubmit={handleFormSubmit}
        >
          {step === "service" ? (
            <CreateFamilyServiceStep
              services={services.filter((item) =>
                familyType === "tariff" ? item.family_type === "tariff" : item.family_type !== "tariff"
              )}
              selectedId={createForm.service_id}
              onPick={onPickService}
            />
          ) : null}
          {step === "terms" && service ? (
            <CreateFamilyTermsStep
              form={createForm}
              errors={errors}
              service={service}
              showAllErrors={attempted.has("terms")}
              onChangeForm={onChangeForm}
            />
          ) : null}
          {step === "payout" && service ? (
            <CreateFamilyPayoutStep
              form={createForm}
              errors={errors}
              service={service}
              showAllErrors={attempted.has("payout")}
              onEditTerms={() => goTo("terms")}
              onChangeForm={onChangeForm}
            />
          ) : null}

          <div className="create-wizard-footer">
            {/* Where the person is: three bars above the button. */}
            <div className="create-progress-wrap">
              <p className="visually-hidden">
                Шаг {stepIndex + 1} из {CREATE_STEPS.length} · {CREATE_STEPS[stepIndex].title}
              </p>
              <ol className="create-progress" aria-label="Шаги">
                {CREATE_STEPS.map((item, index) => {
                  const state = index < stepIndex ? "done" : index === stepIndex ? "current" : "todo";
                  return (
                    <li
                      key={item.id}
                      data-state={state}
                      aria-current={state === "current" ? "step" : undefined}
                      data-testid={`create-progress-${item.id}`}
                    >
                      <span className="create-progress-bar" />
                      <span className="visually-hidden">
                        {index + 1}. {item.title}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
            {hint && step !== "service" ? (
              <p className="create-fix-hint" data-testid="create-fix-hint">
                {hint}
              </p>
            ) : null}
            {nativeMainButton ? null : (
              <div className="wizard-nav" data-single={stepIndex === 0 || undefined}>
                {/* Step 1 has one way on: the service is picked, «Далее». */}
                {stepIndex > 0 ? (
                  <AppButton
                    key="back"
                    type="button"
                    variant="secondary"
                    data-testid="create-family-back"
                    onClick={goBack}
                  >
                    Назад
                  </AppButton>
                ) : null}
                {isLast ? (
                  <AppButton
                    key="submit"
                    type="submit"
                    data-testid="create-family-submit"
                    disabled={blocked}
                  >
                    Создать семью
                  </AppButton>
                ) : (
                  <AppButton
                    key="next"
                    type="submit"
                    data-testid="create-family-next"
                    disabled={blocked}
                  >
                    {mainLabel}
                  </AppButton>
                )}
              </div>
            )}
            {isLast ? (
              <small className="field-helper create-final-note">
                После создания не поменять сервис и число мест.
              </small>
            ) : null}
          </div>
        </form>
      </div>
    </CreateShell>
  );
}
