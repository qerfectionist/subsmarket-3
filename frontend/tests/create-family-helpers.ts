import { expect, type Page } from "@playwright/test";

/** Steps of the create-family wizard, in order. */
const STEPS = ["service", "terms", "payout"] as const;
type Step = (typeof STEPS)[number];

const FIELD_STEP: Record<string, Step> = {
  "create-plan-name-input": "terms",
  "create-full-speed-input": "terms",
  "create-total-price-input": "terms",
  "create-max-members-input": "terms",
  "create-payment-day-input": "terms",
  "create-payment-phone-input": "payout",
  "create-recipient-name-input": "payout",
  "create-owner-rules-input": "payout"
};

function form(page: Page) {
  return page.getByTestId("create-family-form");
}

async function currentStep(page: Page): Promise<Step> {
  return (await form(page).getAttribute("data-step")) as Step;
}

/** Walks the wizard with «Далее» / «Назад» until `target` is open. */
export async function goToCreateStep(page: Page, target: Step) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const step = await currentStep(page);
    if (step === target) return;
    const forward = STEPS.indexOf(target) > STEPS.indexOf(step);
    const button = page.getByTestId(forward ? "create-family-next" : "create-family-back");
    if (forward) await expect(button).toBeEnabled();
    await button.evaluate((element) => (element as HTMLElement).click());
    await expect(form(page)).not.toHaveAttribute("data-step", step);
  }
  await expect(form(page)).toHaveAttribute("data-step", target);
}

export async function fillCreateField(page: Page, testId: string, value: string) {
  await goToCreateStep(page, FIELD_STEP[testId] ?? "terms");
  await page.getByTestId(testId).fill(value);
}

/** Picks a service tile on step 1, opening its category first. */
export async function pickCreateService(page: Page, slug: string, category = "all") {
  await goToCreateStep(page, "service");
  await page.getByTestId(`create-category-${category}`).evaluate((element) => (element as HTMLElement).click());
  await page.getByTestId(`create-service-option-${slug}`).evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByTestId(`create-service-option-${slug}`)).toHaveAttribute("aria-checked", "true");
}

/** Fills what is still required and presses «Создать семью». The caller waits for the network. */
export async function pressCreateFamily(page: Page) {
  await goToCreateStep(page, "payout");
  const phone = page.getByTestId("create-payment-phone-input");
  if (!(await phone.inputValue())) await phone.fill("+77001234567");
  const name = page.getByTestId("create-recipient-name-input");
  if (!(await name.inputValue())) await name.fill("Айгерим Б.");
  const submit = page.getByTestId("create-family-submit");
  await expect(submit).toBeEnabled();
  await submit.evaluate((element) => (element as HTMLElement).click());
}
