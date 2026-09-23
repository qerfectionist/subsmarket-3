import { expect, test, type Locator, type Page } from "@playwright/test";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";

test.use({
  deviceScaleFactor: 1,
  isMobile: true,
  viewport: { width: 390, height: 844 }
});

type SegmentPositionVariable = "--scope-position" | "--catalog-type-position" | "--family-type-position";

async function readSegmentIndicatorGeometry(
  scopeSwitch: Locator,
  segmentIndex: number,
  positionVariable: SegmentPositionVariable
) {
  return scopeSwitch.evaluate(
    (element, { index, variable }) => {
      const segments = Array.from(element.querySelectorAll("button"));
      const target = segments[index];
      if (!target) throw new Error("Scope segment is missing");

      const switchBox = element.getBoundingClientRect();
      const segmentBox = target.getBoundingClientRect();
      const switchStyle = getComputedStyle(element);
      const indicatorStyle = getComputedStyle(element, "::before");
      const indicatorWidth = Number.parseFloat(indicatorStyle.width);
      const indicatorGap = Number.parseFloat(switchStyle.gap);
      const position = Number(element.style.getPropertyValue(variable));

      return {
        position,
        indicatorWidth,
        indicatorLeft:
          switchBox.left +
          Number.parseFloat(switchStyle.borderLeftWidth) +
          Number.parseFloat(switchStyle.paddingLeft) +
          position * (indicatorWidth + indicatorGap),
        segmentWidth: segmentBox.width,
        segmentLeft: segmentBox.left
      };
    },
    { index: segmentIndex, variable: positionVariable }
  );
}

async function readScopeMotion(scopeSwitch: Locator) {
  return scopeSwitch.evaluate((element) => {
    const track = document.querySelector<HTMLElement>(".my-product-scope-swipe-track");
    const pager = document.querySelector<HTMLElement>(".my-product-scope-swipe-viewport");
    if (!track || !pager) throw new Error("My product scope motion elements are missing");

    const readTranslateX = (transform: string) =>
      transform === "none" ? 0 : new DOMMatrix(transform).m41;
    // Шаг берём из реальной раскладки сегментов, а не из магической константы:
    // иначе допуск теста съедает расхождение самой формулы.
    const segments = Array.from(element.querySelectorAll("button")).map((button) =>
      button.getBoundingClientRect()
    );
    const segmentStep =
      segments.length > 1
        ? segments[1].left - segments[0].left
        : element.getBoundingClientRect().width;
    const panes = Array.from(track.querySelectorAll<HTMLElement>(".my-product-scope-swipe-pane"));
    const contentStep =
      panes.length > 1
        ? panes[1].getBoundingClientRect().left - panes[0].getBoundingClientRect().left
        : pager.getBoundingClientRect().width;
    const indicatorX = readTranslateX(getComputedStyle(element, "::before").transform);
    const trackX = readTranslateX(getComputedStyle(track).transform);

    return {
      isMoving: element.dataset.scopeDragging === "true",
      position: Number(element.style.getPropertyValue("--scope-position")),
      indicatorPosition: indicatorX / segmentStep,
      contentPosition: -trackX / contentStep,
      transitionDuration: getComputedStyle(element, "::before").transitionDuration
    };
  });
}

async function waitForScopeSettled(scopeSwitch: Locator, targetIndex: number) {
  await expect
    .poll(async () =>
      scopeSwitch.evaluate(
        (element, index) => {
          const position = Number(element.style.getPropertyValue("--scope-position"));
          return (
            element.dataset.scopeDragging === undefined && Math.abs(position - index) < 0.001
          );
        },
        targetIndex
      )
    )
    .toBe(true);
}

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
  await expect(bottomNav).toContainText("Заявки");
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
  await expect(page.getByRole("heading", { name: "Гигабайты", level: 1 })).toBeVisible();
  await expect(bottomNav.getByRole("button", { name: "Маркет", exact: true })).toHaveAttribute("aria-current", "page");
  await bottomNav.getByRole("button", { name: "Маркет", exact: true }).click({ force: true });
  await expect(page.getByTestId("market-screen")).toBeVisible();

  await page.getByTestId("market-buy-accounts").click({ force: true });
  await expect(page.getByTestId("accounts-screen")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Аккаунты", level: 1 })).toBeVisible();
  await expect(bottomNav.getByRole("button", { name: "Маркет", exact: true })).toHaveAttribute("aria-current", "page");
  await bottomNav.getByRole("button", { name: "Маркет", exact: true }).click({ force: true });
  await expect(page.getByTestId("market-screen")).toBeVisible();

  await bottomNav.getByRole("button", { name: "Маркет", exact: true }).click({ force: true });
  await expect(page.getByTestId("market-search-input")).toBeVisible();

  await page.locator(".subs-dock-create").getByRole("button", { name: "Создать", exact: true }).click({ force: true });
  await expect(page.getByTestId("create-family-form")).toBeVisible();
  await expect(page.getByTestId("create-share-preview")).toBeVisible();
  await page.locator(".product-scope-switch").getByRole("button", { name: "Аккаунты" }).click({ force: true });
  await page.getByTestId("accounts-screen").getByRole("button", { name: "Назад" }).click();
  await expect(page.getByTestId("create-family-form")).toBeVisible();

  await bottomNav.getByRole("button", { name: "Мои", exact: true }).click({ force: true });
  await expect(
    page.locator(".family-workspace, .empty-state, [data-testid='family-list-skeleton']").first()
  ).toBeVisible();
  await expect(page.getByTestId("my-screen")).toBeVisible();
  await expect(page.getByTestId("my-screen").locator(".my-requests-section")).toHaveCount(0);

  await bottomNav.getByRole("button", { name: "Заявки", exact: true }).click({ force: true });
  await expect(page.getByTestId("actions-screen")).toBeVisible();
  await expect(page.getByTestId("actions-summary")).toHaveCount(0);

  const relevantMessages = messages.filter(
    (message) =>
      !message.includes("telegram.org/js/telegram-web-app.js") &&
      !message.includes("not supported in version 6.0") &&
      !message.includes("net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin") &&
      !message.includes("React DevTools") &&
      !message.includes("WebSocket") &&
      !message.includes("[vite]")
  );
  expect(relevantMessages).toEqual([]);
});

test("Catalog section count matches the listed offers", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.getByTestId("family-type-tariff").click({ force: true });
  await expect(page.getByTestId("family-catalog-screen")).toBeVisible();
  await expect(page.getByTestId("family-type-tariff")).toHaveAttribute("aria-pressed", "true");

  const pane = page.locator(".sm-market-catalog-swipe-pane[data-catalog-type='tariff']");
  const cards = pane.locator(".sm-listing");
  const emptyState = pane.locator(".sm-market-empty");
  await expect(cards.or(emptyState).first()).toBeVisible();

  const count = page.locator(".sm-market-section-heading-copy .sm-market-section-count");
  const cardCount = await cards.count();
  if (cardCount === 0) {
    // Пустой каталог: рядом с заголовком цифры нет.
    await expect(count).toHaveCount(0);
    return;
  }
  await expect(count).toBeVisible();
  const countValue = Number.parseInt((await count.textContent()) ?? "", 10);
  expect(countValue).toBe(cardCount);
});

test("Family catalog switches with a horizontal swipe", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.getByTestId("family-type-subscription").click({ force: true });
  await expect(page.getByTestId("family-catalog-screen")).toBeVisible();
  // Заголовок раздела меняется по продуктовым решениям, поэтому проверяем саму
  // секцию каталога, а не её формулировку.
  await expect(page.locator(".sm-market-family-section")).toBeVisible();

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
  await expect(tariffPane.getByRole("heading", { name: /Доступные|Доступных тарифов пока нет/ })).toBeVisible();

  // Swipe back: tariff -> subscription
  await page.mouse.move(box.x + box.width * 0.2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, y, { steps: 10 });
  await page.mouse.up();

  await expect(page.getByTestId("family-type-subscription")).toHaveAttribute("aria-pressed", "true");
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

test("Actions switch between incoming and outgoing requests", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Заявки", exact: true })
    .click({ force: true });
  await expect(page.getByTestId("actions-screen")).toBeVisible();

  const scopeSwitch = page.locator(".actions-screen .product-scope-switch");
  const inbox = scopeSwitch.getByTestId("actions-tab-inbox");
  const outbox = scopeSwitch.getByTestId("actions-tab-outbox");
  await expect(inbox).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("actions-inbox-pane")).toBeVisible();

  // Направление переключается тапом или горизонтальным свайпом.
  await outbox.click();
  await expect(outbox).toHaveAttribute("aria-pressed", "true");
  await expect(inbox).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("actions-outbox-pane")).toBeVisible();

  await inbox.click();
  await expect(inbox).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("actions-inbox-pane")).toBeVisible();
});

test("Actions scope indicator and pane follow swipe gesture", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Заявки", exact: true })
    .click({ force: true });
  await expect(page.getByTestId("actions-screen")).toBeVisible();

  const pager = page.getByTestId("actions-scope-swipe-viewport");
  const scopeSwitch = page.locator(".actions-screen .product-scope-switch");
  const box = await pager.boundingBox();
  if (!box) throw new Error("Actions scope pager is not measurable");

  const y = box.y + Math.min(box.height / 2, 180);
  // Swipe left: from 80% to 20% width
  await page.mouse.move(box.x + box.width * 0.8, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, y, { steps: 5 });
  await page.mouse.up();

  // Swiped to outbox
  const outbox = scopeSwitch.getByTestId("actions-tab-outbox");
  await expect(outbox).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("actions-outbox-pane")).toBeVisible();

  // Swipe right: from 20% to 80% width
  await page.mouse.move(box.x + box.width * 0.2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, y, { steps: 5 });
  await page.mouse.up();

  // Swiped back to inbox
  const inbox = scopeSwitch.getByTestId("actions-tab-inbox");
  await expect(inbox).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("actions-inbox-pane")).toBeVisible();
});

test("Actions switch resets filters when direction changes", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Заявки", exact: true })
    .click({ force: true });
  await expect(page.getByTestId("actions-screen")).toBeVisible();

  // Чипы циклятся по тапу: сдвигаем оба, потом меняем направление.
  const categoryLabel = page.getByTestId("actions-category-filter-label");
  const statusLabel = page.getByTestId("actions-status-filter-label");
  await page.getByTestId("actions-category-filter-chip").click();
  await page.getByTestId("actions-status-filter-chip").click();
  await expect(categoryLabel).not.toHaveText("Все");
  await expect(statusLabel).not.toHaveText("Все");

  const scopeSwitch = page.locator(".actions-screen .product-scope-switch");
  await scopeSwitch.getByTestId("actions-tab-outbox").click();
  await expect(categoryLabel).toHaveText("Все");
  await expect(statusLabel).toHaveText("Все");
});

test("Actions scope indicator matches its segment geometry", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Заявки", exact: true })
    .click({ force: true });
  await expect(page.getByTestId("actions-screen")).toBeVisible();

  const scopeSwitch = page.locator(".actions-screen .product-scope-switch");
  const outbox = scopeSwitch.getByTestId("actions-tab-outbox");
  await outbox.click();
  await expect(outbox).toHaveAttribute("aria-pressed", "true");

  // Капсула обязана совпадать со своим сегментом: та же формула, что и в Маркете.
  const geometry = await readSegmentIndicatorGeometry(scopeSwitch, 1, "--scope-position");
  expect(geometry.position).toBe(1);
  expect(Math.abs(geometry.indicatorWidth - geometry.segmentWidth)).toBeLessThan(1);
  expect(Math.abs(geometry.indicatorLeft - geometry.segmentLeft)).toBeLessThan(1);
});

test("Actions archive disclosure opens and closes via top-right header action", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Заявки", exact: true })
    .click({ force: true });
  await expect(page.getByTestId("actions-screen")).toBeVisible();

  const archiveTrigger = page.getByTestId("actions-archive-trigger");
  await expect(archiveTrigger).toBeVisible();
  await expect(archiveTrigger).toHaveAttribute("aria-expanded", "false");

  const disclosure = page.locator("#actions-archive-disclosure");
  await expect(disclosure).not.toHaveClass(/is-open/);

  // Click to open archive
  await archiveTrigger.click();
  await expect(archiveTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(disclosure).toHaveClass(/is-open/);
  await expect(disclosure.getByRole("heading", { name: "Архив заявок" })).toBeVisible();

  // Click to close archive
  await archiveTrigger.click();
  await expect(archiveTrigger).toHaveAttribute("aria-expanded", "false");
  await expect(disclosure).not.toHaveClass(/is-open/);
});

test("My scope indicator starts with content on click", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await expect(page.getByTestId("my-screen")).toBeVisible();

  const scopeSwitch = page.getByRole("group", { name: "Разделы", exact: true });
  const accountsButton = scopeSwitch.getByRole("button", { name: "Аккаунты", exact: true });
  await accountsButton.dispatchEvent("click");

  const motion = await readScopeMotion(scopeSwitch);

  expect(motion.isMoving).toBe(true);
  expect(Math.abs(motion.indicatorPosition - motion.contentPosition)).toBeLessThan(0.02);
  expect(motion.transitionDuration).toBe("0s");
  await expect(accountsButton).toHaveAttribute("aria-pressed", "true");

  await waitForScopeSettled(scopeSwitch, 1);
  const settledMotion = await readScopeMotion(scopeSwitch);
  expect(Math.abs(settledMotion.indicatorPosition - settledMotion.contentPosition)).toBeLessThan(0.01);
  expect(settledMotion.transitionDuration).toBe("0s");
});

test("My scope indicator responds on pointer down", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await expect(page.getByTestId("my-screen")).toBeVisible();

  const scopeSwitch = page.getByRole("group", { name: "Разделы", exact: true });
  const accountsButton = scopeSwitch.getByRole("button", { name: "Аккаунты", exact: true });
  const box = await accountsButton.boundingBox();
  if (!box) throw new Error("Accounts scope button is not measurable");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();

  const motion = await readScopeMotion(scopeSwitch);
  const appearance = await scopeSwitch.evaluate((element) => ({
    transitionDuration: getComputedStyle(element, "::before").transitionDuration,
    indicatorShadow: getComputedStyle(element, "::before").boxShadow,
    tokenIndicatorShadow: (() => {
      const probe = document.createElement("span");
      probe.style.boxShadow = getComputedStyle(document.documentElement)
        .getPropertyValue("--app-nav-active-shadow")
        .trim();
      document.body.appendChild(probe);
      const resolved = getComputedStyle(probe).boxShadow;
      probe.remove();
      return resolved;
    })(),
    activeButton: element.querySelector("button.ui-button-primary")
      ? (() => {
          const button = element.querySelector("button.ui-button-primary");
          if (!button) return null;
          const styles = getComputedStyle(button);
          return {
            backgroundColor: styles.backgroundColor,
            boxShadow: styles.boxShadow,
            transform: styles.transform
          };
        })()
      : null
  }));
  await page.mouse.up();
  expect(motion.isMoving).toBe(true);
  // Абсолютная позиция зависит от задержки протокола: пружина успевает доехать
  // до 0.7 за время round-trip, поэтому проверяем инвариант, не зависящий от
  // фазы анимации, — капсула и контент едут синхронно.
  expect(Math.abs(motion.indicatorPosition - motion.contentPosition)).toBeLessThan(0.02);
  expect(appearance.transitionDuration).toBe("0s");
  // Индикатор «Моих» выровнен с Маркетом и использует токен подсветки навигации.
  expect(appearance.indicatorShadow).toBe(appearance.tokenIndicatorShadow);
  expect(appearance.activeButton).toEqual({
    backgroundColor: "rgba(0, 0, 0, 0)",
    boxShadow: "none",
    transform: "none"
  });
  await expect(accountsButton).toHaveAttribute("aria-pressed", "true");
});

test("My scope indicator matches its segment geometry", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await expect(page.getByTestId("my-screen")).toBeVisible();

  const scopeSwitch = page.getByRole("group", { name: "Разделы", exact: true });
  const gigabytesButton = scopeSwitch.getByRole("button", { name: "ГБ", exact: true });
  await gigabytesButton.click();
  await expect(gigabytesButton).toHaveAttribute("aria-pressed", "true");
  // Индикатор доезжает анимацией, поэтому сначала ждём остановки.
  await expect
    .poll(async () =>
      scopeSwitch.evaluate((element) => Number(element.style.getPropertyValue("--scope-position")))
    )
    .toBeGreaterThan(1.99);

  const geometry = await readSegmentIndicatorGeometry(scopeSwitch, 2, "--scope-position");

  expect(geometry.position).toBeGreaterThan(1.99);
  expect(Math.abs(geometry.indicatorWidth - geometry.segmentWidth)).toBeLessThan(1);
  expect(Math.abs(geometry.indicatorLeft - geometry.segmentLeft)).toBeLessThan(1);
});

test("Market catalog indicator matches its segment geometry", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  const tariffButton = page.getByTestId("family-type-tariff");
  await tariffButton.click({ force: true });
  await expect(page.getByTestId("family-catalog-screen")).toBeVisible();
  await expect(tariffButton).toHaveAttribute("aria-pressed", "true");

  const scopeSwitch = page.locator(".sm-market-family-type-switch");
  // Капсула доезжает анимацией, поэтому сначала ждём остановки.
  await expect
    .poll(async () =>
      scopeSwitch.evaluate((element) =>
        Number(element.style.getPropertyValue("--catalog-type-position"))
      )
    )
    .toBeGreaterThan(0.99);

  const geometry = await readSegmentIndicatorGeometry(scopeSwitch, 1, "--catalog-type-position");

  expect(geometry.position).toBeGreaterThan(0.99);
  expect(Math.abs(geometry.indicatorWidth - geometry.segmentWidth)).toBeLessThan(1);
  expect(Math.abs(geometry.indicatorLeft - geometry.segmentLeft)).toBeLessThan(1);
});

test("Create family type indicator matches its segment geometry", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.locator(".subs-dock-create").getByRole("button", { name: "Создать", exact: true }).click({ force: true });
  await expect(page.getByTestId("create-family-form")).toBeVisible();

  const typeSwitch = page.locator(".family-type-switch");
  const tariffButton = typeSwitch.getByTestId("family-type-tariff");
  await tariffButton.click({ force: true });
  await expect(tariffButton).toHaveAttribute("aria-pressed", "true");

  const geometry = await readSegmentIndicatorGeometry(typeSwitch, 1, "--family-type-position");

  expect(geometry.position).toBe(1);
  expect(Math.abs(geometry.indicatorWidth - geometry.segmentWidth)).toBeLessThan(1);
  expect(Math.abs(geometry.indicatorLeft - geometry.segmentLeft)).toBeLessThan(1);
});

test("My scope indicator follows the pointer during a swipe", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await expect(page.getByTestId("my-screen")).toBeVisible();

  const pager = page.locator(".my-product-scope-swipe-viewport");
  const scopeSwitch = page.locator(".product-scope-switch");
  const box = await pager.boundingBox();
  if (!box) throw new Error("My product scope pager is not measurable");

  const y = box.y + Math.min(box.height / 2, 180);
  await page.mouse.move(box.x + box.width * 0.8, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, y, { steps: 1 });

  await expect(scopeSwitch).toHaveAttribute("data-scope-dragging", "true");
  const indicator = await scopeSwitch.evaluate((element) => ({
    position: Number(element.style.getPropertyValue("--scope-position")),
    transitionDuration: getComputedStyle(element, "::before").transitionDuration
  }));
  expect(indicator.position).toBeGreaterThan(0.1);
  expect(indicator.position).toBeLessThan(0.6);
  expect(indicator.transitionDuration).toBe("0s");

  await page.mouse.up();
  await page.waitForTimeout(40);
  const settlingMotion = await readScopeMotion(scopeSwitch);
  expect(Math.abs(settlingMotion.indicatorPosition - settlingMotion.contentPosition)).toBeLessThan(0.06);
  expect(settlingMotion.transitionDuration).toBe("0s");
  await expect(scopeSwitch).not.toHaveAttribute("data-scope-dragging", "true");

  const settledMotion = await readScopeMotion(scopeSwitch);
  expect(Math.abs(settledMotion.indicatorPosition - settledMotion.contentPosition)).toBeLessThan(0.01);
});

test("My families filter chips work in the families scope", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await expect(page.getByTestId("my-screen")).toBeVisible();

  const scopeSwitch = page.getByRole("group", { name: "Разделы", exact: true });
  const familiesButton = scopeSwitch.getByRole("button", { name: "Подписки", exact: true });
  await expect(familiesButton).toHaveAttribute("aria-pressed", "true");

  // Role chip cycles through: Участвую -> Организую -> Все роли
  const roleChip = page.getByTestId("my-family-role-chip");
  await expect(roleChip).toBeVisible();
  await expect(page.getByTestId("my-family-role-label")).toHaveText("Все роли");

  await roleChip.click({ force: true });
  await expect(page.getByTestId("my-family-role-label")).toHaveText("Участвую");

  await roleChip.click({ force: true });
  await expect(page.getByTestId("my-family-role-label")).toHaveText("Организую");

  await roleChip.click({ force: true });
  await expect(page.getByTestId("my-family-role-label")).toHaveText("Все роли");

  // Category filter cycles through: Тарифы -> Сервисы -> Все
  const familyTypeFilter = page.getByTestId("my-family-filter-button");
  await expect(familyTypeFilter).toBeVisible();
  await familyTypeFilter.click();
  await expect(page.getByTestId("my-family-filter-label")).toHaveText("Тарифы");
  await familyTypeFilter.click();
  await expect(page.getByTestId("my-family-filter-label")).toHaveText("Сервисы");
  await familyTypeFilter.click();
  await expect(page.getByTestId("my-family-filter-label")).toHaveText("Все");

  // Filter row must not overflow horizontally
  const filterRowMetrics = await page.locator(".my-product-scope-swipe-pane[data-product-scope=\"families\"][aria-hidden=\"false\"] .my-family-filter-row").evaluate((element) => ({
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

test("My accounts opens purchase orders from the header", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await expect(page.getByTestId("my-screen")).toBeVisible();

  const scopeSwitch = page.getByRole("group", { name: "Разделы", exact: true });
  const subscriptionsPagerGap = await page.evaluate(() => {
    const filters = document.querySelector<HTMLElement>(".my-screen-filters");
    const pager = document.querySelector<HTMLElement>(".my-product-scope-swipe-viewport");
    if (!filters || !pager) throw new Error("Subscriptions layout elements were not found");
    const filtersBox = filters.getBoundingClientRect();
    const pagerBox = pager.getBoundingClientRect();
    return pagerBox.top - filtersBox.bottom;
  });
  await scopeSwitch.getByRole("button", { name: "Аккаунты", exact: true }).click();
  const accountsPagerGap = await page.evaluate(() => {
    const filters = document.querySelector<HTMLElement>(".my-screen-filters");
    const pager = document.querySelector<HTMLElement>(".my-product-scope-swipe-viewport");
    if (!filters || !pager) throw new Error("Accounts layout elements were not found");
    const filtersBox = filters.getBoundingClientRect();
    const pagerBox = pager.getBoundingClientRect();
    return pagerBox.top - filtersBox.bottom;
  });
  expect(Math.abs(accountsPagerGap - subscriptionsPagerGap)).toBeLessThanOrEqual(1);
  const accountFilterChips = page.locator("[data-testid=\"my-accounts-screen\"] .sm-market-filter-chip");
  await expect(accountFilterChips).toHaveCount(1);
  await expect(accountFilterChips).toHaveText("Все");
  await expect(accountFilterChips).toHaveAttribute("aria-pressed", "false");
  const accountFilterRowMetrics = await page.locator("[data-testid=\"my-accounts-screen\"] .my-family-filter-row").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  }));
  expect(accountFilterRowMetrics.scrollWidth).toBeLessThanOrEqual(accountFilterRowMetrics.clientWidth + 1);
  await accountFilterChips.click();
  await expect(accountFilterChips).toHaveText("Опубликовано");
  await expect(accountFilterChips).toHaveAttribute("aria-pressed", "true");
  await accountFilterChips.click();
  await expect(accountFilterChips).toHaveText("Приостановлено");
  await expect(accountFilterChips).toHaveAttribute("aria-pressed", "true");
  await accountFilterChips.click();
  await expect(accountFilterChips).toHaveText("Все");
  await expect(accountFilterChips).toHaveAttribute("aria-pressed", "false");

  const ordersTrigger = page.getByTestId("my-accounts-orders-trigger");
  await expect(ordersTrigger).toHaveAccessibleName("История");
  await expect(ordersTrigger.locator(".sm-system-symbol")).toHaveCount(1);
  await expect(ordersTrigger).not.toContainText("История");
  await page.screenshot({ path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/history_before_open.png" });
  await ordersTrigger.click();
  await expect(page.getByTestId("my-screen")).toBeVisible();
  await expect(page.getByTestId("accounts-screen")).toHaveCount(0);
  await expect(ordersTrigger).toHaveAttribute("aria-expanded", "true");
  const accountOrdersDisclosure = page.locator("#my-account-orders");
  await expect(accountOrdersDisclosure).toHaveAttribute("aria-hidden", "false");
  await expect(accountOrdersDisclosure.getByRole("heading", { name: "История", exact: true })).toBeVisible();
  const historyChip = accountOrdersDisclosure.getByTestId("my-history-filter-chip");
  await expect(historyChip).toBeVisible();
  await expect(historyChip).toHaveText("Покупки");
  const chipHeight = await historyChip.evaluate((el) => parseFloat(window.getComputedStyle(el).minHeight || window.getComputedStyle(el).height));
  expect(chipHeight).toBeGreaterThanOrEqual(28);

  await expect(accountOrdersDisclosure.getByText("Покупок пока нет", { exact: true })).toBeVisible();
  await expect(accountOrdersDisclosure.locator(".my-account-orders-empty-state")).toHaveCSS("border-style", "none");
  await page.waitForTimeout(400);
  await page.screenshot({ path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/history_purchases.png" });

  await historyChip.click();
  await expect(historyChip).toHaveText("Продажи");
  await expect(accountOrdersDisclosure.getByText("Продаж пока нет", { exact: true })).toBeVisible();
  await page.waitForTimeout(200);
  await page.screenshot({ path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/history_sales.png" });

  await ordersTrigger.click();
  await expect(ordersTrigger).toHaveAttribute("aria-expanded", "false");
  await expect(accountOrdersDisclosure).toHaveAttribute("aria-hidden", "true");

  await scopeSwitch.getByRole("button", { name: "ГБ", exact: true }).click();

  const gbOrdersTrigger = page.getByTestId("my-gigabytes-orders-trigger");
  await expect(gbOrdersTrigger).toHaveAccessibleName("История");
  await gbOrdersTrigger.click();
  await expect(gbOrdersTrigger).toHaveAttribute("aria-expanded", "true");
  const gbOrdersDisclosure = page.locator("#my-gigabytes-orders");
  await expect(gbOrdersDisclosure).toHaveAttribute("aria-hidden", "false");
  await expect(gbOrdersDisclosure.getByText("Покупок пока нет", { exact: true })).toBeVisible();
  await gbOrdersTrigger.click();
  await expect(gbOrdersTrigger).toHaveAttribute("aria-expanded", "false");
  await expect(gbOrdersDisclosure).toHaveAttribute("aria-hidden", "true");

  const statusChip = page.getByTestId("my-gigabytes-status-chip");
  await expect(statusChip).toHaveText("Все");
  await statusChip.click();
  await expect(statusChip).toHaveText("Опубликовано");
});

test("My accounts history renders orders list without horizontal overflow", async ({ page }) => {
  await page.route("**/api/marketplace/accounts/requests/me?role=buyer*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "req-1",
            listing_id: "list-1",
            title: "Canva Pro годовая подписка",
            service_slug: "canva",
            service_name: "Canva",
            price_kzt: 2490,
            status: "pending",
            buyer_user_id: 1,
            seller_user_id: 2,
            counterparty_username: null,
            can_remind: false,
            created_at: "2026-09-18T22:32:00Z",
            updated_at: "2026-09-18T22:32:00Z"
          },
          {
            id: "req-2",
            listing_id: "list-2",
            title: "Gemini Advanced на 1 месяц",
            service_slug: "gemini",
            service_name: "Gemini",
            price_kzt: 1890,
            status: "accepted",
            buyer_user_id: 1,
            seller_user_id: 2,
            counterparty_username: "demo_owner",
            telegram_url: "https://t.me/demo_owner",
            created_at: "2026-09-18T20:17:00Z",
            updated_at: "2026-09-18T20:17:00Z"
          },
          {
            id: "req-3",
            listing_id: "list-3",
            title: "ChatGPT Plus",
            service_slug: "chatgpt",
            service_name: "ChatGPT",
            price_kzt: 990,
            status: "closed",
            buyer_user_id: 1,
            seller_user_id: 2,
            counterparty_username: "demo_owner",
            created_at: "2026-09-17T23:17:00Z",
            updated_at: "2026-09-17T23:17:00Z"
          }
        ],
        next_cursor: null
      })
    });
  });

  await page.route("**/api/marketplace/accounts/listings/me*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "acc-1",
            title: "ChatGPT Plus",
            description: "Готовый аккаунт",
            price_kzt: 1090,
            status: "active",
            service: {
              slug: "chatgpt",
              name: "ChatGPT"
            },
            owner: {
              id: 1,
              avatar_name: "lunarsalamander"
            },
            created_at: "2026-09-18T20:00:00Z"
          }
        ],
        next_cursor: null
      })
    });
  });

  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await page.getByRole("group", { name: "Разделы", exact: true }).getByRole("button", { name: "Аккаунты", exact: true }).click();
  const ordersTrigger = page.getByTestId("my-accounts-orders-trigger");
  await ordersTrigger.click();

  const accountOrdersDisclosure = page.locator("#my-account-orders");
  await expect(accountOrdersDisclosure.getByRole("heading", { name: "История", exact: true })).toBeVisible();
  await expect(accountOrdersDisclosure.locator(".my-family-section-count")).toHaveText("3");
  const historyChip = accountOrdersDisclosure.getByTestId("my-history-filter-chip");
  await expect(historyChip).toHaveText("Покупки");
  await expect(accountOrdersDisclosure.getByText("Canva Pro годовая подписка")).toBeVisible();
  await expect(accountOrdersDisclosure.getByText("Gemini Advanced на 1 месяц")).toBeVisible();
  await expect(accountOrdersDisclosure.getByText("ChatGPT Plus")).toBeVisible();

  const notifyBtn = accountOrdersDisclosure.getByRole("button", { name: "Уведомить", exact: true });
  await expect(notifyBtn).toBeVisible();

  await notifyBtn.click();
  const toast = page.locator(".ui-toast");
  await expect(toast).toBeVisible();
  await expect(toast).toContainText("Повторить можно через 1 час");

  await page.waitForTimeout(300);
  await page.screenshot({ path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/toast_at_top.png" });

  await toast.click();
  await expect(toast).toHaveCount(0);

  await page.waitForTimeout(200);
  await page.screenshot({ path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/history_with_3_orders.png" });
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
