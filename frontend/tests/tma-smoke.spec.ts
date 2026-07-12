import { expect, test, type Page } from "@playwright/test";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";

test.use({
  deviceScaleFactor: 1,
  isMobile: true,
  viewport: { width: 390, height: 844 }
});

test("Mini App renders market, create, my, and family details", async ({ page }) => {
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
  await expect(page.getByTestId("market-screen")).toBeVisible();
  await expect(page.locator(".market-search-box")).toHaveCount(0);
  await expect(page.locator(".market-fast-grid")).toBeVisible();
  await expect(page.locator(".bottom-nav")).toBeVisible();
  await expect(page.locator(".bottom-nav button")).toHaveCount(4);
  await expect(page.locator(".bottom-nav")).toContainText("Маркет");
  await expect(page.locator(".bottom-nav")).toContainText("Мои");
  await expect(page.locator(".bottom-nav")).toContainText("Создать");
  await expect(page.locator(".bottom-nav")).toContainText("Действия");

  await openMarketSection(page, "market-find-tariff", "market-section-tariff");
  await expect(page.locator(".market-search-box")).toBeVisible();
  await page.locator(".market-section-back").click({ force: true });

  await openMarketSection(page, "market-find-subscription", "market-section-subscription");
  await expect(page.locator(".market-search-box")).toBeVisible();
  await page.locator(".market-section-back").click({ force: true });

  await openMarketSection(page, "market-buy-gigabytes", "market-section-gigabytes");
  await expect(page.getByTestId("market-section-soon-gigabytes")).toBeVisible();
  await expect(page.getByTestId("market-section-action-gigabytes-0")).toBeVisible();
  await page.locator(".market-section-back").click({ force: true });

  await openMarketSection(page, "market-buy-accounts", "market-section-accounts");
  await expect(page.getByTestId("market-section-soon-accounts")).toBeVisible();
  await expect(page.getByTestId("market-section-action-accounts-0")).toBeVisible();
  await page.locator(".market-section-back").click({ force: true });

  await page.locator(".bottom-nav button").nth(0).click({ force: true });
  await expect(page.getByTestId("invite-code-input")).toBeVisible();

  const detailButtons = page.getByTestId("open-family-button");
  if ((await detailButtons.count()) > 0) {
    await detailButtons.first().click({ force: true });
    await expect(page.locator(".detail-grid")).toBeVisible();
  }

  await page.locator(".bottom-nav button").nth(2).click({ force: true });
  await expect(page.getByTestId("create-family-form")).toBeVisible();
  await expect(page.getByTestId("create-share-preview")).toBeVisible();

  await page.locator(".bottom-nav button").nth(1).click({ force: true });
  await expect(
    page.locator(".family-workspace, .empty-state, [data-testid='family-list-skeleton']")
  ).toBeVisible();
  await expect(page.getByTestId("my-screen")).toBeVisible();

  await page.locator(".bottom-nav button").nth(3).click({ force: true });
  await expect(page.getByTestId("actions-screen")).toBeVisible();
  await expect(page.getByTestId("actions-summary")).toBeVisible();

  const relevantMessages = messages.filter(
    (message) =>
      !message.includes("telegram.org/js/telegram-web-app.js") &&
      !message.includes("not supported in version 6.0") &&
      !message.includes("net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin") &&
      !message.includes("React DevTools")
  );
  expect(relevantMessages).toEqual([]);
});

async function openMarketSection(page: Page, tileTestId: string, sectionTestId: string) {
  await page.getByTestId(tileTestId).click({ force: true });
  await expect(page.getByTestId(sectionTestId)).toBeVisible();
}
