import { expect, test } from "@playwright/test";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";
const apiUrl = process.env.TMA_API_URL ?? "http://127.0.0.1:8001";

test.use({ isMobile: true, viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.request.post(`${apiUrl}/api/dev/reset-demo-data`);
  await page.request.post(`${apiUrl}/api/catalog/import-family-services`);
  await page.addInitScript(() => window.localStorage.clear());
});

test("«Создать» opens on a menu of what can be created and popular services", async ({ page }) => {
  await page.goto(appUrl);
  await page.locator(".subs-dock-create").getByRole("button", { name: "Создать", exact: true }).click();
  const home = page.getByTestId("create-home");
  await expect(home).toBeVisible();
  await expect(page.getByTestId("create-kind-subscription")).toContainText("Семейная подписка");
  await expect(page.getByTestId("create-kind-subscription")).toContainText("Яндекс Плюс, Spotify");
  await expect(page.getByTestId("create-kind-tariff")).toContainText("Tele2");

  // «Популярное» mixes all four categories and scrolls inside itself; the screen stays put.
  const list = page.getByTestId("create-popular-list");
  await expect(page.getByTestId("create-popular-tariff-tele2-family-tariff")).toBeVisible();
  await expect(list.getByTestId("create-popular-gigabytes-tele2")).toHaveCount(1);
  await expect(list.getByTestId("create-popular-accounts-chatgpt")).toHaveCount(1);
  await list.evaluate((element) => element.scrollBy(0, 400));
  expect(await page.evaluate(() => document.querySelector(".app-shell")!.scrollTop)).toBe(0);
  await expect(page.getByTestId("create-kind-subscription")).toBeInViewport();

  // The chip narrows the list to one category.
  await page.getByTestId("create-popular-filter").click();
  await page.getByTestId("create-popular-filter").click();
  await expect(page.getByTestId("create-popular-filter")).toContainText("Тарифы");
  await expect(list.getByTestId("create-popular-subscription-youtube-premium")).toHaveCount(0);
  await page.getByTestId("create-popular-filter").click();
  await page.getByTestId("create-popular-filter").click();
  await page.getByTestId("create-popular-filter").click();
  await expect(page.getByTestId("create-popular-filter")).toContainText("Все");

  // A popular GB operator opens the GB form with it picked.
  await list.getByTestId("create-popular-gigabytes-beeline").evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByTestId("gb-operator-beeline")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("create-form-back").click();

  // A popular account opens the account form with its service picked.
  await list.getByTestId("create-popular-accounts-telegram-premium").evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByTestId("account-service-telegram-premium")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("create-form-back").click();

  // A popular service opens its family straight on «Условия».
  await list.getByTestId("create-popular-subscription-spotify-family").evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByTestId("create-family-form")).toHaveAttribute("data-step", "terms");
  await expect(page.getByTestId("create-family-screen").locator("h1")).toHaveText("Семейная подписка");

  // Back goes to «Сервис» with Spotify picked, then to the menu.
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

test("«Наверх» in «Популярное» shows up only at the end of the list", async ({ page }) => {
  await page.goto(appUrl);
  await page.locator(".subs-dock-create").getByRole("button", { name: "Создать", exact: true }).click();
  const list = page.getByTestId("create-popular-list");
  const toTop = page.locator(".create-popular-to-top");
  await expect(list.getByTestId("create-popular-accounts-canva")).toHaveCount(1);
  await expect(toTop).toHaveAttribute("data-visible", "false");

  // Halfway down: still hidden.
  await list.evaluate((element) => element.scrollTo({ top: 300 }));
  await page.waitForTimeout(150);
  await expect(toTop).toHaveAttribute("data-visible", "false");

  // At the end: it rises in, and takes the list back to the top.
  await list.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect(toTop).toHaveAttribute("data-visible", "true");
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/create-popular-to-top.png" });
  await page.getByTestId("create-popular-scroll-to-top").click();
  await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBe(0);
  await expect(toTop).toHaveAttribute("data-visible", "false");
});
