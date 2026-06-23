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
  await expect(page.locator(".home-hero")).toBeVisible();
  await expect(page.locator(".home-hero")).toContainText("Найдите семью для подписки");
  await expect(page.locator(".trust-strip")).toContainText("Доступ");
  await expect(page.getByTestId("dev-user-select")).toHaveValue("200001");

  await openNav(page, 2);
  await expect(page.getByTestId("create-family-form")).toBeVisible();
  await expect(page.getByTestId("create-share-preview")).toContainText("650 ₸");
  await page.getByTestId("create-total-price-input").fill("3990");
  await page.getByTestId("create-max-members-input").fill("4");
  await expect(page.getByTestId("create-share-preview")).toContainText("1 000 ₸");
  await page.getByTestId("create-payment-phone-input").fill("+77001234567");
  await page.getByTestId("create-description-input").fill("E2E subscription family");
  await page.getByTestId("create-owner-rules-input").fill("Access first, payment after check.");
  await page.getByTestId("create-family-submit").click({ force: true });
  await expect(page.getByTestId("family-workspace")).toHaveCount(1);
  await expect(page.locator(".family-workspace")).toContainText("Access first");

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

  await page.getByTestId("workspace-open-family-button").click({ force: true });
  await clickAndWait(page, "create-invite-button");
  const inviteCode = (await page.getByTestId("owner-invite-code").innerText()).replace(
    /\s/g,
    ""
  );
  expect(inviteCode).toMatch(/^\d{8}$/);
  await clickAndWait(page, "toggle-family-visibility-button");

  await switchDevUser(page, "200002");
  await openNav(page, 1);
  await expect(page.getByTestId("family-card")).toHaveCount(0);
  await page.getByTestId("invite-code-input").fill(inviteCode);
  await page.getByTestId("open-invite-button").click({ force: true });
  await expect(page.getByTestId("detail-send-request-button")).toBeVisible();
  await page.getByTestId("detail-send-request-button").click({ force: true });
  await expect(page.getByText("Заявка отправлена")).toBeVisible();
  await expect(page.getByTestId("owner-chat-button")).toBeVisible();
  await openNav(page, 4);
  await expect(page.getByTestId("request-card")).toContainText("Apple One");
  await expect(page.getByTestId("request-owner-chat-button")).toBeVisible();

  await switchDevUser(page, "200001");
  await openNav(page, 3);
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
  await openNav(page, 3);
  await expect(page.getByTestId("confirm-access-button")).toBeVisible();
  await page.getByTestId("confirm-access-button").click({ force: true });
  await expect(page.locator(".requisite-box")).toBeVisible();
  await expect(page.getByTestId("report-payment-button")).toBeVisible();
  await page.getByTestId("report-payment-button").click({ force: true });
  await waitForNetworkQuiet(page);
  await expect(page.getByTestId("cancel-payment-report-button")).toBeVisible();

  await switchDevUser(page, "200001");
  await openNav(page, 3);
  await page.getByTestId("owner-details-button").click({ force: true });
  await expect(page.getByTestId("confirm-payment-button").first()).toBeVisible();
  await page.getByTestId("confirm-payment-button").first().click({ force: true });
  await waitForNetworkQuiet(page);
  await expect(page.getByTestId("confirm-payment-button")).toHaveCount(0);

  await switchDevUser(page, "200002");
  await openNav(page, 3);
  await expect(page.getByTestId("create-prepayment-button")).toBeVisible();
  await clickAndWait(page, "create-prepayment-button");
  await expect(page.locator(".payment-list")).toContainText("предоплата");
  await expect(page.getByTestId("report-payment-button")).toBeVisible();
  await clickAndWait(page, "report-payment-button");

  await switchDevUser(page, "200001");
  await openNav(page, 3);
  await page.getByTestId("owner-details-button").click({ force: true });
  await expect(page.getByTestId("confirm-payment-button").first()).toBeVisible();
  await page.getByTestId("confirm-payment-button").first().click({ force: true });
  await expect(page.getByTestId("owner-prepayment-periods")).toBeVisible();
  await page.getByTestId("owner-prepayment-periods").selectOption("2");
  await clickAndWait(page, "owner-record-prepayment-button");
  await expect(page.locator(".payment-list").last()).toContainText("предоплата");

  await page.getByTestId("remove-member-reason").selectOption("no_response");
  await page.getByTestId("remove-member-button").click({ force: true });
  await waitForNetworkQuiet(page);
  await expect(page.getByTestId("remove-member-button")).toHaveCount(0);
  await expect(page.getByText("Участник будет удалён")).toBeVisible();

  await switchDevUser(page, "200002");
  await openNav(page, 3);
  await expect(page.getByTestId("family-workspace")).toHaveCount(1);

  await switchDevUser(page, "200001");
  await openNav(page, 3);
  await page.getByTestId("owner-details-button").click({ force: true });
  await expect(page.getByTestId("remove-member-button")).toHaveCount(0);

  const relevantMessages = messages.filter(
    (message) =>
      !message.includes("telegram.org/js/telegram-web-app.js") &&
      !message.includes("not supported in version 6.0") &&
      !message.includes("React DevTools")
  );
  expect(relevantMessages).toEqual([]);
});

test("subscription and tariff families stay in separate storefronts", async ({
  page
}) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openNav(page, 2);
  await page.getByTestId("family-type-tariff").click({ force: true });
  await expect(page.getByTestId("create-family-form")).toBeVisible();
  await page.getByTestId("create-total-price-input").fill("12000");
  await page.getByTestId("create-max-members-input").fill("4");
  await page.getByTestId("create-payment-phone-input").fill("+77001234567");
  await page.getByTestId("create-description-input").fill("Семейный тариф оператора");
  await page.getByTestId("create-family-submit").click({ force: true });

  await expect(page.getByTestId("family-workspace")).toHaveCount(1);
  await expect(page.getByTestId("family-card")).toHaveAttribute(
    "data-family-type",
    "tariff"
  );

  await switchDevUser(page, "200002");
  await openNav(page, 1);
  await page.getByTestId("family-type-tariff").click({ force: true });
  await expect(page.getByTestId("family-card")).toHaveCount(1);
  await expect(page.getByTestId("family-card")).toHaveAttribute(
    "data-family-type",
    "tariff"
  );

  await page.getByTestId("family-type-subscription").click({ force: true });
  await expect(page.getByTestId("family-card")).toHaveCount(0);
});

test("create family form validates phone in real time", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openNav(page, 2);

  await page.getByTestId("create-payment-phone-input").fill("123");
  await expect(page.locator(".field-error")).toBeVisible();
  await expect(page.locator(".field-error")).toContainText("Формат");

  await page.getByTestId("create-payment-phone-input").fill("+77001234567");
  await expect(page.locator(".field-error")).toHaveCount(0);

  await page.getByTestId("create-total-price-input").fill("0");
  await expect(page.locator(".field-error")).toBeVisible();
  await expect(page.locator(".field-error")).toContainText("больше нуля");

  await expect(page.getByTestId("create-family-submit")).toBeDisabled();
});

test("requisite phone is masked until revealed", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openNav(page, 2);
  await page.getByTestId("create-payment-phone-input").fill("+77001234567");
  await page.getByTestId("create-family-submit").click({ force: true });
  await expect(page.getByTestId("family-workspace")).toHaveCount(1);

  await switchDevUser(page, "200002");
  await openNav(page, 1);
  await expect(page.getByTestId("family-card")).toHaveCount(1);
  await page.getByTestId("open-family-button").first().click({ force: true });
  await expect(page.locator(".detail-grid")).toBeVisible();
  await page.getByTestId("detail-send-request-button").click({ force: true });

  await switchDevUser(page, "200001");
  await openNav(page, 3);
  await page.getByTestId("owner-details-button").click({ force: true });
  await page.getByTestId("approve-request-button").click({ force: true });
  await waitForNetworkQuiet(page);
  await page.getByTestId("access-provided-button").click({ force: true });
  await waitForNetworkQuiet(page);

  await switchDevUser(page, "200002");
  await openNav(page, 3);
  await page.getByTestId("confirm-access-button").click({ force: true });
  await expect(page.locator(".requisite-box")).toBeVisible();
  await expect(page.locator(".requisite-box")).toContainText("***");
  await expect(page.locator(".requisite-box")).not.toContainText("+77001234567");
});

test("owner tabs switch between requests members and payments", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openNav(page, 2);
  await page.getByTestId("create-payment-phone-input").fill("+77001234567");
  await page.getByTestId("create-family-submit").click({ force: true });
  await expect(page.getByTestId("family-workspace")).toHaveCount(1);

  await page.getByTestId("owner-details-button").click({ force: true });
  await expect(page.locator(".owner-tabs")).toBeVisible();
  await expect(page.getByTestId("approve-request-button")).toHaveCount(0);
});

test("undo member removal via snackbar restores the member", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openNav(page, 2);
  await page.getByTestId("create-payment-phone-input").fill("+77001234567");
  await page.getByTestId("create-family-submit").click({ force: true });
  await expect(page.getByTestId("family-workspace")).toHaveCount(1);

  await switchDevUser(page, "200002");
  await openNav(page, 1);
  await page.getByTestId("open-family-button").first().click({ force: true });
  await page.getByTestId("detail-send-request-button").click({ force: true });

  await switchDevUser(page, "200001");
  await openNav(page, 3);
  await page.getByTestId("owner-details-button").click({ force: true });
  await page.getByTestId("approve-request-button").click({ force: true });
  await waitForNetworkQuiet(page);
  await page.getByTestId("access-provided-button").click({ force: true });
  await waitForNetworkQuiet(page);

  await expect(page.getByTestId("remove-member-button")).toBeVisible();
  await page.getByTestId("remove-member-reason").selectOption("no_response");
  await page.getByTestId("remove-member-button").click({ force: true });
  await waitForNetworkQuiet(page);

  await expect(page.getByText("Участник будет удалён через 12 часов")).toBeVisible();
  await expect(page.getByTestId("remove-member-button")).toHaveCount(0);

  await page.locator('[data-testid="undo-removal-button"] button').click({ force: true });
  await waitForNetworkQuiet(page);

  await expect(page.getByText("Участник будет удалён через 12 часов")).toHaveCount(0);
  await expect(page.getByTestId("remove-member-button")).toBeVisible();
});

async function switchDevUser(page: Page, userId: string) {
  await waitForNetworkQuiet(page);
  await page.getByTestId("dev-user-select").selectOption(userId);
  await expect(page.getByTestId("dev-user-select")).toHaveValue(userId);
  await expect(page.locator(".home-hero, section").first()).toBeVisible();
  await waitForNetworkQuiet(page);
}

async function openNav(page: Page, index: number) {
  await page.locator(".bottom-nav button").nth(index).click({ force: true });
  await expect(page.locator(".home-hero, section").first()).toBeVisible();
}

async function clickAndWait(page: Page, testId: string) {
  await expect(page.getByTestId(testId)).toBeEnabled();
  await page.getByTestId(testId).click({ force: true });
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
