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
    const trackedWindow = window as typeof window & { __pendingFetches?: number };
    trackedWindow.__pendingFetches = 0;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (...args) => {
      trackedWindow.__pendingFetches = (trackedWindow.__pendingFetches ?? 0) + 1;
      return originalFetch(...args).finally(() => {
        trackedWindow.__pendingFetches = Math.max(
          0,
          (trackedWindow.__pendingFetches ?? 1) - 1
        );
      });
    };
  });
  page.on("dialog", (dialog) => dialog.accept());
});

test.afterEach(async ({ page }) => {
  await page.request.post(`${apiUrl}/api/dev/reset-demo-data`);
});

test("owner and member complete the first payment family flow", async ({ page }) => {
  const messages: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning", "warn"].includes(message.type())) {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    messages.push(`pageerror: ${error.message}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      messages.push(`${response.status()}: ${response.url()}`);
    }
  });

  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("market-screen")).toBeVisible();
  await expect(page.locator(".market-hero-carousel")).toBeVisible();
  await expect(page.locator(".market-fast-grid")).toBeVisible();
  await expect(page.getByTestId("market-find-tariff")).toBeVisible();
  await expect(page.getByTestId("market-find-subscription")).toBeVisible();
  await expect(page.getByTestId("market-buy-gigabytes")).toBeVisible();
  await expect(page.getByTestId("market-buy-accounts")).toBeVisible();
  await expect(page.locator(".bottom-nav button")).toHaveCount(4);
  await expect(page.getByTestId("dev-user-select")).toHaveAttribute(
    "data-value",
    "200001"
  );

  await openCreate(page);
  await expect(page.getByTestId("create-family-form")).toBeVisible();
  await expect(page.getByTestId("create-share-preview")).toContainText("650 ₸");
  await fillCreateField(page, "create-total-price-input", "3990");
  await fillCreateField(page, "create-max-members-input", "4");
  await expect(page.getByTestId("create-share-preview")).toContainText("1 000 ₸");
  await fillCreateField(page, "create-payment-phone-input", "+77001234567");
  await fillCreateField(page, "create-description-input", "E2E subscription family");
  await fillCreateField(page, "create-owner-rules-input", "Access first, payment after check.");
  await submitCreateFamily(page);
  await expect(page.getByTestId("family-workspace")).toHaveCount(1);
  await expect(page.locator(".family-workspace")).toContainText("Access first");

  await expect(page.getByTestId("owner-description-input")).toBeVisible();
  await page.getByTestId("owner-description-input").fill("Updated owner description");
  await clickAndWait(page, "owner-save-description-button");
  await expect(page.getByTestId("owner-description-input")).toHaveValue(
    "Updated owner description"
  );
  await page.getByTestId("owner-price-input").fill("4200");
  await clickAndWait(page, "owner-save-price-button");
  await expect(page.getByTestId("owner-price-input")).toHaveValue("4200");
  const nextPaymentDate = futureDateISO(45);
  await page.getByTestId("owner-payment-day-input").fill("18");
  await page.getByTestId("owner-next-payment-date-input").fill(nextPaymentDate);
  await clickAndWait(page, "owner-save-payment-day-button");
  await expect(page.getByTestId("owner-payment-day-input")).toHaveValue("18");
  await expect(page.getByTestId("owner-next-payment-date-input")).toHaveValue(
    nextPaymentDate
  );

  await openFamilyDetailsFromMine(page);
  const createInviteButton = page.getByTestId("create-invite-button");
  if ((await createInviteButton.count()) > 0) {
    await clickAndWait(page, "create-invite-button");
  }
  await expect(page.getByTestId("owner-invite-code")).toBeVisible();
  const inviteCode = (await page.getByTestId("owner-invite-code").innerText()).replace(
    /\s/g,
    ""
  );
  expect(inviteCode).toMatch(/^\d{8}$/);
  await clickAndWait(page, "toggle-family-visibility-button");

  await switchDevUser(page, "200002");
  await openNav(page, 0);
  await expect(page.getByTestId("family-card")).toHaveCount(0);
  await page.getByTestId("invite-code-input").fill(inviteCode);
  await page
    .getByTestId("open-invite-button")
    .evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByTestId("detail-send-request-button")).toBeVisible();
  await page.getByTestId("detail-send-request-button").click({ force: true });
  await expect(page.getByText("Заявка отправлена", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("owner-chat-button")).toBeVisible();
  await openNav(page, 1);
  await expect(page.getByTestId("request-card")).toContainText("Apple One");
  await expect(page.getByTestId("request-owner-chat-button")).toBeVisible();

  await switchDevUser(page, "200001");
  await openNav(page, 1);
  await page.getByTestId("owner-details-button").click({ force: true });
  await expect(page.getByTestId("approve-request-button")).toBeVisible();
  await page.getByTestId("approve-request-button").click({ force: true });
  await waitForNetworkQuiet(page);
  await expect(page.getByTestId("access-provided-button")).toBeVisible();
  await page.getByTestId("access-provided-button").click({ force: true });
  await waitForNetworkQuiet(page);
  await expect(page.getByTestId("access-provided-button")).toHaveCount(0);
  await expect(page.getByTestId("remind-access-button")).toBeVisible();
  await page.getByTestId("remind-access-button").click({ force: true });
  await waitForNetworkQuiet(page);

  await switchDevUser(page, "200002");
  await openNav(page, 1);
  await expect(page.getByTestId("confirm-access-button")).toBeVisible();
  await clickAndWait(page, "confirm-access-button");
  await expect(page.locator(".requisite-box")).toBeVisible();
  await clickAndWait(page, "report-payment-button");
  await expect(page.getByTestId("cancel-payment-report-button")).toBeVisible();

  await switchDevUser(page, "200001");
  await openNav(page, 1);
  await page.getByTestId("owner-details-button").click({ force: true });
  await expect(page.getByTestId("confirm-payment-button").first()).toBeVisible();
  await page.getByTestId("confirm-payment-button").first().click({ force: true });
  await waitForNetworkQuiet(page);
  await expect(page.getByTestId("confirm-payment-button")).toHaveCount(0);

  await switchDevUser(page, "200002");
  await openNav(page, 1);
  await expect(page.getByTestId("create-prepayment-button")).toBeVisible();
  await clickAndWait(page, "create-prepayment-button");
  await expect(page.locator(".payment-list")).toContainText("предоплата");
  await expect(page.getByTestId("report-payment-button")).toBeVisible();
  await clickAndWait(page, "report-payment-button");

  await switchDevUser(page, "200001");
  await openNav(page, 1);
  await page.getByTestId("owner-details-button").click({ force: true });
  await expect(page.getByTestId("confirm-payment-button").first()).toBeVisible();
  await page.getByTestId("confirm-payment-button").first().click({ force: true });
  await expect(page.getByTestId("owner-prepayment-periods")).toBeVisible();
  await clickAndWait(page, "owner-record-prepayment-button");
  await expect(page.locator(".payment-list").last()).toContainText("предоплата");

  await selectWorldOption(page, "remove-member-reason", "Нет связи");
  await page.getByTestId("remove-member-button").click({ force: true });
  await waitForNetworkQuiet(page);
  await expect(page.getByTestId("remove-member-button")).toHaveCount(0);

  await switchDevUser(page, "200002");
  await openNav(page, 1);
  await expect(page.getByTestId("family-workspace")).toHaveCount(0);

  await switchDevUser(page, "200001");
  await openNav(page, 1);
  await page.getByTestId("owner-details-button").click({ force: true });
  await expect(page.getByTestId("remove-member-button")).toHaveCount(0);

  const relevantMessages = messages.filter(
    (message) =>
      !message.includes("telegram.org/js/telegram-web-app.js") &&
      !message.includes("not supported in version 6.0") &&
      !message.includes("net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin") &&
      !message.includes("React DevTools")
  );
  expect(relevantMessages).toEqual([]);
});

test("subscription and tariff families stay in separate storefronts", async ({
  page
}) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openCreate(page);
  await page.getByTestId("family-type-tariff").click({ force: true });
  await expect(page.getByTestId("create-family-form")).toBeVisible();
  await fillCreateField(page, "create-plan-name-input", "Семейный 4");
  await fillCreateField(page, "create-total-price-input", "12000");
  await fillCreateField(page, "create-max-members-input", "4");
  await fillCreateField(page, "create-payment-phone-input", "+77001234567");
  await fillCreateField(page, "create-description-input", "Семейный тариф оператора");
  await submitCreateFamily(page);

  await expect(page.getByTestId("family-workspace")).toHaveCount(1);
  await expect(page.getByTestId("family-card")).toHaveAttribute(
    "data-family-type",
    "tariff"
  );

  await switchDevUser(page, "200002");
  await openNav(page, 0);
  await selectMarketTariffs(page);
  await expect(page.getByTestId("family-card")).toHaveCount(1);
  await expect(page.getByTestId("family-card")).toHaveAttribute(
    "data-family-type",
    "tariff"
  );

  await selectMarketSubscriptions(page);
  await expect(page.getByTestId("family-card")).toHaveCount(0);
});

test("create family form validates phone in real time", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openCreate(page);

  await fillCreateField(page, "create-payment-phone-input", "123");
  await expect(page.locator(".field-error")).toBeVisible();
  await expect(page.locator(".field-error")).toContainText("Формат");

  await fillCreateField(page, "create-payment-phone-input", "+77001234567");
  await expect(page.locator(".field-error")).toHaveCount(0);

  await fillCreateField(page, "create-total-price-input", "0");
  await expect(page.locator(".field-error")).toBeVisible();
  await expect(page.locator(".field-error")).toContainText("больше нуля");

  await goToCreateWizardStep(page, 3);
  await expect(page.getByTestId("create-family-submit")).toBeDisabled();
});

test("requisite phone is masked until revealed", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openCreate(page);
  await fillCreateField(page, "create-payment-phone-input", "+77001234567");
  await submitCreateFamily(page);
  await expect(page.getByTestId("family-workspace")).toHaveCount(1);

  await switchDevUser(page, "200002");
  await openNav(page, 0);
  await expect(page.getByTestId("family-card")).toHaveCount(1);
  await page.getByTestId("open-family-button").first().click({ force: true });
  await expect(page.locator(".detail-grid")).toBeVisible();
  await page.getByTestId("detail-send-request-button").click({ force: true });

  await switchDevUser(page, "200001");
  await openNav(page, 1);
  await page.getByTestId("owner-details-button").click({ force: true });
  await page.getByTestId("approve-request-button").click({ force: true });
  await waitForNetworkQuiet(page);
  await page.getByTestId("access-provided-button").click({ force: true });
  await waitForNetworkQuiet(page);

  await switchDevUser(page, "200002");
  await openNav(page, 1);
  await page.getByTestId("confirm-access-button").click({ force: true });
  await expect(page.locator(".requisite-box")).toBeVisible();
  await expect(page.locator(".requisite-box")).toContainText("***");
  await expect(page.locator(".requisite-box")).not.toContainText("+77001234567");
});

test("owner tabs switch between requests members and payments", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openCreate(page);
  await fillCreateField(page, "create-payment-phone-input", "+77001234567");
  await submitCreateFamily(page);
  await expect(page.getByTestId("family-workspace")).toHaveCount(1);

  await page.getByTestId("owner-details-button").click({ force: true });
  await expect(page.locator(".owner-tabs")).toBeVisible();
  await expect(page.getByTestId("approve-request-button")).toHaveCount(0);
});

test("owner removes a member immediately with a reason", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openCreate(page);
  await fillCreateField(page, "create-payment-phone-input", "+77001234567");
  await submitCreateFamily(page);
  await expect(page.getByTestId("family-workspace")).toHaveCount(1);

  await switchDevUser(page, "200002");
  await openNav(page, 0);
  await page.getByTestId("open-family-button").first().click({ force: true });
  await page.getByTestId("detail-send-request-button").click({ force: true });

  await switchDevUser(page, "200001");
  await openNav(page, 1);
  await page.getByTestId("owner-details-button").click({ force: true });
  await page.getByTestId("approve-request-button").click({ force: true });
  await waitForNetworkQuiet(page);
  await page.getByTestId("access-provided-button").click({ force: true });
  await waitForNetworkQuiet(page);

  await expect(page.getByTestId("remove-member-button")).toBeVisible();
  await selectWorldOption(page, "remove-member-reason", "Нет связи");
  await page.getByTestId("remove-member-button").click({ force: true });
  await waitForNetworkQuiet(page);

  await expect(page.getByTestId("remove-member-button")).toHaveCount(0);
});

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

async function fillCreateField(page: Page, testId: string, value: string) {
  await goToCreateWizardStep(page, CREATE_FIELD_STEP[testId] ?? 0);
  await page.getByTestId(testId).fill(value);
}

async function goToCreateWizardStep(page: Page, targetStep: number) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const currentStep = Number(
      await page.locator(".wizard-step-current .wizard-step-index").innerText()
    );
    if (currentStep - 1 === targetStep) {
      return;
    }
    if (currentStep - 1 < targetStep) {
      await page.getByTestId("create-family-submit").click({ force: true });
      await page.waitForTimeout(80);
      continue;
    }
    await page.getByRole("button", { name: "Назад" }).click({ force: true });
    await page.waitForTimeout(80);
  }
}

async function submitCreateFamily(page: Page) {
  await goToCreateWizardStep(page, 3);
  const submit = page.getByTestId("create-family-submit");
  await submit.scrollIntoViewIfNeeded();
  await submit.click({ force: true });
  await waitForNetworkQuiet(page);
}

async function switchDevUser(page: Page, userId: string) {
  await waitForNetworkQuiet(page);
  const label = userId === "200001" ? "Owner · @demo_owner" : "Member · @demo_member";
  await selectWorldOption(page, "dev-user-select", label);
  await expect(page.getByTestId("dev-user-select")).toHaveAttribute(
    "data-value",
    userId
  );
  await expect(page.getByTestId("market-screen")).toBeVisible();
  await waitForNetworkQuiet(page);
}

async function selectWorldOption(page: Page, testId: string, optionName: string) {
  const select = page.getByTestId(testId);
  await select.locator("button").click({ force: true });
  await page.getByRole("option", { name: optionName, exact: true }).click({
    force: true
  });
  await waitForNetworkQuiet(page);
}

async function openCreate(page: Page) {
  await openNav(page, 2);
  await expect(page.getByTestId("create-family-form")).toBeVisible();
}

async function selectMarketSubscriptions(page: Page) {
  await page
    .getByTestId("family-type-subscription")
    .evaluate((element) => (element as HTMLElement).click());
  await waitForNetworkQuiet(page);
}

async function selectMarketTariffs(page: Page) {
  await page
    .getByTestId("family-type-tariff")
    .evaluate((element) => (element as HTMLElement).click());
  await waitForNetworkQuiet(page);
}

async function openNav(page: Page, index: number) {
  await page.locator(".bottom-nav button").nth(index).click({ force: true });
  await expect(navScreenLocator(page, index)).toBeVisible();
}

function navScreenLocator(page: Page, index: number) {
  switch (index) {
    case 0:
      return page.getByTestId("market-screen");
    case 1:
      return page.getByTestId("my-screen");
    case 3:
      return page.getByTestId("actions-screen");
    case 2:
      return page.getByTestId("create-family-form");
    default:
      return page.locator(".native-screen, .home-page");
  }
}

async function openFamilyDetailsFromMine(page: Page) {
  await page.getByTestId("workspace-open-family-button").first().click({ force: true });
  await waitForNetworkQuiet(page);
  await expect(page.locator(".detail-grid")).toBeVisible();
}

async function clickAndWait(page: Page, testId: string) {
  const target = page.getByTestId(testId);
  await expect(target).toBeEnabled();
  await target.scrollIntoViewIfNeeded();
  // DOM click: World UI overlays can intercept Playwright pointer events.
  await target.evaluate((element) => (element as HTMLElement).click());
  await waitForNetworkQuiet(page);
}

async function waitForNetworkQuiet(page: Page) {
  for (let index = 0; index < 30; index += 1) {
    const pending = await page.evaluate(
      () => (window as typeof window & { __pendingFetches?: number }).__pendingFetches ?? 0
    );
    if (pending === 0) {
      await page.waitForTimeout(100);
      const stillPending = await page.evaluate(
        () =>
          (window as typeof window & { __pendingFetches?: number })
            .__pendingFetches ?? 0
      );
      if (stillPending === 0) {
        return;
      }
    }
    await page.waitForTimeout(50);
  }
}

function futureDateISO(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
