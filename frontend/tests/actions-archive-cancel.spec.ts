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

test("cancelled request smoothly animates into archive", async ({ page }) => {
  // 1. Seller publishes GB listing
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await page.locator(".product-scope-switch").getByRole("button", { name: "ГБ" }).click({ force: true });
  await expect(page.getByTestId("my-gigabytes-screen")).toBeVisible();

  const createButton = page.getByTestId("my-gigabytes-create-button");
  await createButton.scrollIntoViewIfNeeded();
  await createButton.click({ force: true });
  await expect(page.getByTestId("gigabytes-screen")).toBeVisible();
  await page.getByLabel("Цена за 1 ГБ, ₸").fill("150");
  await page.getByLabel("Описание").fill("Test listing for archive animation");
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

  // 3. Buyer opens Actions screen
  await page.getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Заявки", exact: true })
    .click({ force: true });
  await waitForNetworkQuiet(page);
  await page.waitForTimeout(450);

  const card = page.getByTestId("gigabytes-request-card");
  await expect(card).toBeVisible();
  const cancelBtn = page.getByTestId("trade-request-cancel-btn");
  await expect(cancelBtn).toBeVisible();

  // 4. Capture 3 sequential frames of the real cancellation
  // Frame 1: Before click
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/real_cancel_step1_before.png"
  });

  // Frame 2: Actively dissolving (Variant 3)
  await page.evaluate(() => {
    const card = document.querySelector('.my-trade-request');
    if (card) {
      card.classList.add('is-archiving-out');
      (card as HTMLElement).style.animationPlayState = 'paused';
      (card as HTMLElement).style.animationDelay = '-180ms';
    }
  });
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/real_cancel_step2_dissolving.png"
  });
  await page.evaluate(() => {
    const card = document.querySelector('.my-trade-request');
    if (card) {
      card.classList.remove('is-archiving-out');
      (card as HTMLElement).style.animationPlayState = '';
      (card as HTMLElement).style.animationDelay = '';
    }
  });

  // Now trigger actual cancel action
  const archiveTrigger = page.getByTestId("actions-archive-trigger");
  await cancelBtn.click({ force: true });

  // Wait for animation and request to settle
  await page.waitForTimeout(600);
  await waitForNetworkQuiet(page);

  // Frame 3: After complete collapse
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/real_cancel_step3_after.png"
  });

  // Card should now be removed from active feed
  await expect(page.getByTestId("gigabytes-request-card")).toHaveCount(0);
  await expect(page.getByText("Нет активных заявок")).toBeVisible();
  await expect(page.getByText("Все завершённые и отменённые заявки перемещены в архив.")).toBeVisible();

  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_after_cancel_empty_with_archive.png"
  });
  await page.evaluate(() => {
    document.documentElement.classList.remove("tma-dark");
    document.documentElement.classList.add("tma-light");
  });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_after_cancel_empty_with_archive_light.png"
  });
  await page.evaluate(() => {
    document.documentElement.classList.remove("tma-light");
    document.documentElement.classList.add("tma-dark");
  });

  // 5. Open archive and verify cancelled request is in the archive
  await archiveTrigger.click({ force: true });
  await page.waitForTimeout(400);

  await expect(page.locator("#actions-archive-disclosure")).toHaveClass(/is-open/);
  await expect(page.getByTestId("actions-archive-item")).toBeVisible();
  await expect(page.getByTestId("actions-archive-item").getByText("Отменена")).toBeVisible();

  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_archive_with_cancelled.png"
  });
  await page.evaluate(() => {
    document.documentElement.classList.remove("tma-dark");
    document.documentElement.classList.add("tma-light");
  });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_archive_with_cancelled_light.png"
  });
  await page.evaluate(() => {
    document.documentElement.classList.remove("tma-light");
    document.documentElement.classList.add("tma-dark");
  });

  // 6. Test Re-apply from archive
  const reapplyBtn = page.getByTestId("actions-archive-reapply-btn");
  await expect(reapplyBtn).toBeVisible();
  await reapplyBtn.click();
  await waitForNetworkQuiet(page);
  await page.waitForTimeout(500);

  await expect(page.locator("#actions-archive-disclosure")).not.toHaveClass(/is-open/);
  await expect(page.getByTestId("gigabytes-request-card")).toBeVisible();
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_after_reapply_restored.png"
  });
});
