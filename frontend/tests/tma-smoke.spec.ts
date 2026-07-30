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
  await expect(page.getByTestId("market-search-input")).toBeVisible();
  await expect(page.getByTestId("family-type-subscription")).toBeVisible();
  await expect(page.getByTestId("family-type-tariff")).toBeVisible();
  const bottomNav = page.getByRole("navigation", { name: "Главная навигация" });
  await expect(bottomNav).toBeVisible();
  await expect(bottomNav.locator("button")).toHaveCount(4);
  await expect(bottomNav).toContainText("Маркет");
  await expect(bottomNav).toContainText("Мои");
  await expect(bottomNav).toContainText("Создать");
  await expect(bottomNav).toContainText("Действия");

  await page.getByTestId("family-type-tariff").click({ force: true });
  await expect(page.getByTestId("family-catalog-screen")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Семейные тарифы" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Назад в Маркет" }).click({
    force: true
  });
  await expect(page.getByTestId("market-screen")).toBeVisible();

  await page.getByTestId("family-type-subscription").click({ force: true });
  await expect(page.getByTestId("family-catalog-screen")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Семейные подписки" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Назад в Маркет" }).click({
    force: true
  });
  await expect(page.getByTestId("market-screen")).toBeVisible();

  await page.getByTestId("market-buy-gigabytes").click({ force: true });
  await expect(page.getByTestId("gigabytes-screen")).toBeVisible();
  await expect(page.getByText("Купить гигабайты", { exact: true }).first()).toBeVisible();
  await page.locator(".gb-back").click({ force: true });
  await expect(page.getByTestId("market-screen")).toBeVisible();

  await page.getByTestId("market-buy-accounts").click({ force: true });
  await expect(page.getByTestId("accounts-screen")).toBeVisible();
  await expect(page.getByText("Купить аккаунт", { exact: true })).toBeVisible();
  await page.locator(".gb-back").click({ force: true });
  await expect(page.getByTestId("market-screen")).toBeVisible();

  await bottomNav.locator("button").nth(0).click({ force: true });
  await expect(page.getByTestId("market-search-input")).toBeVisible();

  await bottomNav.locator("button").nth(2).click({ force: true });
  await expect(page.getByTestId("create-family-form")).toBeVisible();
  await expect(page.getByTestId("create-share-preview")).toBeVisible();

  await bottomNav.locator("button").nth(1).click({ force: true });
  await expect(
    page.locator(".family-workspace, .empty-state, [data-testid='family-list-skeleton']")
  ).toBeVisible();
  await expect(page.getByTestId("my-screen")).toBeVisible();

  await bottomNav.locator("button").nth(3).click({ force: true });
  await expect(page.getByTestId("actions-screen")).toBeVisible();
  await expect(page.getByTestId("actions-summary")).toHaveCount(0);

  const relevantMessages = messages.filter(
    (message) =>
      !message.includes("telegram.org/js/telegram-web-app.js") &&
      !message.includes("not supported in version 6.0") &&
      !message.includes("net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin") &&
      !message.includes("React DevTools")
  );
  expect(relevantMessages).toEqual([]);
});

test("Mini App keeps readable surfaces with legacy Telegram dark theme params", async ({
  page
}) => {
  await page.route("https://telegram.org/js/telegram-web-app.js*", (route) => route.abort());
  await page.addInitScript(() => {
    Object.defineProperty(window, "Telegram", {
      configurable: true,
      value: {
        WebApp: {
          colorScheme: "dark",
          themeParams: {
            bg_color: "#212121",
            text_color: "#ffffff",
            hint_color: "#aaaaaa",
            button_color: "#8774e1",
            button_text_color: "#ffffff"
          },
          version: "8.0",
          ready: () => undefined,
          expand: () => undefined,
          isVersionAtLeast: () => true,
          setHeaderColor: () => undefined,
          setBackgroundColor: () => undefined,
          setBottomBarColor: () => undefined,
          disableVerticalSwipes: () => undefined,
          enableVerticalSwipes: () => undefined,
          onEvent: () => undefined,
          offEvent: () => undefined
        }
      }
    });
  });

  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("market-screen")).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/tma-dark/);
  await expect(page.locator("html")).toHaveClass(/dark/);

  const colors = await page.evaluate(() => {
    const read = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing element: ${selector}`);
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color };
    };

    return {
      market: read("[data-testid='market-screen']"),
      title: read("[data-testid='family-type-subscription']"),
      banner: read("[data-testid='market-first-run-banner']"),
      bottomNav: read("nav[aria-label='Главная навигация']")
    };
  });

  expect(colors.market.background).not.toBe("rgb(255, 255, 255)");
  expect(colors.title.color).not.toBe(colors.market.background);
  expect(colors.banner.color).not.toBe(colors.banner.background);
  expect(colors.bottomNav.background).not.toBe("rgb(255, 255, 255)");
});
