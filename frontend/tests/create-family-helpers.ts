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

const KIND_TITLES = { subscription: "Семейная подписка", tariff: "Семейный тариф" } as const;

/** On «Создать»: opens the family form of the given kind from the menu, coming back to it if needed. */
export async function openCreateKind(page: Page, kind: "subscription" | "tariff" = "subscription") {
  const home = page.getByTestId("create-home");
  const familyScreen = page.getByTestId("create-family-screen");
  if ((await familyScreen.count()) > 0) {
    if ((await familyScreen.locator("h1").innerText()) === KIND_TITLES[kind]) return;
    await goToCreateStep(page, "service");
    await page.getByTestId("create-form-back").evaluate((element) => (element as HTMLElement).click());
  }
  await expect(home).toBeVisible();
  await page.getByTestId(`create-kind-${kind}`).evaluate((element) => (element as HTMLElement).click());
  await expect(form(page)).toBeVisible();
}

/** Picks a service tile on step 1: «Тарифы» or «Подписки» from the menu, then the category chip. */
export async function pickCreateService(page: Page, slug: string, category = "all") {
  const tariff = category === "operators" || slug.endsWith("-family-tariff");
  await openCreateKind(page, tariff ? "tariff" : "subscription");
  await goToCreateStep(page, "service");
  if (!tariff) {
    await page.getByTestId(`create-category-${category}`).evaluate((element) => (element as HTMLElement).click());
  }
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

/** On «Семья создана»: connects a WhatsApp chat (so members can be approved) and goes to «Мои». */
export async function finishCreatedFamily(page: Page, { connectChat = true } = {}) {
  await expect(page.getByTestId("family-created-screen")).toBeVisible();
  if (connectChat) {
    const panel = page.getByTestId("family-chat-panel");
    if ((await panel.getAttribute("data-chat-kind")) !== "whatsapp") {
      await page.getByTestId("family-chat-switch").evaluate((element) => (element as HTMLElement).click());
      await expect(panel).toHaveAttribute("data-chat-kind", "whatsapp");
    }
    await page.getByTestId("family-chat-whatsapp-input").fill("https://chat.whatsapp.com/AbCdEfGhIj12345");
    await page.getByTestId("family-chat-save-whatsapp").evaluate((element) => (element as HTMLElement).click());
    await expect(panel).toHaveAttribute("data-chat-status", "connected");
  }
  await page.getByTestId("family-created-done").evaluate((element) => (element as HTMLElement).click());
}

/** Fills what the request form asks for: the contact for the invite and the rules checkbox. */
export async function fillJoinRequest(page: Page, contact?: string) {
  await expect(page.getByTestId("join-request-form")).toBeVisible();
  const input = page.getByTestId("join-contact-input");
  if ((await input.count()) > 0) {
    const isPhone = (await input.getAttribute("inputmode")) === "tel";
    await input.fill(contact ?? (isPhone ? "+77007654321" : "demo.member@gmail.com"));
  }
  const confirm = page.getByTestId("join-confirm-checkbox");
  if ((await confirm.count()) > 0 && !(await confirm.isChecked())) {
    await confirm.check();
  }
  await expect(page.getByTestId("detail-send-request-button")).toBeEnabled();
}
