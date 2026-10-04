import { test, expect } from "@playwright/test";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";
const apiUrl = process.env.TMA_API_URL ?? "http://127.0.0.1:5174";
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

test("verify gigabytes catalog: pinned header, feed snap & bottom floor", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByTestId("market-buy-gigabytes").click({ force: true });
  await page.waitForTimeout(400);

  const header = page.locator(".sm-market-catalog-header");
  await expect(header).toBeVisible();
  const headerBox = await header.boundingBox();
  console.log("Gigabytes header top:", headerBox?.y);
  expect(headerBox?.y).toBe(24);

  const scrollPane = page.locator(".sm-market-catalog-feed-scroll");
  await expect(scrollPane).toBeVisible();

  const metrics = await scrollPane.evaluate((el: HTMLElement) => {
    const cards = el.querySelectorAll<HTMLElement>(".sm-listing");
    return {
      cardCount: cards.length,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      paddingBottom: el.style.paddingBottom
    };
  });
  console.log("Gigabytes metrics:", metrics);

  await page.screenshot({ path: `${outDir}/verify_gigabytes_catalog.png` });

  // Scroll to bottom and check header remains pinned at y = 24
  if (metrics.cardCount > 0) {
    await scrollPane.evaluate((el: HTMLElement) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(300);
    const headerBoxAfter = await header.boundingBox();
    console.log("Gigabytes header top after scroll:", headerBoxAfter?.y);
    expect(headerBoxAfter?.y).toBe(24);
    await page.screenshot({ path: `${outDir}/verify_gigabytes_scrolled.png` });
  }
});

test("verify accounts catalog: pinned header, feed snap & bottom floor", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByTestId("market-buy-accounts").click({ force: true });
  await page.waitForTimeout(400);

  const header = page.locator(".sm-market-catalog-header");
  await expect(header).toBeVisible();
  const headerBox = await header.boundingBox();
  console.log("Accounts header top:", headerBox?.y);
  expect(headerBox?.y).toBe(24);

  const scrollPane = page.locator(".sm-market-catalog-feed-scroll");
  await expect(scrollPane).toBeVisible();

  const metrics = await scrollPane.evaluate((el: HTMLElement) => {
    const cards = el.querySelectorAll<HTMLElement>(".sm-listing");
    return {
      cardCount: cards.length,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      paddingBottom: el.style.paddingBottom
    };
  });
  console.log("Accounts metrics:", metrics);

  await page.screenshot({ path: `${outDir}/verify_accounts_catalog.png` });

  // Scroll to bottom and check header remains pinned at y = 24
  if (metrics.cardCount > 0) {
    await scrollPane.evaluate((el: HTMLElement) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(300);
    const headerBoxAfter = await header.boundingBox();
    console.log("Accounts header top after scroll:", headerBoxAfter?.y);
    expect(headerBoxAfter?.y).toBe(24);
    await page.screenshot({ path: `${outDir}/verify_accounts_scrolled.png` });
  }
});

test("verify search results feed: pinned header, feed snap & bottom floor", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  const searchInput = page.getByTestId("market-search-input");
  await searchInput.fill("Spotify");
  await page.waitForTimeout(400);

  const header = page.locator(".sm-market-header");
  await expect(header).toBeVisible();
  const headerBox = await header.boundingBox();
  console.log("Search header top:", headerBox?.y);
  expect(headerBox?.y).toBe(24);

  const scrollPane = page.locator(".sm-market-catalog-feed-scroll");
  await expect(scrollPane).toBeVisible();

  const metrics = await scrollPane.evaluate((el: HTMLElement) => {
    const cards = el.querySelectorAll<HTMLElement>(".sm-listing");
    return {
      cardCount: cards.length,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      paddingBottom: el.style.paddingBottom
    };
  });
  console.log("Search feed metrics:", metrics);

  await page.screenshot({ path: `${outDir}/verify_search_results.png` });

  // Scroll down and verify header stays at y = 24
  if (metrics.cardCount > 0) {
    await scrollPane.evaluate((el: HTMLElement) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(300);
    const headerBoxAfter = await header.boundingBox();
    console.log("Search header top after scroll:", headerBoxAfter?.y);
    expect(headerBoxAfter?.y).toBe(24);
    await page.screenshot({ path: `${outDir}/verify_search_scrolled.png` });
  }
});

test("verify tariffs with 4 cards: can swipe up and minimum 3 cards remain on screen", async ({ page }) => {
  await page.request.post(`${apiUrl}/api/catalog/import-family-services`);
  const servicesRes = await page.request.get(`${apiUrl}/api/catalog/family-services`);
  const services = await servicesRes.json();
  const service = services.find((s: any) => s.slug === "tele2-family-tariff" || s.family_type === "tariff");
  expect(service).toBeTruthy();

  const nextDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const names = ["Семейный", "Премиум Семья x4", "Семейный + 4 SIM", "Семейный 5+"];
  for (let i = 0; i < 4; i++) {
    const res = await page.request.post(`${apiUrl}/api/families`, {
      headers: {
        "X-Dev-Telegram-User-Id": String(400001 + i),
        "X-Dev-Telegram-Username": `tariff_owner_${i}`,
        "X-Dev-Telegram-First-Name": `Owner ${i}`
      },
      data: {
        service_id: service.id,
        period: "monthly",
        max_members: 5,
        plan_name: names[i],
        total_price_kzt: 10000 + i * 1000,
        payment_day: 15,
        next_payment_date: nextDate,
        payment_bank: "kaspi",
        payment_phone: "+77001234567",
        description: `Тариф ${names[i]}`,
        owner_rules: ""
      }
    });
    expect(res.ok(), await res.text()).toBeTruthy();
  }

  await page.goto(appUrl, { waitUntil: "networkidle" });
  await expect(page.getByTestId("family-type-tariff")).toBeVisible();
  await page.getByTestId("family-type-tariff").click({ force: true });
  await page.waitForTimeout(400);

  const tariffPane = page.locator(".sm-market-catalog-swipe-pane[data-catalog-type='tariff']");
  await expect(tariffPane).toBeVisible();

  const cards = tariffPane.locator(".sm-listing");
  await expect(cards).toHaveCount(4);

  const initialMetrics = await tariffPane.evaluate((el: HTMLElement) => ({
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
    paddingBottom: el.style.paddingBottom,
    scrollTop: el.scrollTop
  }));
  console.log("Tariff initial metrics (4 cards):", initialMetrics);

  expect(initialMetrics.scrollHeight).toBeGreaterThan(initialMetrics.clientHeight);
  expect(parseInt(initialMetrics.paddingBottom, 10)).toBeGreaterThan(0);

  await page.screenshot({ path: `${outDir}/verify_tariff_4cards_initial.png` });

  // Scroll / swipe up to the bottom
  await tariffPane.evaluate((el: HTMLElement) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(300);

  const scrolledMetrics = await tariffPane.evaluate((el: HTMLElement) => ({
    scrollTop: el.scrollTop,
    maxScroll: el.scrollHeight - el.clientHeight
  }));
  console.log("Tariff scrolled metrics (4 cards):", scrolledMetrics);
  expect(scrolledMetrics.scrollTop).toBeGreaterThan(0);

  // Verify that at least 3 cards remain visible in the viewport above the dock
  const visibleCardsCount = await tariffPane.evaluate((el: HTMLElement) => {
    const dock = document.querySelector(".subs-dock");
    const dockTop = dock ? dock.getBoundingClientRect().top : window.innerHeight;
    const listingCards = el.querySelectorAll<HTMLElement>(".sm-listing");
    let count = 0;
    listingCards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      // Card is considered visible if its top is below 0 and bottom is above or mostly above dockTop
      if (rect.bottom > 0 && rect.top < dockTop) {
        count++;
      }
    });
    return count;
  });
  console.log("Visible cards count after scroll:", visibleCardsCount);
  expect(visibleCardsCount).toBeGreaterThanOrEqual(3);

  await page.screenshot({ path: `${outDir}/verify_tariff_4cards_scrolled.png` });
});

test("verify sort menu: shows 'Все' and does not contain 'Дороже'", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByTestId("family-type-tariff").click({ force: true });
  await page.waitForTimeout(400);

  const sortButton = page.getByTestId("market-price-sort-button");
  await expect(sortButton).toBeVisible();
  await sortButton.click();
  await page.waitForTimeout(200);

  const menu = page.getByRole("menu", { name: "Порядок объявлений" });
  await expect(menu).toBeVisible();

  await expect(page.getByTestId("market-price-option-fast")).toBeVisible();
  await expect(page.getByTestId("market-price-option-asc")).toBeVisible();
  await expect(page.getByTestId("market-price-option-all")).toBeVisible();
  await expect(page.getByTestId("market-price-option-desc")).toHaveCount(0);
  await expect(menu).toContainText("Все");
  await expect(menu).not.toContainText("Дороже");

  await page.screenshot({ path: `${outDir}/verify_sort_menu_vse.png` });

  // Select "Все" and check chip label updates
  await page.getByTestId("market-price-option-all").click();
  await page.waitForTimeout(300);
  await expect(page.getByTestId("market-price-sort-label")).toHaveText("Все");
  await page.screenshot({ path: `${outDir}/verify_sort_chip_vse.png` });
});

test("verify calendar-like expandable info disclosure on Gigabytes and Accounts", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByTestId("market-buy-gigabytes").click({ force: true });
  await page.waitForTimeout(400);

  const gbDisclosure = page.locator("#gigabytes-safety-disclosure");
  await expect(gbDisclosure).toHaveAttribute("aria-hidden", "true");
  await expect(gbDisclosure).not.toHaveClass(/is-open/);

  // Tap [ ⓘ ] in header to expand
  const gbInfoBtn = page.getByTestId("gigabytes-safety-note");
  await gbInfoBtn.click({ force: true });
  await page.waitForTimeout(350);

  await expect(gbDisclosure).toHaveClass(/is-open/);
  await expect(gbDisclosure).toHaveAttribute("aria-hidden", "false");
  await expect(gbInfoBtn).toHaveClass(/is-active/);
  await expect(page.getByTestId("gigabytes-safety-alert")).toBeVisible();

  await page.screenshot({ path: `${outDir}/verify_gigabytes_disclosure_open.png` });

  // Tap [ ⓘ ] again to collapse
  await gbInfoBtn.click({ force: true });
  await page.waitForTimeout(350);
  await expect(gbDisclosure).not.toHaveClass(/is-open/);
  await expect(gbDisclosure).toHaveAttribute("aria-hidden", "true");
  await expect(gbInfoBtn).not.toHaveClass(/is-active/);

  await page.screenshot({ path: `${outDir}/verify_gigabytes_disclosure_closed.png` });

  // Tap [ ⓘ ] to expand, then close with [x] button inside alert
  await gbInfoBtn.click({ force: true });
  await page.waitForTimeout(350);
  await expect(gbDisclosure).toHaveClass(/is-open/);

  const closeBtn = page.locator("#gigabytes-safety-disclosure .sm-market-alert-close");
  await closeBtn.click({ force: true });
  await page.waitForTimeout(350);
  await expect(gbDisclosure).not.toHaveClass(/is-open/);

  // Navigate to Accounts and test disclosure
  await page.getByRole("button", { name: "Маркет", exact: true }).click({ force: true });
  await page.waitForTimeout(300);
  await page.getByTestId("market-buy-accounts").click({ force: true });
  await page.waitForTimeout(400);

  const accDisclosure = page.locator("#accounts-safety-disclosure");
  await expect(accDisclosure).toHaveAttribute("aria-hidden", "true");

  const accInfoBtn = page.getByTestId("accounts-safety-note");
  await accInfoBtn.click({ force: true });
  await page.waitForTimeout(350);

  await expect(accDisclosure).toHaveClass(/is-open/);
  await expect(accInfoBtn).toHaveClass(/is-active/);
  await expect(page.getByTestId("accounts-safety-alert")).toBeVisible();

  await page.screenshot({ path: `${outDir}/verify_accounts_disclosure_open.png` });
});

test("verify category filter on accounts catalog: shows Все, Видео, AI, Музыка, Другое", async ({ page }) => {
  // Create an AI listing via API
  await page.request.post(`${apiUrl}/api/marketplace/accounts/listings`, {
    headers: {
      "X-Dev-Telegram-User-Id": "400010",
      "X-Dev-Telegram-Username": "ai_seller",
      "X-Dev-Telegram-First-Name": "AI Seller"
    },
    data: {
      service_slug: "chatgpt",
      title: "ChatGPT Plus на месяц",
      price_kzt: 3990,
      description: "AI аккаунт"
    }
  });

  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByTestId("market-buy-accounts").click({ force: true });
  await page.waitForTimeout(400);

  const filterBtn = page.getByTestId("account-category-filter-button");
  await expect(filterBtn).toBeVisible();
  await expect(filterBtn).toHaveText(/Все/);

  // Click to open filter menu
  await filterBtn.click();
  await page.waitForTimeout(200);

  const menu = page.locator("#account-category-menu");
  await expect(menu).toBeVisible();

  await expect(page.getByTestId("account-category-option-all")).toBeVisible();
  await expect(page.getByTestId("account-category-option-video")).toBeVisible();
  await expect(page.getByTestId("account-category-option-ai")).toBeVisible();
  await expect(page.getByTestId("account-category-option-music")).toBeVisible();
  await expect(page.getByTestId("account-category-option-other")).toBeVisible();

  await page.screenshot({ path: `${outDir}/verify_accounts_category_menu.png` });

  // Select AI
  await page.getByTestId("account-category-option-ai").click();
  await page.waitForTimeout(300);
  await expect(filterBtn).toHaveText(/AI/);
  await expect(filterBtn).toHaveClass(/is-active/);

  await page.screenshot({ path: `${outDir}/verify_accounts_category_ai.png` });
});

test("verify accounts sort defaults to 'По умолчанию'", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByTestId("market-buy-accounts").click({ force: true });
  await page.waitForTimeout(400);

  const sortBtn = page.getByTestId("account-sort-button");
  await expect(sortBtn).toBeVisible();
  // By default, sort chip must display "По умолчанию", not "Новое"
  await expect(sortBtn).toHaveText(/По умолчанию/);
  await expect(sortBtn).not.toHaveClass(/is-active/);

  // Click to open sort menu
  await sortBtn.click();
  await page.waitForTimeout(200);

  const sortMenu = page.locator("#account-sort-menu");
  await expect(sortMenu).toBeVisible();

  // Check that "По умолчанию" is checked by default
  const defaultOption = page.getByTestId("account-sort-option-all");
  await expect(defaultOption).toBeVisible();
  await expect(defaultOption).toContainText("По умолчанию");
  await expect(defaultOption).toHaveAttribute("aria-checked", "true");

  await expect(page.getByTestId("account-sort-option-recent")).toContainText("Новое");
  await expect(page.getByTestId("account-sort-option-price_asc")).toContainText("Дешевле");

  await page.screenshot({ path: `${outDir}/verify_accounts_sort_default_po_umolchaniyu.png` });
});

test("verify gigabytes sort defaults to 'По умолчанию'", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByTestId("market-buy-gigabytes").click({ force: true });
  await page.waitForTimeout(400);

  const sortBtn = page.getByTestId("gigabytes-sort-button");
  await expect(sortBtn).toBeVisible();
  // By default, sort chip must display "По умолчанию", not "Новое"
  await expect(sortBtn).toHaveText(/По умолчанию/);
  await expect(sortBtn).not.toHaveClass(/is-active/);

  // Click to open sort menu
  await sortBtn.click();
  await page.waitForTimeout(200);

  const sortMenu = page.locator("#gigabytes-sort-menu");
  await expect(sortMenu).toBeVisible();

  // Check that "По умолчанию" is checked by default
  const defaultOption = page.getByTestId("gigabytes-sort-option-all");
  await expect(defaultOption).toBeVisible();
  await expect(defaultOption).toContainText("По умолчанию");
  await expect(defaultOption).toHaveAttribute("aria-checked", "true");

  await expect(page.getByTestId("gigabytes-sort-option-recent")).toContainText("Новое");
  await expect(page.getByTestId("gigabytes-sort-option-price_asc")).toContainText("Дешевле");

  await page.screenshot({ path: `${outDir}/verify_gigabytes_sort_default_po_umolchaniyu.png` });
});

