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
  await page.getByRole("button", { name: "Мои объявления" }).click({ force: true });
  await page.getByRole("button", { name: "Продать аккаунт" }).click({ force: true });
  await page.getByLabel("Что продаёте").fill("ChatGPT Plus на месяц");
  await page.getByLabel("Цена, ₸").fill("3990");
  await page.getByLabel("Описание").fill("Детали обсудим в Telegram");
  await page.getByRole("button", { name: "Опубликовать на 30 дней" }).click({
    force: true
  });
  await waitForNetworkQuiet(page);
  await expect(page.getByText("ChatGPT Plus на месяц", { exact: true })).toBeVisible();

  await page.locator(".bottom-nav button").nth(0).click({ force: true });
  await switchDevUser(page, "200002", "Member · @demo_member");
  await page.getByTestId("market-buy-accounts").click({ force: true });
  await page.getByText("ChatGPT Plus на месяц", { exact: true }).click({ force: true });
  await page.getByTestId("account-submit-request").click({ force: true });
  await waitForNetworkQuiet(page);
  await expect(page.getByText("Заявка отправлена продавцу", { exact: true })).toBeVisible();

  await page.locator(".bottom-nav button").nth(0).click({ force: true });
  await switchDevUser(page, "200001", "Owner · @demo_owner");
  await page.getByTestId("market-hero-pending-actions")
    .getByRole("button", { name: "Открыть действия", exact: true })
    .click({ force: true });
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
  await page.getByRole("button", { name: "Мои объявления" }).click({ force: true });
  await expect(page.getByText("ChatGPT Plus на месяц", { exact: true })).toBeVisible();
});

async function switchDevUser(page: Page, userId: string, optionName: string) {
  const select = page.getByTestId("dev-user-select");
  await select.locator("button").click({ force: true });
  await page.getByRole("option", { name: optionName, exact: true }).click({
    force: true
  });
  await expect(select).toHaveAttribute("data-value", userId);
  await waitForNetworkQuiet(page);
}

async function waitForNetworkQuiet(page: Page) {
  await page.waitForTimeout(250);
}
