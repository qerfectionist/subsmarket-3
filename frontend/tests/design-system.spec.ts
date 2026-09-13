import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { FamilyService } from "../src/types";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";
const apiUrl = process.env.TMA_API_URL ?? "http://127.0.0.1:8001";
const ownerHeaders = {
  "X-Dev-Telegram-User-Id": "200001",
  "X-Dev-Telegram-Username": "demo_owner",
  "X-Dev-Telegram-First-Name": "Demo Owner"
};
const accountTitle = "ChatGPT Plus для индивидуального использования с подробным описанием";
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true });

test.beforeEach(async ({ page }) => {
  expect((await page.request.post(apiUrl + "/api/dev/reset-demo-data")).ok()).toBeTruthy();
  expect((await page.request.post(apiUrl + "/api/catalog/import-family-services")).ok()).toBeTruthy();
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("subsmarket.devTelegramUser", "200002");
    localStorage.setItem("subsmarket.firstRunBannerSeen.v1", "true");
  });
});
test.afterEach(async ({ page }) => {
  await page.request.post(apiUrl + "/api/dev/reset-demo-data");
});

async function seedOffers(request: APIRequestContext) {
  const services: FamilyService[] = await (await request.get(apiUrl + "/api/catalog/family-services")).json();
  const nextDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const familyIds: string[] = [];
  for (const slug of ["youtube-premium", "tele2-family-tariff"]) {
    const service = services.find(item => item.slug === slug)!;
    expect(service).toBeTruthy();
    const result = await request.post(apiUrl + "/api/families", {
      headers: ownerHeaders,
      data: {
        service_id: service.id, period: "monthly", max_members: Math.min(service.max_members, 6),
        plan_name: service.family_type === "tariff" ? "Семейный тариф на несколько номеров" : null,
        total_price_kzt: service.family_type === "tariff" ? 12000 : 3900,
        payment_day: 18, next_payment_date: nextDate,
        payment_bank: "kaspi", payment_phone: "+77001234567",
        description: "Условия подключения согласуем с владельцем семьи.", owner_rules: ""
      }
    });
    expect(result.ok(), await result.text()).toBeTruthy();
    familyIds.push((await result.json()).family.id);
  }
  const account = await request.post(apiUrl + "/api/marketplace/accounts/listings", {
    headers: ownerHeaders,
    data: { service_slug: "chatgpt", title: accountTitle, price_kzt: 990, description: "Готовый аккаунт. Подробные условия продавец сообщает перед покупкой." }
  });
  expect(account.ok(), await account.text()).toBeTruthy();
  const gigabytes = await request.post(apiUrl + "/api/marketplace/listings", {
    headers: ownerHeaders, data: { operator_slug: "tele2", price_per_gb_kzt: 120, description: "Передача после согласования объёма." }
  });
  expect(gigabytes.ok(), await gigabytes.text()).toBeTruthy();
  return familyIds;
}

test("own families and actions use the same surfaces", async ({ page }, info) => {
  const familyIds = await seedOffers(page.request);
  const submitted = await page.request.post(apiUrl + "/api/families/" + familyIds[0] + "/requests", {
    headers: { "X-Dev-Telegram-User-Id": "200002", "X-Dev-Telegram-Username": "demo_member", "X-Dev-Telegram-First-Name": "Demo Member" }
  });
  expect(submitted.ok(), await submitted.text()).toBeTruthy();
  await page.goto(appUrl + "?theme=dark");
  await page.getByRole("navigation", { name: "Главная навигация" }).getByRole("button", { name: "Действия", exact: true }).click();
  await expect(page.getByTestId("request-card")).toBeVisible();
  const actionSummary = page.getByTestId("actions-summary");
  await expect(actionSummary).toHaveAttribute("aria-label", "Сводка действий");
  const compactSummary = await actionSummary.evaluate((element) => ({
    columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
    primaryColumn: getComputedStyle(element.firstElementChild!).gridColumn,
    primaryHeight: element.firstElementChild!.getBoundingClientRect().height
  }));
  expect(compactSummary.columns).toBe(2);
  expect(compactSummary.primaryColumn).toBe("1 / -1");
  expect(compactSummary.primaryHeight).toBeGreaterThanOrEqual(100);
  await page.setViewportSize({ width: 430, height: 844 });
  await expect.poll(() => actionSummary.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(4);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath("actions-member.png") });
  await page.evaluate(() => localStorage.setItem("subsmarket.devTelegramUser", "200001"));
  // The initialization script resets storage on navigation, so use the real switch.
  await page.getByRole("navigation", { name: "Главная навигация" }).getByRole("button", { name: "Мои", exact: true }).click();
  await page.getByTestId("dev-user-select").locator("select").selectOption("200001");
  await expect(page.getByTestId("market-screen")).toBeVisible();
  await page.getByRole("navigation", { name: "Главная навигация" }).getByRole("button", { name: "Мои", exact: true }).click();
  await expect(page.getByTestId("family-workspace")).toHaveCount(1);
  await page.screenshot({ path: info.outputPath("my-owner.png") });
  await page.getByTestId("owner-details-button").click();
  await page.getByRole("tablist", { name: "Управление семьёй" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("manage-family.png") });
});

async function assertNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const elements = [...document.querySelectorAll<HTMLElement>(".sm-listing, .sm-listing-copy, .sm-listing-main, .gb-form, .family-overview-card, .subs-dock-surface")];
    return elements.filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.className);
  });
  expect(overflow).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
}

test("market cards; mobile search opens the selected offer", async ({ page }, info) => {
  await seedOffers(page.request);
  await page.goto(appUrl + "?theme=dark&menu=classic");
  await expect(page.getByRole("heading", { name: "Популярное сейчас" })).toBeVisible();
  await expect(page.locator(".sm-listing")).toHaveCount(4);
  await expect(page.locator(".sm-listing-footer .sm-market-family-owner")).toHaveCount(4);
  await expect(page.locator(".sm-market-owner-presence")).toHaveCount(4);
  await expect(page.locator(".sm-market-family-owner-indicator, .sm-market-owner-verified")).toHaveCount(0);
  const headingAlignment = await page.locator(".sm-market-section-heading").evaluate(el => {
    const title = el.querySelector(".sm-market-section-heading-copy h2")!.getBoundingClientRect();
    const filter = el.querySelector(":scope > .sm-market-filter-actions > .sm-market-filter-chip")!.getBoundingClientRect();
    return Math.abs((title.top + title.height / 2) - (filter.top + filter.height / 2));
  });
  expect(headingAlignment).toBeLessThanOrEqual(1);
  await expect(page.locator(".sm-market-section-heading > .sm-market-icon-button")).toHaveCount(0);
  await expect(page.locator(".sm-market-section-heading > .sm-market-filter-actions > .sm-market-filter-chip")).toHaveCount(1);
  await expect(page.locator(".sm-market-filter-chip > .sm-system-symbol")).toHaveCount(1);
  await expect(page.getByTestId("market-popular-account")).toContainText("Готовый аккаунт");
  await expect(page.getByTestId("market-popular-account")).not.toContainText("Подробные условия");
  const categoryMenu = await page.locator(".sm-market-service-grid").evaluate((element) => ({
    columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
    background: getComputedStyle(element).backgroundColor,
    border: getComputedStyle(element).borderTopWidth,
    shadow: getComputedStyle(element).boxShadow,
    radius: getComputedStyle(element).borderRadius
  }));
  expect(categoryMenu.columns).toBe(2);
  expect(categoryMenu.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(categoryMenu.border).toBe("1px");
  expect(categoryMenu.shadow).toBe("none");
  expect(categoryMenu.radius).toBe("20px");
  const categoryTile = await page.locator(".sm-market-service-tile").first().evaluate((element) => ({
    tileBackground: getComputedStyle(element).backgroundColor,
    tileBorder: getComputedStyle(element).borderTopWidth,
    iconBackground: getComputedStyle(element.querySelector(":scope > span")!).backgroundColor,
    iconShadow: getComputedStyle(element.querySelector(":scope > span")!).boxShadow
  }));
  expect(categoryTile.tileBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(categoryTile.tileBorder).toBe("0px");
  expect(categoryTile.iconBackground).toBe("rgba(0, 0, 0, 0)");
  expect(categoryTile.iconShadow).toBe("none");
  await expect(page.locator(".sm-market-service-tile small")).toHaveCount(0);
  const marketFilterButton = page.getByTestId("market-filter-button");
  const marketFilterLabel = page.getByTestId("market-filter-label");
  await expect(marketFilterButton).toHaveAttribute("aria-label", "Фильтр объявлений: Все");
  await expect(marketFilterLabel).toHaveText("Все");
  const bannerDots = page.locator(".sm-market-action-banner-dots button");
  if (await bannerDots.count()) {
    for (let index = 0; index < await bannerDots.count(); index += 1) {
      await expect(bannerDots.nth(index)).toHaveCSS("width", "44px");
      await expect(bannerDots.nth(index)).toHaveCSS("height", "44px");
    }
  }
  const activeBanner = page.getByTestId("market-notifications");
  if (await activeBanner.count() && await bannerDots.count() > 1) {
    const beforeSwipe = await activeBanner.getAttribute("aria-label");
    const bannerBox = await activeBanner.boundingBox();
    expect(bannerBox).not.toBeNull();
    await page.mouse.move(bannerBox!.x + bannerBox!.width * 0.7, bannerBox!.y + bannerBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(bannerBox!.x + bannerBox!.width * 0.2, bannerBox!.y + bannerBox!.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => page.getByTestId("market-notifications").getAttribute("aria-label")).not.toBe(beforeSwipe);
  }
  await marketFilterButton.click();
  await expect(marketFilterLabel).toHaveText("Семьи");
  await expect(page.locator(".sm-listing")).toHaveCount(2);
  await marketFilterButton.click();
  await expect(marketFilterLabel).toHaveText("Гигабайты");
  await expect(page.locator(".sm-listing")).toHaveCount(1);
  await expect(page.getByTestId("market-popular-gigabytes")).toBeVisible();
  await marketFilterButton.click();
  await expect(marketFilterLabel).toHaveText("Аккаунты");
  await expect(page.locator(".sm-listing")).toHaveCount(1);
  await expect(page.getByTestId("market-popular-account")).toBeVisible();
  await marketFilterButton.click();
  await expect(marketFilterLabel).toHaveText("Все");
  await expect(page.locator(".sm-listing")).toHaveCount(4);
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await assertNoOverflow(page);
    const cardShapes = await page.locator(".sm-listing").evaluateAll(cards => cards.map(card => ({
      radius: getComputedStyle(card).borderRadius,
      bottom: Math.round(card.getBoundingClientRect().bottom),
      footer: Math.round(card.querySelector(".sm-listing-footer")!.getBoundingClientRect().bottom)
    })));
    expect(cardShapes.every(shape => shape.radius === "20px" && shape.bottom === shape.footer)).toBeTruthy();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath("home.png") });
  await page.getByTestId("market-popular-account").scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("offers.png") });
  expect(await page.locator('[data-monochrome-source="dark"] img').first().evaluate(el => getComputedStyle(el).filter)).toBe("brightness(0) invert(1)");
  const marketSearch = page.locator(".sm-market-search");
  const marketSearchInput = page.getByTestId("market-search-input");
  const restingSearch = await marketSearch.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const iconBounds = element.querySelector("svg")!.getBoundingClientRect();
    return {
      background: getComputedStyle(element).backgroundColor,
      width: bounds.width,
      height: bounds.height,
      iconX: iconBounds.x - bounds.x,
      iconY: iconBounds.y - bounds.y
    };
  });
  await marketSearchInput.focus();
  await expect.poll(() => marketSearch.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(restingSearch.background);
  const focusedSearch = await marketSearch.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const iconBounds = element.querySelector("svg")!.getBoundingClientRect();
    return {
      outlineStyle: getComputedStyle(element).outlineStyle,
      width: bounds.width,
      height: bounds.height,
      iconX: iconBounds.x - bounds.x,
      iconY: iconBounds.y - bounds.y
    };
  });
  expect(focusedSearch.outlineStyle).toBe("solid");
  expect(focusedSearch).toEqual({
    outlineStyle: "solid",
    width: restingSearch.width,
    height: restingSearch.height,
    iconX: restingSearch.iconX,
    iconY: restingSearch.iconY
  });
  await marketSearchInput.fill("ChatGPT");
  await expect(page.locator(".sm-listing")).toHaveCount(1);
  await page.getByTestId("market-popular-account").click();
  await expect(page.locator(".gb-detail-card h2")).toHaveText(accountTitle);
  await expect(page.getByTestId("account-submit-request")).toBeVisible();
  await assertNoOverflow(page);
  await page.screenshot({ path: info.outputPath("account-detail.png") });
  await page.getByRole("navigation", { name: "Главная навигация" }).getByRole("button", { name: "Маркет", exact: true }).click();
  await page.getByTestId("market-popular-gigabytes").click();
  await expect(page.getByLabel("Сколько ГБ")).toBeVisible();
  await expect(page.locator(".gb-detail-card")).not.toContainText("числа");
  await page.screenshot({ path: info.outputPath("gigabytes-detail.png") });
  await page.getByRole("navigation", { name: "Главная навигация" }).getByRole("button", { name: "Маркет", exact: true }).click();
  await page.getByTestId("family-type-subscription").click();
  const catalogFilterButton = page.getByTestId("market-category-filter-button");
  const catalogFilterLabel = page.getByTestId("market-category-filter-label");
  const catalogPriceButton = page.getByTestId("market-price-sort-button");
  const catalogPriceLabel = page.getByTestId("market-price-sort-label");
  await expect(catalogFilterLabel).toHaveText("Все");
  await expect(catalogPriceLabel).toHaveText("Быстро");
  await catalogFilterButton.click();
  await expect(page.getByRole("menu", { name: "Категория сервиса" })).toBeVisible();
  await expect(page.getByTestId("market-category-option-video")).toContainText("Видео");
  await page.getByTestId("market-category-option-video").click();
  await expect(catalogFilterLabel).toHaveText("Видео");
  await expect(page.locator(".sm-listing")).toHaveCount(1);
  await expect(page.getByText("YouTube Premium", { exact: true })).toBeVisible();
  await catalogFilterButton.click();
  await page.getByTestId("market-category-option-all").click();
  await catalogPriceButton.click();
  await expect(page.getByRole("menu", { name: "Порядок объявлений" })).toBeVisible();
  await page.getByTestId("market-price-option-asc").click();
  await expect(catalogPriceLabel).toHaveText("Дешевле");
  await catalogPriceButton.click();
  await page.getByTestId("market-price-option-fast").click();
  await expect(catalogPriceLabel).toHaveText("Быстро");
  await page.getByTestId("family-card").click();
  await expect(page.getByTestId("detail-send-request-button")).toBeVisible();
  await page.screenshot({ path: info.outputPath("family-detail.png") });
  await page.getByRole("button", { name: "Назад", exact: true }).click();
  await expect(page.getByTestId("family-catalog-screen")).toBeVisible();
  await page.goto(appUrl + "?theme=light");
  await expect(page.getByTestId("market-popular-account")).toBeVisible();
  await page.getByTestId("market-popular-account").scrollIntoViewIfNeeded();
  expect(await page.locator('[data-monochrome-source="dark"] img').first().evaluate(el => getComputedStyle(el).filter)).toBe("none");
  await page.screenshot({ path: info.outputPath("offers-light.png") });
});

test("navigation and creation share tokens in both themes", async ({ page }, info) => {
  for (const theme of ["dark", "light"]) {
    await page.goto(appUrl + "?theme=" + theme);
    const nav = page.getByRole("navigation", { name: "Главная навигация" });
    await expect(nav).toBeVisible();
    const geometry = await page.locator(".subs-dock-surface").evaluate(el => ({
      radius: getComputedStyle(el).borderRadius,
      corner: getComputedStyle(el).getPropertyValue("corner-shape"),
      height: el.getBoundingClientRect().height
    }));
    expect(geometry).toEqual({ radius: "999px", corner: "round", height: 56 });
    const fade = await page.locator(".subs-dock").evaluate(el => {
      const style = getComputedStyle(el, "::before");
      return { content: style.content, backgroundImage: style.backgroundImage, height: parseFloat(style.height) };
    });
    expect(fade.content).toBe('""');
    expect(fade.backgroundImage).toContain("linear-gradient");
    expect(fade.height).toBeGreaterThan(100);
    await expect(page.locator(".subs-dock-surface > .subs-dock-item")).toHaveCount(3);
    const createGeometry = await page.locator(".subs-dock-create > .subs-dock-item").evaluate(el => ({
      radius: getComputedStyle(el).borderRadius,
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height
    }));
    expect(createGeometry).toEqual({ radius: "50%", width: 52, height: 52 });
    await page.locator(".subs-dock-create").getByRole("button", { name: "Создать", exact: true }).click();
    await expect(page.getByLabel("Сервис", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Период оплаты")).toBeVisible();
    await expect(page.locator(".product-scope-switch button").first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".family-type-switch button").first()).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: info.outputPath("create-family-" + theme + ".png") });
    await page.locator(".product-scope-switch").getByRole("button", { name: "Аккаунты" }).click();
    await expect(page.getByLabel("Что продаёте")).toBeVisible();
    await page.getByLabel("Что продаёте").fill(accountTitle);
    await assertNoOverflow(page);
    await page.screenshot({ path: info.outputPath("create-account-" + theme + ".png") });
    await nav.getByRole("button", { name: "Мои", exact: true }).click();
    await page.locator(".product-scope-switch").getByRole("button", { name: "Аккаунты" }).click();
    await expect(page.getByRole("heading", { name: "Мои объявления" })).toBeVisible();
  }
});

test("iOS layout pass can be disabled without changing the screen behavior", async ({ page }) => {
  await page.goto(appUrl + "?theme=dark&ios27=off");
  await expect(page.locator("html")).toHaveAttribute("data-ios27-layout", "off");
  await expect(page.locator(".subs-dock-surface")).toHaveCSS("height", "64px");
  await expect(page.locator(".subs-dock-create > .subs-dock-item")).toHaveCSS("width", "56px");

  await page.goto(appUrl + "?theme=dark");
  await expect(page.locator("html")).toHaveAttribute("data-ios27-layout", "on");
  await expect(page.locator(".subs-dock-surface")).toHaveCSS("height", "56px");
  await expect(page.locator(".subs-dock-create > .subs-dock-item")).toHaveCSS("width", "52px");
});

test("iOS layout pass adapts the dock and hero blocks in short landscape view", async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto(appUrl + "?menu=classic&theme=dark");
  await expect(page.locator(".subs-dock-surface")).toHaveCSS("height", "52px");
  await expect(page.locator(".subs-dock-create > .subs-dock-item")).toHaveCSS("width", "48px");
  await expect(page.locator(".sm-market-service-tile").first()).toHaveCSS("min-height", "60px");
  const actionBanner = page.locator(".sm-market-action-banner-button").first();
  if (await actionBanner.count()) await expect(actionBanner).toHaveCSS("min-height", "88px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test("empty, loading and error screens offer recovery", async ({ page }, info) => {
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/families/page?*", async route => { await gate; await route.continue(); });
  await page.goto(appUrl + "?theme=dark");
  await expect(page.getByRole("status", { name: "Загружаем предложения" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("loading.png") });
  release();
  await expect(page.getByTestId("market-empty-state")).toBeVisible();
  await page.screenshot({ path: info.outputPath("empty.png") });
  let fail = true;
  await page.route("**/api/marketplace/accounts/listings?*", route =>
    fail ? route.fulfill({ status: 503, json: { detail: "Unavailable" } }) : route.continue()
  );
  await page.reload();
  await page.getByTestId("market-buy-accounts").click();
  await expect(page.getByRole("alert")).toContainText("Не удалось загрузить");
  await expect(page.getByText("Объявлений пока нет", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("error.png") });
  fail = false;
  await page.getByRole("button", { name: "Повторить" }).click();
  await expect(page.getByText("Объявлений пока нет", { exact: true })).toBeVisible();
});

test("keyboard viewport keeps fields visible and hides the dock", async ({ page }, info) => {
  await page.route("https://telegram.org/js/telegram-web-app.js*", route => route.abort());
  await page.addInitScript(() => {
    const events: Record<string, (() => void)[]> = {};
    const noop = () => {};
    (window as any).Telegram = { WebApp: {
      colorScheme: "dark", version: "8.0", viewportHeight: 844, viewportStableHeight: 844,
      themeParams: {}, isVersionAtLeast: () => true, ready: noop, expand: noop,
      setHeaderColor: noop, setBackgroundColor: noop, setBottomBarColor: noop,
      disableVerticalSwipes: noop, enableVerticalSwipes: noop,
      onEvent: (name: string, handler: () => void) => { (events[name] ??= []).push(handler); },
      offEvent: (name: string, handler: () => void) => { events[name] = (events[name] ?? []).filter(fn => fn !== handler); }
    }};
    (window as any).__setKeyboard = (height: number) => {
      (window as any).Telegram.WebApp.viewportHeight = height;
      (events.viewportChanged ?? []).forEach(fn => fn());
    };
  });
  await page.goto(appUrl + "?theme=dark");
  await page.getByTestId("market-search-input").focus();
  await page.evaluate(() => (window as any).__setKeyboard(420));
  await expect(page.locator("html")).toHaveAttribute("data-keyboard-open", "");
  await expect(page.locator(".subs-dock")).toBeHidden();
  await expect(page.getByTestId("market-search-input")).toBeInViewport();
  expect(await page.locator(".subs-screen-scroll").evaluate(el => el.clientHeight)).toBe(420);
  await page.screenshot({ path: info.outputPath("keyboard.png") });
  await page.evaluate(() => (window as any).__setKeyboard(844));
  await expect(page.locator(".subs-dock")).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-keyboard-open");
  await page.locator(".subs-dock-create").getByRole("button", { name: "Создать", exact: true }).click();
  await page.locator(".product-scope-switch").getByRole("button", { name: "Аккаунты" }).click();
  await page.getByLabel("Описание").focus();
  await page.evaluate(() => (window as any).__setKeyboard(420));
  await expect(page.locator(".subs-dock")).toBeHidden();
  await expect(page.getByLabel("Описание")).toBeInViewport();
  await page.screenshot({ path: info.outputPath("keyboard-form.png") });
  await page.evaluate(() => (window as any).__setKeyboard(844));
  await expect(page.locator(".subs-dock")).toBeVisible();
});
