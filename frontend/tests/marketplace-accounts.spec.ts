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
  await page.getByLabel("Что продаёте").fill("ChatGPT Plus на месяц");
  await page.getByLabel("Цена, ₸").fill("3990");
  await page.getByLabel("Описание").fill("Детали обсудим в Telegram");
  await page.getByRole("button", { name: "Опубликовать на 30 дней" }).click({
    force: true
  });
  await waitForNetworkQuiet(page);
  await expect(page.getByText("ChatGPT Plus на месяц", { exact: true })).toBeVisible();

  await page.locator('nav[aria-label="Главная навигация"] button').nth(0).click({ force: true });
  await switchDevUser(page, "200002", "Member · @demo_member");
  await page.getByTestId("market-buy-accounts").click({ force: true });
  await page.getByText("ChatGPT Plus на месяц", { exact: true }).click({ force: true });
  await page.getByTestId("account-submit-request").click({ force: true });
  await waitForNetworkQuiet(page);
  await expect(page.getByText("Запрос отправлен продавцу", { exact: true })).toBeVisible();

  await page.locator('nav[aria-label="Главная навигация"] button').nth(0).click({ force: true });
  await switchDevUser(page, "200001", "Owner · @demo_owner");
  await page.getByTestId("market-notifications").click({ force: true });
  await expect(page.getByTestId("account-sales-actions-card")).toBeVisible();
  await page.getByTestId("account-sales-actions-card")
    .getByRole("button", { name: "Открыть" })
    .click({ force: true });
  await expect(page.getByTestId("accounts-screen")).toBeVisible();
  await page.getByRole("button", { name: "Принять" }).click({ force: true });
  await waitForNetworkQuiet(page);
  await expect(page.getByText("@demo_member", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Написать" })).toBeVisible();
  await page.getByRole("button", { name: "Продано", exact: true }).click({
    force: true
  });
  await waitForNetworkQuiet(page);
  await expect(page.getByText("закрыта", { exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await page.locator(".product-scope-switch").getByRole("button", { name: "Аккаунты" }).click({ force: true });
  await expect(page.getByText("ChatGPT Plus на месяц", { exact: true })).toBeVisible();
});

async function switchDevUser(page: Page, userId: string, optionName: string) {
  const container = page.getByTestId("dev-user-select");
  let returnedToMarket = false;
  if (!(await container.isVisible())) {
    const nav = page.getByRole("navigation", { name: "Главная навигация" });
    await nav.getByRole("button", { name: "Мои", exact: true }).click({ force: true });
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
