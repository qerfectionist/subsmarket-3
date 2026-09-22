import { expect, test } from "@playwright/test";

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

test("search works on accounts, gigabytes, and my screens", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });

  // 1. Check Accounts search
  await page.getByTestId("market-buy-accounts").click({ force: true });
  await expect(page.getByTestId("accounts-screen")).toBeVisible();
  const accountsSearch = page.getByTestId("accounts-search-input");
  await expect(accountsSearch).toBeVisible();
  await accountsSearch.fill("NonExistentQueryXYZ");
  await expect(page.getByTestId("account-catalog-empty")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ничего не найдено" })).toBeVisible();
  await page.locator(".sm-market-search-clear").click({ force: true });
  await expect(accountsSearch).toHaveValue("");

  // 2. Check Gigabytes search
  await page.locator('nav[aria-label="Главная навигация"] button').nth(0).click({ force: true });
  await page.getByTestId("market-buy-gigabytes").click({ force: true });
  await expect(page.getByTestId("gigabytes-screen")).toBeVisible();
  const gbSearch = page.getByTestId("gigabytes-search-input");
  await expect(gbSearch).toBeVisible();
  await gbSearch.fill("NonExistentGbQueryXYZ");
  await expect(page.getByTestId("gigabytes-catalog-empty")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ничего не найдено" })).toBeVisible();
  await page.locator(".sm-market-search-clear").click({ force: true });
  await expect(gbSearch).toHaveValue("");


});
