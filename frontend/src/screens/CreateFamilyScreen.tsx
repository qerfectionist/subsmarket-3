import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Button as AppButton } from "../components/ui";
import { CreateShell } from "../components/CreateCategoryPicker";
import { CreateFamilyServiceStep } from "../components/families/CreateFamilyServiceStep";
import { CreateFamilyTermsStep } from "../components/families/CreateFamilyTermsStep";
import type { PreviewOwner } from "../components/families/CreateFamilyPreview";
import { CreateFamilyPayoutStep } from "../components/families/CreateFamilyPayoutStep";
import { PAYOUT_START, payoutDone, type PayoutProgress } from "../components/families/createPayoutParts";
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
  service: (familyType) => (familyType === "tariff" ? "Какой тариф?" : "Какой сервис?"),
  terms: () => "Цена и места",
  payout: () => "Выплата"
};

export function CreateFamilyScreen({
  services,
  service,
  familyType,
  createForm,
  busy,
  onPickService,
  initialStep = "service",
  initialPayoutProgress = PAYOUT_START,
  onWizardChange,
  owner,
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
  /** How far «Выплата» was walked, when a saved draft is resumed. */
  initialPayoutProgress?: PayoutProgress;
  /** Reports the furthest step reached and «Выплата» progress, so the draft keeps them too. */
  onWizardChange?: (state: { step: CreateStep; progress: PayoutProgress }) => void;
  /** The organiser as the Market card on step 2 shows them. */
  owner: PreviewOwner;
  onBack: () => void;
  onChangeForm: Dispatch<SetStateAction<FamilyCreate>>;
  onSubmit: (event: FormEvent) => void;
}) {
  const [step, setStep] = useState<CreateStep>(initialStep);
  const [attempted, setAttempted] = useState<ReadonlySet<CreateStep>>(() => new Set());
  // How far «Выплата» has been walked: kept here so going back to «Цена и места» loses nothing.
  const [payoutProgress, setPayoutProgress] = useState<PayoutProgress>(initialPayoutProgress);
  const [furthestStep, setFurthestStep] = useState<CreateStep>(initialStep);
  useEffect(() => {
    // The furthest step reached is what a draft resumes on: going back to the
    // menu through «Назад» must not rewind it to «Сервис».
    if (CREATE_STEPS.findIndex((item) => item.id === step) > CREATE_STEPS.findIndex((item) => item.id === furthestStep)) {
      setFurthestStep(step);
      return;
    }
    onWizardChange?.({ step: furthestStep, progress: payoutProgress });
    // The callback is App's state setter; only the values matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, furthestStep, payoutProgress]);
  const errors = validateCreateForm(createForm, service);
  // «Выплата» asks three things: its bar below fills a third for each one answered.
  const payoutAnswered =
    (payoutProgress.stage >= 1 ? 1 : 0) + (payoutProgress.stage >= 2 ? 1 : 0) + (payoutProgress.chat ? 1 : 0);
  const stepIndex = CREATE_STEPS.findIndex((item) => item.id === step);
  const isLast = step === "payout";
  const blocked = stepHasErrors(step, errors) || (isLast && (busy !== null || !payoutDone(payoutProgress)));
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
    if (Object.keys(errors).length === 0 && busy === null && payoutDone(payoutProgress)) onSubmit(event);
  }

  // The picked service shows on its tile, so the button only says what it does.
  const mainLabel = isLast ? "Создать семью" : "Далее";

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
      onBack={goBack}
      testId="create-family-screen"
    >
      <div className="screen-body-inset">
        <form
          ref={formRef}
          className="create-step-form"
          data-testid="create-family-form"
          data-step={step}
          data-family-type={familyType}
          onSubmit={handleFormSubmit}
        >
          {step === "service" ? (
            <CreateFamilyServiceStep
              services={services.filter((item) =>
                familyType === "tariff" ? item.family_type === "tariff" : item.family_type !== "tariff"
              )}
              selectedId={createForm.service_id}
              onPick={onPickService}
              onClear={() => onChangeForm((current) => ({ ...current, service_id: "" }))}
            />
          ) : null}
          {step === "terms" && service ? (
            <CreateFamilyTermsStep
              form={createForm}
              errors={errors}
              service={service}
              showAllErrors={attempted.has("terms")}
              owner={owner}
              onChangeForm={onChangeForm}
            />
          ) : null}
          {step === "payout" && service ? (
            <CreateFamilyPayoutStep
              form={createForm}
              errors={errors}
              service={service}
              owner={owner}
              showAllErrors={attempted.has("payout")}
              progress={payoutProgress}
              onProgress={setPayoutProgress}
              onEditTerms={() => goTo("terms")}
              onChangeForm={onChangeForm}
            />
          ) : null}

          <div className="create-wizard-footer">
            {/* Where the person is: three bars above the button, each named under it. */}
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
                      data-fill={item.id === "payout" && state === "current" ? payoutAnswered : undefined}
                      style={
                        item.id === "payout" && state === "current"
                          ? ({ "--create-step-fill": payoutAnswered / 3 } as CSSProperties)
                          : undefined
                      }
                    >
                      <span className="create-progress-bar" />
                      <span className="visually-hidden">{index + 1}. </span>
                      <span className="create-progress-label">{item.title}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
            {/* Only after a try: an untouched form does not nag, the empty fields speak for themselves. */}
            {hint && step !== "service" && attempted.has(step) ? (
              <p className="create-fix-hint" data-testid="create-fix-hint">
                {hint}
              </p>
            ) : null}
            {nativeMainButton ? null : (
              <div className="wizard-nav" data-single>
                {/* One way on; going back is the arrow in the header. */}
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
          </div>
        </form>
      </div>
    </CreateShell>
  );
}
