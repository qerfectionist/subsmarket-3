import { useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Button as AppButton, ListItem } from "../components/ui";
import { FamilyTypeSwitch, Panel, ProductScopeSwitch } from "../components/layout";
import { ServiceLogo } from "../components/branding";
import { SystemSymbol } from "../components/SystemSymbol";
import { CreateFamilySectionFields } from "../components/families/CreateFamilySections";
import {
  CREATE_SECTIONS,
  SECTION_HINTS,
  SECTION_LEADS,
  firstSectionError,
  isSectionDone,
  pluralRu,
  sectionHasErrors,
  sectionSummary,
  validateCreateForm,
  type CreateSection
} from "../components/families/createFamilyForm";
import { useTelegramBackButton, useTelegramMainButton } from "../hooks/useTelegramAppEffects";
import { canUseTelegramMainButton } from "../telegram";
import { serviceTitle } from "../format";
import type { FamilyCreate, FamilyService, FamilyType } from "../types";

const REQUIRED_SECTIONS = CREATE_SECTIONS.filter((item) => item.required).map((item) => item.id);

export function CreateFamilyScreen({
  familyType,
  typedServices,
  service,
  createForm,
  servicesCount,
  busy,
  onChangeFamilyType,
  onCreateAccounts,
  onCreateGigabytes,
  onBack,
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
  onCreateAccounts: () => void;
  onCreateGigabytes: () => void;
  onBack: () => void;
  onChangeForm: Dispatch<SetStateAction<FamilyCreate>>;
  onSubmit: (event: FormEvent) => void;
}) {
  const [openSection, setOpenSection] = useState<CreateSection | null>(null);
  const [visited, setVisited] = useState<ReadonlySet<CreateSection>>(() => new Set());
  const errors = validateCreateForm(createForm, service);
  const serviceName = service ? serviceTitle(service) : null;

  const isDone = (section: CreateSection, seen: ReadonlySet<CreateSection> = visited) =>
    isSectionDone(section, errors, seen, createForm);
  const unfinished = REQUIRED_SECTIONS.filter((section) => !isDone(section));
  const ready = unfinished.length === 0 && Object.keys(errors).length === 0;

  /** Where «Далее» leads from the open section: the next required section left. */
  function nextAfter(section: CreateSection): CreateSection | null {
    const seen = new Set(visited).add(section);
    const order = REQUIRED_SECTIONS;
    const start = order.indexOf(section);
    const rotated = [...order.slice(start + 1), ...order.slice(0, Math.max(start, 0))];
    return rotated.find((item) => !isDone(item, seen)) ?? null;
  }

  function leaveSection(goTo: CreateSection | null) {
    if (openSection) {
      const section = openSection;
      setVisited((current) => new Set(current).add(section));
    }
    setOpenSection(goTo);
  }

  useTelegramBackButton(true, () => (openSection ? leaveSection(null) : onBack()));

  function changeFamilyType(next: FamilyType) {
    // A new type swaps the service list, so the checked sections start over.
    setVisited(new Set());
    onChangeFamilyType(next);
  }

  function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    if (openSection) {
      // Enter inside a section moves on instead of creating the family.
      if (!sectionHasErrors(openSection, errors)) leaveSection(nextAfter(openSection));
      return;
    }
    if (ready && busy === null) onSubmit(event);
  }

  const openMeta = openSection ? CREATE_SECTIONS.find((item) => item.id === openSection) : null;
  const nextSection = openSection ? nextAfter(openSection) : null;

  // Inside Telegram the main action moves to the native bottom button; the page
  // keeps its own buttons for the browser and tests.
  const [nativeMainButton] = useState(canUseTelegramMainButton);
  const formRef = useRef<HTMLFormElement | null>(null);
  const mainAction = openSection
    ? {
        label: nextSection ? "Далее" : "Готово",
        disabled: sectionHasErrors(openSection, errors),
        run: () => leaveSection(nextSection)
      }
    : ready
      ? {
          label: "Создать семью",
          disabled: busy !== null || servicesCount === 0,
          run: () => formRef.current?.requestSubmit()
        }
      : { label: "Продолжить", disabled: false, run: () => setOpenSection(unfinished[0] ?? null) };
  useTelegramMainButton({
    visible: nativeMainButton,
    label: mainAction.label,
    onClick: () => {
      if (!mainAction.disabled) mainAction.run();
    },
    isPending: busy !== null,
    disabled: mainAction.disabled
  });

  return (
    <Panel title="Создать семью">
      <div className="screen-body-inset">
        {openSection === null ? (
          <>
            <ProductScopeSwitch
              value="families"
              onChange={(value) => {
                if (value === "accounts") onCreateAccounts();
                if (value === "gigabytes") onCreateGigabytes();
              }}
            />
            <FamilyTypeSwitch value={familyType} onChange={changeFamilyType} />
          </>
        ) : null}

        <form
          ref={formRef}
          className="form-grid"
          data-testid="create-family-form"
          onSubmit={handleFormSubmit}
        >
          {openSection === null || !openMeta ? (
            <>
              <p className="create-hub-status" data-testid="create-hub-status">
                {unfinished.length === 0
                  ? "Всё заполнено, можно создавать"
                  : `Осталось ${unfinished.length} ${pluralRu(unfinished.length, "раздел", "раздела", "разделов")}`}
              </p>
              <div className="family-overview-card create-hub-card">
                <ol className="create-hub-list" aria-label="Разделы семьи">
                  {CREATE_SECTIONS.map((item, index) => {
                    const done = isDone(item.id);
                    const error = visited.has(item.id)
                      ? firstSectionError(item.id, errors)
                      : undefined;
                    const state = done ? "done" : error ? "error" : "todo";
                    const description = done
                      ? sectionSummary(item.id, createForm, serviceName)
                      : (error ?? SECTION_HINTS[item.id]);
                    const showLogo = item.id === "service" && service && done;
                    return (
                      <li key={item.id}>
                        <ListItem
                          data-testid={`create-section-${item.id}`}
                          data-state={state}
                          className={`create-hub-row create-hub-row-${state}`}
                          label={item.title}
                          description={description}
                          startAdornment={
                            showLogo ? (
                              <ServiceLogo
                                serviceSlug={service.slug}
                                serviceName={service.name}
                                familyType={service.family_type === "tariff" ? "tariff" : "subscription"}
                                size={32}
                                loading="eager"
                              />
                            ) : done ? (
                              <span className="create-hub-check">
                                <SystemSymbol name="checkmark" size={26} />
                              </span>
                            ) : (
                              <span className="wizard-step-index">{index + 1}</span>
                            )
                          }
                          endAdornment={
                            state === "error" ? (
                              <SystemSymbol
                                name="exclamationmark.circle"
                                size={20}
                                className="create-hub-error-icon"
                              />
                            ) : (
                              <SystemSymbol
                                name="chevron.forward"
                                size={18}
                                className="create-hub-chevron"
                              />
                            )
                          }
                          onClick={() => setOpenSection(item.id)}
                        />
                      </li>
                    );
                  })}
                </ol>
              </div>
              <div className="create-wizard-footer">
                {nativeMainButton ? null : (
                  <div className="wizard-nav">
                    {ready ? (
                      <AppButton
                        key="submit"
                        type="submit"
                        data-testid="create-family-submit"
                        disabled={busy !== null || servicesCount === 0}
                      >
                        Создать семью
                      </AppButton>
                    ) : (
                      <AppButton
                        key="continue"
                        type="button"
                        data-testid="create-family-continue"
                        onClick={() => setOpenSection(unfinished[0] ?? null)}
                      >
                        Продолжить
                      </AppButton>
                    )}
                  </div>
                )}
                <small className="field-helper create-hub-note">
                  Сервис, период оплаты, число мест и правила после создания не поменять.
                </small>
              </div>
            </>
          ) : (
            <div className="wizard-pane wizard-pane-active" data-create-section={openSection}>
              <div className="create-section-head">
                <h2>{openMeta.title}</h2>
                <p>{SECTION_LEADS[openSection]}</p>
              </div>
              <CreateFamilySectionFields
                section={openSection}
                familyType={familyType}
                typedServices={typedServices}
                form={createForm}
                errors={errors}
                service={service}
                onChangeForm={onChangeForm}
                onServicePicked={(planMissing) => {
                  if (!planMissing) leaveSection(nextAfter("service"));
                }}
              />
              {nativeMainButton ? null : (
                <div className="create-wizard-footer">
                  <div className="wizard-nav">
                    <AppButton
                      key="back"
                      type="button"
                      variant="secondary"
                      data-testid="create-family-back"
                      onClick={() => leaveSection(null)}
                    >
                      К разделам
                    </AppButton>
                    <AppButton
                      key="done"
                      type="button"
                      data-testid="create-section-done"
                      disabled={sectionHasErrors(openSection, errors)}
                      onClick={() => leaveSection(nextSection)}
                    >
                      {nextSection ? "Далее" : "Готово"}
                    </AppButton>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </Panel>
  );
}
