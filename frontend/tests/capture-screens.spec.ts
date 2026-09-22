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
