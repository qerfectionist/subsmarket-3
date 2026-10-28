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
  await page.addInitScript(() => window.localStorage.clear());
  page.on("dialog", (dialog) => dialog.accept());
});

test.afterEach(async ({ page }) => {
  await page.request.post(`${apiUrl}/api/dev/reset-demo-data`);
});

test("seller publishes an account offer and accepts a buyer", async ({ page }) => {
  const title = "ChatGPT Plus · 1 месяц, на аккаунт покупателя";
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.getByTestId("market-buy-accounts").click({ force: true });
  await expect(page.getByTestId("accounts-screen")).toBeVisible();
  await page.getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await page.locator(".product-scope-switch").getByRole("button", { name: "Аккаунты" }).click({ force: true });
  await expect(page.getByTestId("my-screen")).toBeVisible();
  await expect(page.getByTestId("my-accounts-screen")).toBeVisible();
  await expect(page.getByTestId("accounts-screen")).toHaveCount(0);
  await expect(page.locator(".gb-nav")).toHaveCount(0);
  await page.getByTestId("my-account-create-button").click({ force: true });
  await expect(page.getByTestId("accounts-screen")).toBeVisible();
  await expect(page.getByTestId("account-listing-form")).toBeVisible();
  // Search by a Russian word, then pick the plan from the official list.
  await page.getByTestId("account-service-search").fill("чат");
  await expect(page.getByTestId("account-service-chatgpt")).toBeVisible();
  await expect(page.getByTestId("account-service-canva")).toHaveCount(0);
  await page.getByTestId("account-service-search").fill("");
  await page.getByTestId("account-service-claude").click({ force: true });
  await page.getByTestId("account-plan-row").click({ force: true });
  await page.getByTestId("account-plan-pro").click({ force: true });
  await page.getByTestId("account-period-12").click({ force: true });
  await page.getByTestId("account-plan-done").click({ force: true });
  await expect(page.getByTestId("account-preview-title")).toHaveText("Claude Pro · 1 год, на аккаунт покупателя");
  await page.getByTestId("account-service-chatgpt").click({ force: true });
  await page.getByTestId("account-plan-row").click({ force: true });
  await expect(page.getByTestId("account-period-12")).toHaveCount(0);
  await page.getByTestId("account-plan-plus").click({ force: true });
  await page.getByTestId("account-plan-done").click({ force: true });
  await expect(page.getByTestId("account-plan-sheet")).toHaveCount(0);
  await page.getByLabel("Цена, ₸").fill("3990");
  await expect(page.getByTestId("account-preview-title")).toHaveText(title);
  await page.getByRole("button", { name: "Опубликовать на 30 дней" }).click({
    force: true
  });
  await waitForNetworkQuiet(page);
  await expect(page.getByText(title, { exact: true })).toBeVisible();

  await page.locator('nav[aria-label="Главная навигация"] button').nth(0).click({ force: true });
  await switchDevUser(page, "200002", "Member · @demo_member");
  await page.getByTestId("market-buy-accounts").click({ force: true });
  await page.getByText(title, { exact: true }).click({ force: true });
  await expect(page.getByTestId("account-detail-delivery")).toHaveText("Подписку оформят на ваш аккаунт");
  await page.getByTestId("account-submit-request").click({ force: true });
  await waitForNetworkQuiet(page);
  await expect(page.getByText("Запрос отправлен продавцу", { exact: true })).toBeVisible();

  await page.locator('nav[aria-label="Главная навигация"] button').nth(0).click({ force: true });
  await switchDevUser(page, "200001", "Owner · @demo_owner");
  await page.getByTestId("market-notifications").click({ force: true });
  await expect(page.getByTestId("account-sales-actions-card")).toBeVisible();
  await page.getByRole("button", { name: "Принять" }).click({ force: true });
  await waitForNetworkQuiet(page);
  await expect(page.getByText("@demo_member", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Написать покупателю" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Продано", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Не продано", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Написать покупателю" }).click({ force: true });
  await expect(page.getByRole("button", { name: "Продано", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Не продано", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Продано", exact: true }).click({
    force: true
  });
  await waitForNetworkQuiet(page);
  await expect(page.getByTestId("account-sales-actions-card")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Открыть архив/ })).toBeVisible();
  await page.getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await page.locator(".product-scope-switch").getByRole("button", { name: "Аккаунты" }).click({ force: true });
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

async function switchDevUser(page: Page, userId: string, optionName: string) {
  const container = page.getByTestId("dev-user-select");
  let returnedToMarket = false;
  if (!(await container.isVisible())) {
    const nav = page.getByRole("navigation", { name: "Главная навигация" });
    await nav.getByRole("button", { name: "Мои", exact: true }).click({ force: true });
    const toggleBtn = page.getByTestId("dev-controls-toggle");
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
    }
    await expect(container).toBeVisible();
    returnedToMarket = true;
  }
  await container.locator("select").selectOption({ label: optionName });
  await waitForNetworkQuiet(page);
  await expect(page.getByTestId("market-screen")).toBeVisible();
  if (returnedToMarket) {
    const nav = page.getByRole("navigation", { name: "Главная навигация" });
    await nav.getByRole("button", { name: "Маркет", exact: true }).click({ force: true });
    await expect(page.getByTestId("market-screen")).toBeVisible();
  }
}

async function waitForNetworkQuiet(page: Page) {
  await page.waitForTimeout(250);
}
