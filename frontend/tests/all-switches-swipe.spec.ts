import { expect, test } from "@playwright/test";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";

test.use({
  deviceScaleFactor: 2,
  isMobile: true,
  viewport: { width: 390, height: 844 }
});

test("swiping works on all switches across the application", async ({ page }) => {
  await page.goto(`${appUrl}?platform=ios`, { waitUntil: "domcontentloaded" });
  const nav = page.getByRole("navigation", { name: "Главная навигация" });
  await expect(nav).toBeVisible();

  // --- 1. My Families screen: ProductScopeSwitch ([ Подписки | Аккаунты | ГБ ]) ---
  await nav.getByRole("button", { name: "Мои", exact: true }).click({ force: true });
  await expect(page.getByTestId("my-screen")).toBeVisible();

  const mySwitch = page.locator(".my-screen .product-scope-switch");
  await expect(mySwitch).toBeVisible();
  const myFamiliesBtn = mySwitch.getByTestId("product-scope-families");
  const myAccountsBtn = mySwitch.getByTestId("product-scope-accounts");
  const myGbBtn = mySwitch.getByTestId("product-scope-gigabytes");

  await expect(myFamiliesBtn).toHaveAttribute("aria-pressed", "true");

  const myBox = await mySwitch.boundingBox();
  expect(myBox).not.toBeNull();
  if (myBox) {
    const y = myBox.y + myBox.height / 2;
    // Swipe from families (16%) towards accounts (50%)
    await page.mouse.move(myBox.x + myBox.width * 0.16, y);
    await page.mouse.down();
    await page.mouse.move(myBox.x + myBox.width * 0.5, y, { steps: 8 });
    await page.mouse.up();

    await expect(myAccountsBtn).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(350);

    await page.screenshot({
      path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_my_switch_swiped_to_accounts.png"
    });

    // Swipe from accounts (50%) towards gigabytes (83%)
    await page.mouse.move(myBox.x + myBox.width * 0.5, y);
    await page.mouse.down();
    await page.mouse.move(myBox.x + myBox.width * 0.83, y, { steps: 8 });
    await page.mouse.up();

    await expect(myGbBtn).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(350);

    await page.screenshot({
      path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_my_switch_swiped_to_gb.png"
    });
  }

  // --- 2. Market Catalog: sm-market-family-type-switch ([ Подписки | Тарифы ]) ---
  await nav.getByRole("button", { name: "Маркет", exact: true }).click({ force: true });
  await expect(page.getByTestId("market-screen")).toBeVisible();

  // Open family catalog from market home (e.g. click "Подписки" tile or button)
  const subsTile = page.locator(".sm-market-service-tile").first();
  if (await subsTile.isVisible()) {
    await subsTile.click({ force: true });
  } else {
    const allSubsBtn = page.getByRole("button", { name: /Все подписки|Каталог|Подписки/ }).first();
    if (await allSubsBtn.isVisible()) {
      await allSubsBtn.click({ force: true });
    }
  }

  const catalogSwitch = page.locator(".sm-market-family-type-switch");
  if (await catalogSwitch.isVisible()) {
    const subBtn = catalogSwitch.getByTestId("family-type-subscription");
    const tariffBtn = catalogSwitch.getByTestId("family-type-tariff");
    await expect(subBtn).toHaveAttribute("aria-pressed", "true");

    const catBox = await catalogSwitch.boundingBox();
    if (catBox) {
      const cy = catBox.y + catBox.height / 2;
      // Swipe from left to right on the switch: from subscription to tariff
      await page.mouse.move(catBox.x + catBox.width * 0.25, cy);
      await page.mouse.down();
      await page.mouse.move(catBox.x + catBox.width * 0.75, cy, { steps: 8 });
      await page.mouse.up();

      await expect(tariffBtn).toHaveAttribute("aria-pressed", "true");

      await page.screenshot({
        path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_market_switch_swiped_to_tariff.png"
      });
    }
  }

  // --- 3. Actions Screen: product-scope-switch ([ Входящие | Исходящие ]) ---
  await nav.getByRole("button", { name: "Заявки", exact: true }).click({ force: true });
  await expect(page.getByTestId("actions-screen")).toBeVisible();

  const actionsSwitch = page.locator(".actions-screen .product-scope-switch");
  const inboxBtn = actionsSwitch.getByTestId("actions-tab-inbox");
  const outboxBtn = actionsSwitch.getByTestId("actions-tab-outbox");

  await expect(inboxBtn).toHaveAttribute("aria-pressed", "true");
  const actBox = await actionsSwitch.boundingBox();
  if (actBox) {
    const ay = actBox.y + actBox.height / 2;
    await page.mouse.move(actBox.x + actBox.width * 0.25, ay);
    await page.mouse.down();
    await page.mouse.move(actBox.x + actBox.width * 0.75, ay, { steps: 8 });
    await page.mouse.up();

    await expect(outboxBtn).toHaveAttribute("aria-pressed", "true");

    await page.screenshot({
      path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_actions_swiped_to_outbox_all.png"
    });
  }

  // --- 4. Create Family Screen: FamilyTypeSwitch ([ Подписки | Тарифы ]) ---
  await page.locator(".subs-dock-create").getByRole("button", { name: "Создать", exact: true }).click({ force: true });
  const createFamilySwitch = page.locator(".family-type-switch");
  await expect(createFamilySwitch).toBeVisible();

  const createSubBtn = createFamilySwitch.getByTestId("family-type-subscription");
  const createTariffBtn = createFamilySwitch.getByTestId("family-type-tariff");
  // Since market catalog was swiped to "tariff", CreateFamily inherits familyType="tariff"
  await expect(createTariffBtn).toHaveAttribute("aria-pressed", "true");

  const createBox = await createFamilySwitch.boundingBox();
  if (createBox) {
    const cry = createBox.y + createBox.height / 2;
    // Swipe from tariff (75% width) back to subscription (25% width)
    await page.mouse.move(createBox.x + createBox.width * 0.75, cry);
    await page.mouse.down();
    await page.mouse.move(createBox.x + createBox.width * 0.25, cry, { steps: 8 });
    await page.mouse.up();

    await expect(createSubBtn).toHaveAttribute("aria-pressed", "true");

    await page.screenshot({
      path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_create_family_switch_swiped_to_sub.png"
    });
  }
});
