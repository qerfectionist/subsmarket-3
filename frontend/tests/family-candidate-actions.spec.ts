import { expect, test, type Page } from "@playwright/test";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";
const apiUrl = process.env.TMA_API_URL ?? "http://127.0.0.1:8001";

test.use({
  deviceScaleFactor: 1,
  isMobile: true,
  viewport: { width: 390, height: 844 }
});

test.beforeEach(async ({ page }) => {
  await page.request.post(`${apiUrl}/api/dev/reset-demo-data`);
  await page.request.post(`${apiUrl}/api/catalog/import-family-services`);
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
  page.on("dialog", (dialog) => dialog.accept());
});

test.afterEach(async ({ page }) => {
  await page.request.post(`${apiUrl}/api/dev/reset-demo-data`);
});

async function waitForNetworkQuiet(page: Page) {
  await page.waitForTimeout(300);
}

function navScreenLocator(page: Page, index: number) {
  switch (index) {
    case 0:
      return page.getByTestId("market-screen");
    case 1:
      return page.getByTestId("my-screen");
    case 2:
      return page.getByTestId("create-family-form");
    case 3:
      return page.getByTestId("actions-screen");
    default:
      return page.locator(".native-screen, .home-page");
  }
}

async function openNav(page: Page, index: number) {
  const labels = ["Маркет", "Мои", "Создать", "Заявки"] as const;
  const nav = page.getByRole("navigation", { name: "Главная навигация" });
  const button =
    index === 2
      ? page.locator(".subs-dock-create").getByRole("button", { name: labels[index], exact: true })
      : nav.getByRole("button", { name: labels[index], exact: true });
  await button.evaluate((element) => (element as HTMLElement).click());
  await waitForNetworkQuiet(page);
  await expect(navScreenLocator(page, index)).toBeVisible();
}

async function openCreate(page: Page) {
  await openNav(page, 2);
  await expect(page.getByTestId("create-family-form")).toBeVisible();
}

const CREATE_FIELD_STEP: Record<string, number> = {
  "create-service-select": 0,
  "create-period-select": 0,
  "create-plan-name-input": 0,
  "create-max-members-input": 1,
  "create-total-price-input": 1,
  "create-payment-day-input": 1,
  "create-next-payment-date-input": 1,
  "create-bank-select": 2,
  "create-payment-phone-input": 2,
  "create-description-input": 3,
  "create-owner-rules-input": 3
};

async function goToCreateWizardStep(page: Page, targetStep: number) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const currentStep = Number.parseInt(
      await page.locator(".wizard-step-current .wizard-step-index").innerText(),
      10
    );
    if (currentStep - 1 === targetStep) {
      return;
    }
    if (currentStep - 1 < targetStep) {
      await page
        .getByTestId("create-family-submit")
        .evaluate((element) => (element as HTMLElement).click());
      await page.waitForTimeout(80);
      continue;
    }
    await page
      .getByTestId("create-family-back")
      .evaluate((element) => (element as HTMLElement).click());
      await page.waitForTimeout(80);
  }
}

async function fillCreateField(page: Page, testId: string, value: string) {
  await goToCreateWizardStep(page, CREATE_FIELD_STEP[testId] ?? 0);
  await page.getByTestId(testId).fill(value);
}

async function submitCreateFamily(page: Page) {
  await goToCreateWizardStep(page, 3);
  const submit = page.getByTestId("create-family-submit");
  await submit.scrollIntoViewIfNeeded();
  await submit.evaluate((element) => (element as HTMLElement).click());
  await waitForNetworkQuiet(page);
}

async function switchDevUser(page: Page, userId: string) {
  await waitForNetworkQuiet(page);
  const select = page.getByTestId("dev-user-select");
  let returnedToMarket = false;
  if (!(await select.isVisible())) {
    const nav = page.getByRole("navigation", { name: "Главная навигация" });
    await nav.getByRole("button", { name: "Мои", exact: true }).click({ force: true });
    const toggleBtn = page.getByTestId("dev-controls-toggle");
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
    }
    await expect(select).toBeVisible();
    returnedToMarket = true;
  }
  const label = userId === "200001" ? "Owner · @demo_owner" : "Member · @demo_member";
  await select.locator("select").selectOption({ label });
  await waitForNetworkQuiet(page);
  await expect(page.getByTestId("market-screen")).toBeVisible();
  if (returnedToMarket) {
    const nav = page.getByRole("navigation", { name: "Главная навигация" });
    await nav.getByRole("button", { name: "Маркет", exact: true }).click({ force: true });
    await expect(page.getByTestId("market-screen")).toBeVisible();
  }
}

test("owner sees candidate request card in actions inbox and accepts it", async ({ page }) => {
  // 1. Owner creates family
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openCreate(page);
  await fillCreateField(page, "create-payment-phone-input", "+77001234567");
  await submitCreateFamily(page);
  await expect(page.getByTestId("family-workspace")).toHaveCount(1);

  // 2. Member sends request
  await switchDevUser(page, "200002");
  await openNav(page, 0);
  const familyCard = page.getByTestId("family-card").first();
  await familyCard.click({ force: true });
  await expect(page.getByTestId("detail-send-request-button")).toBeVisible();
  await page.getByTestId("detail-send-request-button").evaluate((el) => (el as HTMLElement).click());
  await waitForNetworkQuiet(page);
  await expect(page.getByText("Заявка отправлена", { exact: true }).first()).toBeVisible();

  // 3. Owner opens Actions tab
  await switchDevUser(page, "200001");
  await openNav(page, 3);
  await expect(page.getByTestId("actions-screen")).toBeVisible();

  // Check candidate request card is displayed instead of the old family card
  const candidateCard = page.getByTestId("family-candidate-request-card");
  await expect(candidateCard).toBeVisible();
  await expect(candidateCard).toContainText("@demo_member");
  await expect(candidateCard).toContainText("в месяц");

  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_family_candidate_request.png",
    fullPage: false
  });

  // Accept candidate request
  const acceptBtn = candidateCard.getByTestId("trade-request-accept-btn");
  await expect(acceptBtn).toBeVisible();
  await acceptBtn.click();
  await waitForNetworkQuiet(page);

  // Candidate request card should now be accepted and removed from pending inbox
  await expect(candidateCard).toHaveCount(0);
});
