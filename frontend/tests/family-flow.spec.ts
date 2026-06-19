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
  await page.getByTestId("create-family-submit").click();
  await expect(page.getByTestId("family-workspace")).toHaveCount(1);
  await expect(page.locator(".owner-rules-preview").first()).toContainText(
    "Access first"
  );

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

  await page.getByTestId("workspace-open-family-button").click();
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
  await page.getByTestId("open-invite-button").click();
  await expect(page.getByTestId("detail-send-request-button")).toBeVisible();
  await page.getByTestId("detail-send-request-button").click();
  await expect(page.locator(".inline-success")).toBeVisible();
  await expect(page.getByTestId("owner-chat-button")).toBeVisible();
  await openNav(page, 4);
  await expect(page.getByTestId("request-card")).toContainText("Apple One");
  await expect(page.getByTestId("request-owner-chat-button")).toBeVisible();

  await switchDevUser(page, "200001");
  await openNav(page, 3);
  await page.getByTestId("owner-details-button").click();
  await expect(page.getByTestId("approve-request-button")).toBeVisible();
  await page.getByTestId("approve-request-button").click();
  await expect(page.getByTestId("access-provided-button")).toBeVisible();
  await page.getByTestId("access-provided-button").click();
  await expect(page.getByTestId("access-provided-button")).toHaveCount(0);
  await expect(page.getByTestId("remind-access-button")).toBeVisible();
  await clickAndWait(page, "remind-access-button");

  await switchDevUser(page, "200002");
  await openNav(page, 3);
  await expect(page.getByTestId("confirm-access-button")).toBeVisible();
  await page.getByTestId("confirm-access-button").click();
  await expect(page.locator(".requisite-box")).toContainText("+77001234567");
  await expect(page.getByTestId("report-payment-button")).toBeVisible();
  await page.getByTestId("report-payment-button").click();
  await expect(page.getByTestId("cancel-payment-report-button")).toBeVisible();

  await switchDevUser(page, "200001");
  await openNav(page, 3);
  await page.getByTestId("owner-details-button").click();
  await expect(page.getByTestId("confirm-payment-button").first()).toBeVisible();
  await page.getByTestId("confirm-payment-button").first().click();
  await expect(page.getByTestId("owner-pending-payments-count")).toContainText("0");

  await switchDevUser(page, "200002");
  await openNav(page, 3);
  await expect(page.getByTestId("create-prepayment-button")).toBeVisible();
  await clickAndWait(page, "create-prepayment-button");
  await expect(page.locator(".payment-list")).toContainText("предоплата");
  await expect(page.getByTestId("report-payment-button")).toBeVisible();
  await clickAndWait(page, "report-payment-button");

  await switchDevUser(page, "200001");
  await openNav(page, 3);
  await page.getByTestId("owner-details-button").click();
  await expect(page.getByTestId("confirm-payment-button").first()).toBeVisible();
  await page.getByTestId("confirm-payment-button").first().click();
  await expect(page.getByTestId("owner-prepayment-periods")).toBeVisible();
  await page.getByTestId("owner-prepayment-periods").selectOption("2");
  await clickAndWait(page, "owner-record-prepayment-button");
  await expect(page.locator(".payment-list").last()).toContainText("предоплата");

  await clickAndWait(page, "remove-member-button");
  await expect(page.getByTestId("revoke-removal-button")).toBeVisible();

  await switchDevUser(page, "200002");
  await openNav(page, 3);
  await expect(page.getByText("Вас планируют удалить")).toBeVisible();
  await expect(page.getByTestId("acknowledge-removal-button")).toBeVisible();
  await expect(
    page.getByTestId("request-removal-cancellation-button")
  ).toBeVisible();
  await clickAndWait(page, "acknowledge-removal-button");
  await expect(page.getByTestId("acknowledge-removal-button")).toHaveCount(0);
  await expect(page.getByTestId("family-workspace")).toHaveCount(1);
  await clickAndWait(page, "request-removal-cancellation-button");
  await expect(page.getByText("Владелец получил просьбу")).toBeVisible();
  await expect(page.getByTestId("family-workspace")).toHaveCount(1);

  await switchDevUser(page, "200001");
  await openNav(page, 3);
  await page.getByTestId("owner-details-button").click();
  await expect(page.getByText("Участник просит отменить удаление.")).toBeVisible();
  await clickAndWait(page, "revoke-removal-button");
  await expect(page.getByTestId("remove-member-button")).toBeVisible();

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
  await page.getByTestId("family-type-tariff").click();
  await expect(page.getByTestId("create-family-form")).toBeVisible();
  await page.getByTestId("create-total-price-input").fill("12000");
  await page.getByTestId("create-max-members-input").fill("4");
  await page.getByTestId("create-payment-phone-input").fill("+77001234567");
  await page.getByTestId("create-description-input").fill("Семейный тариф оператора");
  await page.getByTestId("create-family-submit").click();

  await expect(page.getByTestId("family-workspace")).toHaveCount(1);
  await expect(page.getByTestId("family-card")).toHaveAttribute(
    "data-family-type",
    "tariff"
  );

  await switchDevUser(page, "200002");
  await openNav(page, 1);
  await page.getByTestId("family-type-tariff").click();
  await expect(page.getByTestId("family-card")).toHaveCount(1);
  await expect(page.getByTestId("family-card")).toHaveAttribute(
    "data-family-type",
    "tariff"
  );
  await expect(page.getByTestId("family-card")).toContainText("Семья тарифа");

  await page.getByTestId("family-type-subscription").click();
  await expect(page.getByTestId("family-card")).toHaveCount(0);
});

async function switchDevUser(page: Page, userId: string) {
  await waitForNetworkQuiet(page);
  await page.getByTestId("dev-user-select").selectOption(userId);
  await expect(page.getByTestId("dev-user-select")).toHaveValue(userId);
  await expect(page.locator(".home-hero, .panel").first()).toBeVisible();
  await waitForNetworkQuiet(page);
}

async function openNav(page: Page, index: number) {
  await page.locator(".bottom-nav button").nth(index).click();
  await expect(page.locator(".panel, .home-hero").first()).toBeVisible();
}

async function clickAndWait(page: Page, testId: string) {
  await expect(page.getByTestId(testId)).toBeEnabled();
  await page.getByTestId(testId).click();
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
