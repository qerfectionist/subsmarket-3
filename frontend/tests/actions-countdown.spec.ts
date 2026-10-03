import { expect, test, type Page } from "@playwright/test";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";
const apiUrl = process.env.TMA_API_URL ?? "http://127.0.0.1:8001";

test.use({
  deviceScaleFactor: 2,
  isMobile: true,
  viewport: { width: 390, height: 844 },
});

test.beforeEach(async ({ page }) => {
  await page.request.post(`${apiUrl}/api/dev/reset-demo-data`);
  await page.addInitScript(() => window.localStorage.clear());
  page.on("dialog", (dialog) => dialog.accept());
});

test.afterEach(async ({ page }) => {
  await page.request.post(`${apiUrl}/api/dev/reset-demo-data`);
});

async function waitForNetworkQuiet(page: Page) {
  await page.waitForTimeout(250);
}

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

test("seller has undo countdown on accept and reject buttons", async ({ page }) => {
  // 1. Seller publishes GB listing
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await page.locator(".product-scope-switch").getByRole("button", { name: "ГБ" }).click({ force: true });
  await expect(page.getByTestId("my-gigabytes-screen")).toBeVisible();

  await page.getByTestId("my-gigabytes-create-button").click({ force: true });
  await expect(page.getByTestId("gigabytes-screen")).toBeVisible();
  await page.getByLabel("Цена за 1 ГБ, ₸").fill("150");
  await page.getByLabel("Описание").fill("Test listing for countdown undo");
  await page.getByRole("button", { name: "Опубликовать на 7 дней" }).click({ force: true });
  await waitForNetworkQuiet(page);

  // 2. Buyer sends request
  await page.locator('nav[aria-label="Главная навигация"] button').nth(0).click({ force: true });
  await switchDevUser(page, "200002", "Member · @demo_member");
  await page.getByTestId("market-buy-gigabytes").click({ force: true });
  const publicListing = page.getByTestId("gigabytes-listing-card").first();
  await publicListing.click({ force: true });
  await page.getByRole("button", { name: "5 ГБ" }).click({ force: true });
  const submitRequest = page.getByTestId("marketplace-submit-request");
  await expect(submitRequest).toBeEnabled();
  await submitRequest.click();
  await waitForNetworkQuiet(page);

  // 2.5 Buyer captures outgoing (Покупки)
  await page.getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Заявки", exact: true })
    .click({ force: true });
  await waitForNetworkQuiet(page);
  await page.waitForTimeout(450);
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/hybrid_buyer_purchases_dark.png"
  });
  await page.evaluate(() => {
    document.documentElement.classList.remove("tma-dark");
    document.documentElement.classList.add("tma-light");
  });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/hybrid_buyer_purchases_light.png"
  });
  await page.evaluate(() => {
    document.documentElement.classList.remove("tma-light");
    document.documentElement.classList.add("tma-dark");
  });

  // 3. Seller opens incoming requests in Actions
  await page.locator('nav[aria-label="Главная навигация"] button').nth(0).click({ force: true });
  await switchDevUser(page, "200001", "Owner · @demo_owner");
  const notificationsButton = page.getByTestId("market-notifications");
  await notificationsButton.click({ force: true });
  await expect(page.getByTestId("marketplace-actions-card")).toBeVisible();
  await waitForNetworkQuiet(page);
  await page.waitForTimeout(450);

  const acceptBtn = page.getByTestId("trade-request-accept-btn");
  const rejectBtn = page.getByTestId("trade-request-reject-btn");
  await expect(acceptBtn).toBeVisible();
  await expect(rejectBtn).toBeVisible();

  // Screenshot initial buttons
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/hybrid_seller_sales_dark.png",
  });
  await page.evaluate(() => {
    document.documentElement.classList.remove("tma-dark");
    document.documentElement.classList.add("tma-light");
  });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/hybrid_seller_sales_light.png",
  });
  await page.evaluate(() => {
    document.documentElement.classList.remove("tma-light");
    document.documentElement.classList.add("tma-dark");
  });

  // 4. Test Reject countdown + Undo
  await rejectBtn.click({ force: true });
  // Reject is counting down
  await expect(rejectBtn).toHaveClass(/is-countdown/);
  await expect(rejectBtn).toHaveClass(/is-reject/);
  await expect(rejectBtn).toContainText("Отмена");
  // Accept button is disabled while reject is counting down
  await expect(acceptBtn).toBeDisabled();

  // Screenshot reject countdown active
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_actions_reject_active.png",
  });

  // Cancel reject countdown
  await rejectBtn.click({ force: true });
  // Both buttons return to idle
  await expect(rejectBtn).not.toHaveClass(/is-countdown/);
  await expect(rejectBtn).toContainText("Отклонить");
  await expect(acceptBtn).not.toBeDisabled();
  await expect(acceptBtn).toContainText("Принять");

  // 5. Test Accept countdown + Undo test, then let it complete
  await acceptBtn.click({ force: true });
  // Accept is counting down
  await expect(acceptBtn).toHaveClass(/is-countdown/);
  await expect(acceptBtn).toHaveClass(/is-accept/);
  await expect(acceptBtn).toContainText("Отмена");
  await expect(rejectBtn).toBeDisabled();

  // Screenshot accept countdown active
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_actions_accept_active.png",
  });

  // In test mode (webdriver=true), effectiveDuration is 350ms, so it completes automatically
  await waitForNetworkQuiet(page);
  await expect(page.getByText("Можно написать", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Открыть Telegram" })).toBeVisible();

  // Screenshot accepted state
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_actions_accepted_done.png",
  });
});
