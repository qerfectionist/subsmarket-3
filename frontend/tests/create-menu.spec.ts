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

test("«Создать» asks what to create and the options take turns", async ({ page }) => {
  await openCreate(page);
  await expect(page.getByRole("heading", { name: "Что создаём?" })).toBeVisible();
  const word = page.getByTestId("create-ticker-word");
  await expect(word).toHaveText("подписку");
  await expect(word).toHaveText("тариф", { timeout: 6000 });
});

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
  const empty = page.getByTestId("create-search-empty");
  await expect(empty).toContainText("Ничего не найдено");
  await empty.getByRole("button", { name: "Сбросить поиск" }).click();
  await expect(search).toHaveValue("");
  await expect(page.getByTestId("create-kind-subscription")).toBeVisible();

  // A family service opens straight on «Условия»; back goes to «Сервис», then to the menu.
  await search.fill("spotify");
  await results.getByTestId("create-row-subscription-spotify-family").click();
  await expect(page.getByTestId("create-family-form")).toHaveAttribute("data-step", "terms");
  await expect(page.getByTestId("create-family-form")).toHaveAttribute("data-family-type", "subscription");
  await expect(page.getByTestId("create-family-screen").locator("h1")).toHaveText("Цена и места");
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

  await row.click();
  await expect(page.getByTestId("gb-operator-beeline")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("gb-price-input")).toHaveValue("230");
});

test("search results scroll like a feed, with «Наверх» at the end", async ({ page }) => {
  await openCreate(page);
  await page.getByTestId("create-search").fill("a");
  const results = page.getByTestId("create-search-results");
  const toTop = page.locator(".create-feed-to-top");
  await expect(results.locator(".create-row").nth(8)).toHaveCount(1);
  await expect(toTop).toHaveAttribute("data-visible", "false");

  // The list moves inside itself; the screen stays put.
  await results.hover();
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => document.querySelector(".app-shell")!.scrollTop)).toBe(0);
  // Snapped: a row sits at the top edge.
  const offset = await results.evaluate((element) => {
    const top = element.getBoundingClientRect().top;
    return Math.min(
      ...Array.from(element.querySelectorAll(".create-row")).map((row) =>
        Math.abs(row.getBoundingClientRect().top - top)
      )
    );
  });
  expect(offset).toBeLessThan(2);
  await expect(toTop).toHaveAttribute("data-visible", "false");

  await results.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect(toTop).toHaveAttribute("data-visible", "true");
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/create-results-end.png" });
  await page.getByTestId("create-search-results-to-top").click();
  await expect.poll(() => results.evaluate((element) => element.scrollTop)).toBe(0);
  await expect(toTop).toHaveAttribute("data-visible", "false");
});

test("«Недавние» scrolls like a feed when there is more than fits", async ({ page }) => {
  const post = (path: string, data: object) =>
    page.request.post(`${apiUrl}${path}`, {
      headers: { ...ownerHeaders, "Idempotency-Key": crypto.randomUUID() },
      data
    });
  for (const operator of ["beeline", "tele2", "activ"]) {
    const response = await post("/api/marketplace/listings", { operator_slug: operator, price_per_gb_kzt: 200, max_gb: 5, description: null });
    expect(response.ok(), await response.text()).toBeTruthy();
  }
  const services = (await (await page.request.get(`${apiUrl}/api/marketplace/accounts/services`)).json()) as {
    slug: string;
    plans?: { code: string; periods: number[] }[];
    deliveries?: ("own_account" | "ready_account")[];
  }[];
  for (const service of services.filter((item) => item.plans?.length).slice(0, 4)) {
    const plan = service.plans![0];
    const response = await post("/api/marketplace/accounts/listings", {
      service_slug: service.slug,
      plan_code: plan.code,
      period_months: plan.periods[0],
      delivery: service.deliveries?.[0] ?? "own_account",
      price_kzt: 3000
    });
    expect(response.ok(), await response.text()).toBeTruthy();
  }

  await openCreate(page);
  const list = page.getByTestId("create-recent-list");
  await expect(list.locator(".create-row")).toHaveCount(7);
  const toTop = page.locator(".create-feed-to-top");
  await expect(toTop).toHaveAttribute("data-visible", "false");

  // The rows move inside «Недавние»; the menu above stays put.
  await list.hover();
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(900);
  expect(await list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.querySelector(".app-shell")!.scrollTop)).toBe(0);
  await expect(page.getByTestId("create-kind-subscription")).toBeInViewport();

  await list.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect(toTop).toHaveAttribute("data-visible", "true");
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/create-recent-end.png" });
  await page.getByTestId("create-recent-list-to-top").click();
  await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBe(0);

  // The count beside the title follows the filter; empty kinds can't be picked.
  await expect(page.getByTestId("create-recent-count")).toHaveText("7");
  await page.getByTestId("create-recent-filter").click();
  await expect(page.getByTestId("create-recent-option-subscription")).toBeDisabled();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/create-recent-filter.png" });
  await page.getByTestId("create-recent-option-gigabytes").click();
  await expect(page.getByTestId("create-recent-filter")).toContainText("Гигабайты");
  await expect(page.getByTestId("create-recent-count")).toHaveText("3");
  await expect(list.locator(".create-row")).toHaveCount(3);
  await expect(list.getByTestId("create-row-accounts-chatgpt")).toHaveCount(0);
});

test("service tiles on step 1 take a vertical swipe", async ({ page }) => {
  // A short screen, so the first page has more tiles than fit and can scroll.
  await page.setViewportSize({ width: 390, height: 600 });
  await openCreate(page);
  await page.getByTestId("create-kind-subscription").click();
  const tiles = page.locator(".create-service-sections").first();
  await expect(tiles).toBeVisible();
  // The touch lock must let a swipe up/down through to the tiles' own scroll area.
  const prevented = await tiles.evaluate((element) => {
    const target = element.querySelector(".create-service-tile") as HTMLElement;
    const touch = (y: number) =>
      new Touch({ identifier: 1, target, clientX: 100, clientY: y });
    const fire = (type: string, y: number) => {
      const event = new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches: type === "touchend" ? [] : [touch(y)],
        changedTouches: [touch(y)]
      });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };
    fire("touchstart", 400);
    return fire("touchmove", 340);
  });
  expect(prevented).toBe(false);
});

test("categories turn like a wheel with the chosen one first", async ({ page }) => {
  await openCreate(page);
  await page.getByTestId("create-kind-subscription").click();
  const tabs = page.locator('.create-category-wheel [role="tab"]');
  const tabCount = await tabs.count();
  expect(tabCount).toBeGreaterThan(2);
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  // No section titles: the wheel says which category is shown.
  await expect(page.locator(".create-service-section-title")).toHaveCount(0);
  await expect(page.getByTestId("create-service-option-youtube-premium")).toBeVisible();

  const wheel = page.locator(".create-category-wheel");
  const box = (await wheel.boundingBox())!;
  const swipe = async (dx: number) => {
    const y = box.y + box.height / 2;
    const x = box.x + box.width / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i += 1) await page.mouse.move(x + (dx * i) / 10, y);
    await page.waitForTimeout(80); // no flick: it settles on the name nearest the first place
    await page.mouse.up();
  };
  // The name in the first place, where the list starts (the side margin).
  const firstName = () =>
    page.evaluate(() => {
      const left = document.querySelector(".create-category-wheel")!.getBoundingClientRect().left + 20;
      const names = [...document.querySelectorAll<HTMLElement>(".create-category-wheel .create-service-chip")];
      return names
        .map((name) => ({ text: name.textContent, d: Math.abs(name.getBoundingClientRect().left - left) }))
        .sort((a, b) => a.d - b.d)[0].text;
    });
  await expect.poll(firstName).toBe("Популярное");

  // Swipe left by one name: «Популярное» goes off, the second takes the first place.
  const second = (await tabs.nth(1).textContent())!;
  const firstWidth = (await tabs.first().boundingBox())!.width;
  await swipe(-(firstWidth + 24));
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect.poll(firstName).toBe(second);
  await expect(page.getByTestId("create-service-option-youtube-premium")).toHaveCount(0);

  // A tap on «Популярное» turns back; a swipe right from it brings the last round from the left.
  // The ring shows a name more than once: tap the copy that is on screen.
  await page
    .locator(".create-category-wheel .create-service-chip", { hasText: "Популярное" })
    .evaluateAll((names) => {
      const box = document.querySelector(".create-category-wheel")!.getBoundingClientRect();
      const shown = names.find((name) => {
        const r = name.getBoundingClientRect();
        return r.left < box.right - 20 && r.right > box.left && Number(getComputedStyle(name).opacity) > 0.3;
      }) as HTMLElement;
      shown.click();
    });
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  await expect.poll(firstName).toBe("Популярное");
  await page.waitForTimeout(700); // the turn has settled
  const last = (await tabs.nth(tabCount - 1).textContent())!;
  const lastWidth = (await tabs.nth(tabCount - 1).boundingBox())!.width;
  await swipe(lastWidth + 24);
  await expect(tabs.nth(tabCount - 1)).toHaveAttribute("aria-selected", "true");
  await expect.poll(firstName).toBe(last);

  // Searching shows one list of matches and hides the wheel.
  await page.getByTestId("create-service-search").fill("spotify");
  await expect(wheel).toHaveCount(0);
  await expect(page.getByTestId("create-service-option-spotify-family")).toBeVisible();
});
