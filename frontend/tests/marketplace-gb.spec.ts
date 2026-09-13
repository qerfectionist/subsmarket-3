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

test("seller publishes GB and accepts a buyer request", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.getByTestId("market-buy-gigabytes").click({ force: true });
  await expect(page.getByTestId("gigabytes-screen")).toBeVisible();

  await page.getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await page.locator(".product-scope-switch").getByRole("button", { name: "ГБ" }).click({ force: true });
  await expect(page.getByTestId("my-screen")).toBeVisible();
  await expect(page.getByTestId("my-gigabytes-screen")).toBeVisible();
  await expect(page.getByTestId("gigabytes-screen")).toHaveCount(0);
  await page.getByTestId("my-gigabytes-create-button").click({ force: true });
  await expect(page.getByTestId("gigabytes-screen")).toBeVisible();
  await page.getByLabel("Цена за 1 ГБ, ₸").fill("100");
  await expect(
    page.getByText("Пока недостаточно объявлений для сравнения цены.")
  ).toBeVisible();
  await page.getByLabel("Описание").fill("E2E mobile data listing");
  await page.getByRole("button", { name: "Опубликовать на 7 дней" }).click({
    force: true
  });
  await waitForNetworkQuiet(page);
  await expect(page.getByText("Tele2", { exact: true })).toBeVisible();

  await page.locator('nav[aria-label="Главная навигация"] button').nth(0).click({ force: true });
  await switchDevUser(page, "200002", "Member · @demo_member");
  await page.getByTestId("market-buy-gigabytes").click({ force: true });
  const publicListing = page.getByTestId("gigabytes-listing-card");
  await expect(publicListing).toHaveCount(1);
  await publicListing.click({ force: true });
  const amountInput = page.getByLabel("Сколько ГБ");
  await expect(amountInput).toHaveAttribute("inputmode", "numeric");
  await expect(page.getByRole("button", { name: "3 ГБ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "5 ГБ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "10 ГБ" })).toBeVisible();
  await page.getByRole("button", { name: "5 ГБ" }).click({ force: true });
  await expect(amountInput).toHaveValue("5");
  await expect(page.getByText("Итого: 500 ₸", { exact: true })).toBeVisible();
  const requestResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/api/marketplace/listings/`) &&
      response.url().endsWith("/requests")
  );
  const submitRequest = page.getByTestId("marketplace-submit-request");
  await expect(submitRequest).toBeEnabled();
  await submitRequest.click();
  expect((await requestResponse).status()).toBe(201);
  await waitForNetworkQuiet(page);
  await expect(page.getByText("Заявка отправлена продавцу", { exact: true })).toBeVisible();

  await page.locator('nav[aria-label="Главная навигация"] button').nth(0).click({ force: true });
  await switchDevUser(page, "200001", "Owner · @demo_owner");
  const notificationsButton = page.getByTestId("market-notifications");
  await expect(notificationsButton).toBeVisible();
  await notificationsButton.click({ force: true });
  await expect(page.getByTestId("marketplace-actions-card")).toBeVisible();
  await page.getByTestId("open-marketplace-actions").click({ force: true });
  await expect(page.getByTestId("gigabytes-screen")).toBeVisible();
  await expect(page.getByTestId("marketplace-sales-role")).toHaveClass(/active/);
  await waitForNetworkQuiet(page);
  await expect(page.getByText("Ждёт ответа", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Принять" }).click({ force: true });
  await waitForNetworkQuiet(page);
  await expect(page.getByText("Можно написать", { exact: true })).toBeVisible();
  await expect(page.getByText("@demo_member", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Открыть Telegram" })).toBeVisible();

  await page.locator('nav[aria-label="Главная навигация"] button').nth(0).click({ force: true });
  await switchDevUser(page, "200002", "Member · @demo_member");
  const buyerNotificationsButton = page.getByTestId("market-notifications");
  await expect(buyerNotificationsButton).toBeVisible();
  await buyerNotificationsButton.click({ force: true });
  await expect(page.getByTestId("marketplace-purchase-actions-card")).toBeVisible();
  await page.getByTestId("open-marketplace-purchase-actions").click({ force: true });
  await expect(page.getByTestId("marketplace-purchases-role")).toHaveClass(/active/);
  await expect(page.getByText("@demo_owner", { exact: true })).toBeVisible();

  await page.locator('nav[aria-label="Главная навигация"] button').nth(0).click({ force: true });
  await switchDevUser(page, "200001", "Owner · @demo_owner");
  await page.getByTestId("market-notifications").click({ force: true });
  await page.getByTestId("open-marketplace-actions").click({ force: true });
  await page.getByRole("button", { name: "Продано" }).click({ force: true });
  await waitForNetworkQuiet(page);
  await expect(page.getByText("Закрыта", { exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await page.locator(".product-scope-switch").getByRole("button", { name: "ГБ" }).click({ force: true });
  await expect(page.getByText("Tele2", { exact: true })).toBeVisible();
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
