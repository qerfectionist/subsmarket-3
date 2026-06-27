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
  await expect(page.getByTestId("home-screen")).toBeVisible();
  await expect(page.getByTestId("home-direction-row")).toHaveCount(3);
  await expect(page.getByTestId("home-quick-action")).toHaveCount(2);
  await expect(page.getByTestId("home-popular-services")).toContainText("YouTube Premium");
  await expect(page.locator(".bottom-nav")).toBeVisible();

  await page.locator(".bottom-nav button").nth(1).click();
  await expect(page.getByTestId("invite-code-input")).toBeVisible();

  const detailButtons = page.getByTestId("open-family-button");
  if ((await detailButtons.count()) > 0) {
    await detailButtons.first().click();
    await expect(page.locator(".detail-grid")).toBeVisible();
  }

  await page.locator(".bottom-nav button").nth(2).click();
  await expect(page.getByTestId("create-family-form")).toBeVisible();
  await expect(page.getByTestId("create-share-preview")).toBeVisible();

  await page.locator(".bottom-nav button").nth(3).click();
  await expect(
    page.locator(".family-workspace, .empty-state, [data-testid='family-list-skeleton']")
  ).toBeVisible();

  await page.locator(".bottom-nav button").nth(4).click();
  await expect(
    page.locator("[data-testid='request-card'], .empty-state, [data-testid='panel-skeleton']")
  ).toBeVisible();

  const relevantMessages = messages.filter(
    (message) =>
      !message.includes("telegram.org/js/telegram-web-app.js") &&
      !message.includes("not supported in version 6.0") &&
      !message.includes("net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin") &&
      !message.includes("React DevTools")
  );
  expect(relevantMessages).toEqual([]);
});
