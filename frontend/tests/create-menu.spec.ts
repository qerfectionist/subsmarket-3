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
  await expect(page.getByTestId("create-kind-subscription")).toContainText("Семья на подписку");
  await expect(page.getByTestId("create-kind-subscription")).toContainText("YouTube Premium");
  await expect(page.getByTestId("create-kind-tariff")).toContainText("Tele2");

  // A popular service opens its family straight on «Условия».
  await page.getByTestId("create-popular-spotify-family").click();
  await expect(page.getByTestId("create-family-form")).toHaveAttribute("data-step", "terms");
  await expect(page.getByTestId("create-family-screen").locator("h1")).toHaveText("Семья на подписку");

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
