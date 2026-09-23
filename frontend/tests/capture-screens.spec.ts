import { test } from "@playwright/test";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";
const apiUrl = process.env.TMA_API_URL ?? "http://127.0.0.1:8001";
const outDir = "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212";

test.use({
  deviceScaleFactor: 2,
  isMobile: true,
  viewport: { width: 390, height: 844 }
});

test.beforeEach(async ({ page }) => {
  await page.request.post(`${apiUrl}/api/dev/reset-demo-data`);
  await page.addInitScript(() => window.localStorage.clear());
});

test("capture 1: market home", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${outDir}/screen_1_market_home.png` });
});

test("capture 2: catalog subscriptions", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByTestId("family-type-subscription").click({ force: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/screen_2_catalog_subs.png` });
});

test("capture 3: catalog tariffs", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByTestId("family-type-tariff").click({ force: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/screen_3_catalog_tariffs.png` });
});

test("capture 4: accounts catalog", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByTestId("market-buy-accounts").click({ force: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/screen_4_accounts.png` });
});

test("capture 5: gigabytes catalog", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByTestId("market-buy-gigabytes").click({ force: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/screen_5_gigabytes.png` });
});

test("capture 6: my screen subscriptions", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/screen_6_my_subs.png` });
});

test("capture 7: my screen accounts", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await page.locator(".product-scope-switch").getByRole("button", { name: "Аккаунты" }).click({ force: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/screen_7_my_accounts.png` });
});

test("capture 8: my screen gb", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await page.locator(".product-scope-switch").getByRole("button", { name: "ГБ" }).click({ force: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/screen_8_my_gb.png` });
});

test("capture 9: actions screen", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Заявки", exact: true })
    .click({ force: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/screen_actions_fixed.png` });
});

test("capture 10: actions screen with archive open", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Заявки", exact: true })
    .click({ force: true });
  await page.getByTestId("actions-archive-trigger").click({ force: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/screen_actions_archive_open.png` });
});

test("capture 11: actions screen with populated archive", async ({ page }) => {
  await page.route("**/api/marketplace/accounts/requests/me*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "req-closed-1",
            listing_id: "list-1",
            title: "ChatGPT Plus",
            service_slug: "chatgpt",
            service_name: "ChatGPT",
            price_kzt: 1200,
            status: "closed",
            buyer_user_id: 1,
            seller_user_id: 2,
            counterparty_username: "buyer_alex",
            created_at: "2026-09-17T23:17:00Z",
            updated_at: "2026-09-17T23:17:00Z"
          },
          {
            id: "req-rejected-2",
            listing_id: "list-2",
            title: "Canva Pro",
            service_slug: "canva",
            service_name: "Canva",
            price_kzt: 990,
            status: "rejected",
            buyer_user_id: 1,
            seller_user_id: 2,
            counterparty_username: "user_olga",
            created_at: "2026-09-16T12:00:00Z",
            updated_at: "2026-09-16T12:00:00Z"
          }
        ],
        next_cursor: null
      })
    });
  });
  await page.route("**/api/marketplace/gigabytes/requests/me*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "gb-req-closed-1",
            listing_id: "gb-1",
            amount_gb: 15,
            operator_name: "Tele2",
            total_price_kzt: 1800,
            status: "closed",
            counterparty_username: "serik_k",
            created_at: "2026-09-18T10:00:00Z",
            updated_at: "2026-09-18T10:00:00Z"
          }
        ],
        next_cursor: null
      })
    });
  });
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Заявки", exact: true })
    .click({ force: true });
  await page.getByTestId("actions-archive-trigger").click({ force: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/screen_actions_archive_populated.png` });

  // Click on a calendar day that has events to test week mode collapse
  const eventDayCell = page.locator(".my-payment-calendar-hero-cell.has-event").first();
  if (await eventDayCell.count() > 0) {
    await eventDayCell.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${outDir}/screen_actions_archive_week_mode.png` });
  }

  // Click first archive item to test expand
  await page.getByTestId("actions-archive-item").first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/screen_actions_archive_expanded.png` });

  // Switch to outbox tab and capture outbox archive (Покупок / Потрачено)
  await page.getByRole("button", { name: "Исходящие", exact: true }).click({ force: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/screen_actions_archive_outbox.png` });
});
