import { expect, test } from "@playwright/test";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";

test.use({
  deviceScaleFactor: 1,
  isMobile: true,
  viewport: { width: 390, height: 844 }
});

test("Mini App renders home, search, and family details", async ({ page }) => {
  const messages: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning", "warn"].includes(message.type())) {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    messages.push(`pageerror: ${error.message}`);
  });

  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".home-hero")).toBeVisible();
  await expect(page.locator(".home-hero")).toContainText("Найдите семью для подписки");
  await expect(page.locator(".trust-strip")).toContainText("Заявка");
  await expect(page.locator(".bottom-nav")).toBeVisible();

  await page.locator(".bottom-nav button").nth(1).click();
  await expect(page.locator(".panel")).toBeVisible();

  const detailButtons = page.locator(".family-card button.secondary");
  if ((await detailButtons.count()) > 0) {
    await detailButtons.first().click();
    await expect(page.locator(".detail-grid")).toBeVisible();
  }

  await page.locator(".bottom-nav button").nth(2).click();
  await expect(page.locator("form.form-grid")).toBeVisible();
  await expect(page.getByTestId("create-share-preview")).toBeVisible();

  await page.locator(".bottom-nav button").nth(3).click();
  await expect(page.locator(".panel")).toBeVisible();

  await page.locator(".bottom-nav button").nth(4).click();
  await expect(page.locator(".panel")).toBeVisible();

  const relevantMessages = messages.filter(
    (message) =>
      !message.includes("telegram.org/js/telegram-web-app.js") &&
      !message.includes("not supported in version 6.0") &&
      !message.includes("React DevTools")
  );
  expect(relevantMessages).toEqual([]);
});
