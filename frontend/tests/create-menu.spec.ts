import { expect, test } from "@playwright/test";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";
const apiUrl = process.env.TMA_API_URL ?? "http://127.0.0.1:8001";
const ownerHeaders = {
  "X-Dev-Telegram-User-Id": "200001",
  "X-Dev-Telegram-Username": "demo_owner",
  "X-Dev-Telegram-First-Name": "Demo Owner"
};

test.use({ isMobile: true, viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.request.post(`${apiUrl}/api/dev/reset-demo-data`);
  await page.request.post(`${apiUrl}/api/catalog/import-family-services`);
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("subsmarket.devTelegramUser", "200001");
  });
});

async function openCreate(page: import("@playwright/test").Page) {
  await page.goto(appUrl);
  await page.locator(".subs-dock-create").getByRole("button", { name: "Создать", exact: true }).click();
  await expect(page.getByTestId("create-home")).toBeVisible();
}

test("«Создать» finds anything that can be created", async ({ page }) => {
  await openCreate(page);
  const home = page.getByTestId("create-home");
  await expect(page.getByTestId("create-kind-subscription")).toContainText("Семейная подписка");
  await expect(page.getByTestId("create-kind-subscription")).toContainText("Яндекс Плюс, Spotify");
  await expect(page.getByTestId("create-kind-tariff")).toContainText("Tele2");

  // One search across all four kinds; the menu steps aside while it is in use.
  const search = page.getByTestId("create-search");
  await search.fill("spotify");
  const results = page.getByTestId("create-search-results");
  await expect(results.getByTestId("create-row-subscription-spotify-family")).toContainText("Семейная подписка");
  await expect(results.getByTestId("create-row-accounts-spotify")).toContainText("Аккаунт");
  await expect(page.getByTestId("create-kind-subscription")).toHaveCount(0);
  expect(await page.evaluate(() => document.querySelector(".app-shell")!.scrollTop)).toBe(0);

  await search.fill("beeline");
  await expect(results.getByTestId("create-row-tariff-beeline-family-tariff")).toBeVisible();
  await results.getByTestId("create-row-gigabytes-beeline").click();
  await expect(page.getByTestId("gb-operator-beeline")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("create-form-back").click();
  await expect(page.getByTestId("create-kind-subscription")).toBeVisible();

  await search.fill("telegram");
  await results.getByTestId("create-row-accounts-telegram-premium").click();
  await expect(page.getByTestId("account-service-telegram-premium")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("create-form-back").click();

  await search.fill("ззззз");
  await expect(results).toContainText("Ничего не нашлось");

  // A family service opens straight on «Условия»; back goes to «Сервис», then to the menu.
  await search.fill("spotify");
  await results.getByTestId("create-row-subscription-spotify-family").click();
  await expect(page.getByTestId("create-family-form")).toHaveAttribute("data-step", "terms");
  await expect(page.getByTestId("create-family-screen").locator("h1")).toHaveText("Семейная подписка");
  await page.getByTestId("create-form-back").click();
  await expect(page.getByTestId("create-family-form")).toHaveAttribute("data-step", "service");
  await expect(page.getByTestId("create-service-option-spotify-family")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("create-form-back").click();
  await expect(home).toBeVisible();

  // Tapping «Создать» again from a form returns to the menu.
  await page.getByTestId("create-kind-gigabytes").click();
  await expect(page.getByTestId("gigabytes-screen")).toBeVisible();
  await page.locator(".subs-dock-create").getByRole("button", { name: "Создать", exact: true }).click();
  await expect(home).toBeVisible();
});

test("«Недавние» repeats what was created before with the same terms", async ({ page }) => {
  const created = await page.request.post(`${apiUrl}/api/marketplace/listings`, {
    headers: { ...ownerHeaders, "Idempotency-Key": `create-menu-${Date.now()}` },
    data: { operator_slug: "beeline", price_per_gb_kzt: 230, max_gb: 7, description: null }
  });
  expect(created.ok(), await created.text()).toBeTruthy();

  await openCreate(page);
  const recent = page.getByTestId("create-recent");
  await expect(recent).toBeVisible();
  const row = recent.getByTestId("create-row-gigabytes-beeline");
  await expect(row).toContainText("230 ₸ за ГБ");
  await page.screenshot({ path: "test-results/create-recent.png" });

  await row.click();
  await expect(page.getByTestId("gb-operator-beeline")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("gb-price-input")).toHaveValue("230");
});
