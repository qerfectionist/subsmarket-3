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
  await expect(bottomNav.locator("button")).toHaveCount(3);
  await expect(bottomNav).toContainText("Маркет");
  await expect(bottomNav).toContainText("Мои");
  await expect(bottomNav).toContainText("Действия");
  await expect(page.locator(".subs-dock-create")).toContainText("Создать");

  await page.getByTestId("family-type-tariff").click({ force: true });
  await expect(page.getByTestId("family-catalog-screen")).toBeVisible();
  await expect(page.getByTestId("family-type-tariff")).toHaveAttribute("aria-pressed", "true");
  await bottomNav.getByRole("button", { name: "Маркет", exact: true }).click({
    force: true
  });
  await expect(page.getByTestId("market-screen")).toBeVisible();

  await page.getByTestId("family-type-subscription").click({ force: true });
  await expect(page.getByTestId("family-catalog-screen")).toBeVisible();
  await expect(page.getByTestId("family-type-subscription")).toHaveAttribute("aria-pressed", "true");
  await bottomNav.getByRole("button", { name: "Маркет", exact: true }).click({
    force: true
  });
  await expect(page.getByTestId("market-screen")).toBeVisible();

  await page.getByTestId("market-buy-gigabytes").click({ force: true });
  await expect(page.getByTestId("gigabytes-screen")).toBeVisible();
  await expect(page.getByText("Купить гигабайты", { exact: true }).first()).toBeVisible();
  await expect(bottomNav.getByRole("button", { name: "Маркет", exact: true })).toHaveAttribute("aria-current", "page");
  await page.locator(".gb-back").click({ force: true });
  await expect(page.getByTestId("market-screen")).toBeVisible();

  await page.getByTestId("market-buy-accounts").click({ force: true });
  await expect(page.getByTestId("accounts-screen")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Объявления аккаунтов" })).toBeVisible();
  await expect(bottomNav.getByRole("button", { name: "Маркет", exact: true })).toHaveAttribute("aria-current", "page");
  await page.locator(".gb-back").click({ force: true });
  await expect(page.getByTestId("market-screen")).toBeVisible();

  await bottomNav.getByRole("button", { name: "Маркет", exact: true }).click({ force: true });
  await expect(page.getByTestId("market-search-input")).toBeVisible();

  await page.locator(".subs-dock-create").getByRole("button", { name: "Создать", exact: true }).click({ force: true });
  await expect(page.getByTestId("create-family-form")).toBeVisible();
  await expect(page.getByTestId("create-share-preview")).toBeVisible();
  await page.locator(".product-scope-switch").getByRole("button", { name: "Аккаунты" }).click({ force: true });
  await expect(page.getByTestId("accounts-screen")).toBeVisible();
  await page.locator(".gb-back").click({ force: true });
  await expect(page.getByTestId("create-family-form")).toBeVisible();

  await bottomNav.getByRole("button", { name: "Мои", exact: true }).click({ force: true });
  await expect(
    page.locator(".family-workspace, .empty-state, [data-testid='family-list-skeleton']")
  ).toBeVisible();
  await expect(page.getByTestId("my-screen")).toBeVisible();
  await expect(page.getByTestId("my-screen").locator(".my-requests-section")).toHaveCount(0);

  await bottomNav.getByRole("button", { name: "Действия", exact: true }).click({ force: true });
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

test("Family catalog switches with a horizontal swipe", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.getByTestId("family-type-subscription").click({ force: true });
  await expect(page.getByTestId("family-catalog-screen")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Доступные подписки" })).toBeVisible();

  const viewport = page.locator(".sm-market-catalog-swipe-viewport");
  const box = await viewport.boundingBox();
  if (!box) throw new Error("Family catalog swipe viewport is not measurable");

  const y = box.y + Math.min(box.height / 2, 180);
  await page.mouse.move(box.x + box.width * 0.8, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, y, { steps: 10 });
  await page.mouse.up();

  await expect(page.getByTestId("family-type-tariff")).toHaveAttribute("aria-pressed", "true");
  const tariffPane = page.locator(".sm-market-catalog-swipe-pane[data-catalog-type='tariff']");
  await expect(tariffPane).toHaveAttribute("aria-hidden", "false");
  await expect(tariffPane.getByRole("heading", { name: /Доступные тарифы|Доступных тарифов пока нет/ })).toBeVisible();
});

test("My sections switch with a horizontal swipe", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await expect(page.getByTestId("my-screen")).toBeVisible();

  const scopeSwitch = page.getByRole("group", { name: "Разделы", exact: true });
  await expect(scopeSwitch.getByRole("button", { name: "Подписки", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(
    page.getByRole("group", { name: "Тип семейного предложения", exact: true })
  ).toHaveCount(0);
  const pager = page.locator(".my-product-scope-swipe-viewport");
  const box = await pager.boundingBox();
  if (!box) throw new Error("My product scope pager is not measurable");

  const y = box.y + Math.min(box.height / 2, 180);
  await page.mouse.move(box.x + box.width * 0.8, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, y, { steps: 10 });
  await page.mouse.up();

  await expect(scopeSwitch.getByRole("button", { name: "Аккаунты", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(
    page.locator(".my-product-scope-swipe-pane[data-product-scope='accounts']")
  ).toHaveAttribute("aria-hidden", "false");
});

test("My families open a role picker from the families scope", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await expect(page.getByTestId("my-screen")).toBeVisible();

  const scopeSwitch = page.getByRole("group", { name: "Разделы", exact: true });
  const familiesButton = scopeSwitch.getByRole("button", { name: "Подписки", exact: true });
  await expect(familiesButton).toHaveAttribute("aria-pressed", "true");
  const familyTypeFilter = page.getByTestId("my-family-filter-button");
  await expect(familyTypeFilter).toBeVisible();
  await familyTypeFilter.click();
  await expect(page.getByTestId("my-family-filter-label")).toHaveText("Тарифы");
  await familyTypeFilter.click();
  await expect(page.getByTestId("my-family-filter-label")).toHaveText("Сервисы");
  await familyTypeFilter.click();
  await expect(page.getByTestId("my-family-filter-label")).toHaveText("Все");
  const roleTrigger = page.getByTestId("my-family-role-trigger");
  await expect(roleTrigger).toBeVisible();
  await roleTrigger.click({ force: true });

  const picker = page.getByRole("dialog", { name: "Роль в семье" });
  await expect(picker).toBeVisible();
  await expect(roleTrigger).toHaveAttribute("aria-controls", "my-family-role-picker");
  await expect(picker.getByTestId("my-family-role-member")).toBeVisible();
  await expect(picker.getByTestId("my-family-role-owner")).toBeVisible();

  await picker.getByTestId("my-family-role-owner").click();
  await expect(picker).toHaveCount(0);

  await roleTrigger.click({ force: true });
  await expect(picker).toBeVisible();
  await expect(picker.getByTestId("my-family-role-all")).toBeVisible();
  await picker.getByTestId("my-family-role-all").click();
  await expect(picker).toHaveCount(0);

  const filterRowMetrics = await page.getByTestId("my-screen").locator(".my-family-filter-row").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  }));
  expect(filterRowMetrics.scrollWidth).toBeLessThanOrEqual(filterRowMetrics.clientWidth + 1);

  await page.getByRole("button", { name: "Календарь", exact: true }).click({ force: true });
  const calendarGridMetrics = await page.locator(".my-payment-calendar-hero .calendar__grid").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  }));
  expect(calendarGridMetrics.scrollWidth).toBeLessThanOrEqual(calendarGridMetrics.clientWidth + 1);
});

test("My marketplace role stays inside the selected product scope", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await expect(page.getByTestId("my-screen")).toBeVisible();

  const scopeSwitch = page.getByRole("group", { name: "Разделы", exact: true });
  await scopeSwitch.getByRole("button", { name: "Аккаунты", exact: true }).click();

  const tradeTrigger = page.getByTestId("my-accounts-trade-trigger");
  await tradeTrigger.click();
  const tradeMenu = page.getByRole("menu", { name: "Покупки и продажи аккаунтов" });
  await expect(tradeMenu).toBeVisible();
  await expect(tradeMenu.getByText("Покупки", { exact: true })).toBeVisible();
  await expect(tradeMenu.getByText("Продажи", { exact: true })).toBeVisible();

  await page.getByTestId("my-accounts-buyer-action").click();
  await expect(page.getByTestId("my-screen")).toBeVisible();
  await expect(page.getByText("Покупок пока нет")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Заявки", exact: true })).toHaveCount(0);

  await tradeTrigger.click();
  await page.getByTestId("my-accounts-seller-action").click();
  await expect(page.getByTestId("my-screen")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Заявки", exact: true })).toHaveCount(0);

  await tradeTrigger.click();
  await expect(page.getByTestId("my-accounts-seller-action")).toHaveAttribute("aria-checked", "true");
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
      avatar: read(".sm-market-avatar-button"),
      bottomNav: read("nav[aria-label='Главная навигация']")
    };
  });

    expect(colors.market.background).not.toBe("rgb(255, 255, 255)");
    expect(colors.market.background).toBe("rgb(33, 33, 33)");
    expect(colors.avatar.background).toBe("rgb(135, 116, 225)");
  expect(colors.title.color).not.toBe(colors.market.background);
  expect(colors.banner.color).not.toBe(colors.banner.background);
  expect(colors.bottomNav.background).not.toBe("rgb(255, 255, 255)");
});
