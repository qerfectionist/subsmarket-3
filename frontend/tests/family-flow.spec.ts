import { expect, test, type Page } from "@playwright/test";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";
const apiUrl = process.env.TMA_API_URL ?? "http://127.0.0.1:8001";

test.use({
  deviceScaleFactor: 1,
  isMobile: true,
  viewport: { width: 390, height: 844 }
});

test.beforeEach(async ({ page }) => {
  await page.request.post(`${apiUrl}/api/dev/reset-demo-data`);
  await page.request.post(`${apiUrl}/api/catalog/import-family-services`);
  await page.addInitScript(() => {
    window.localStorage.clear();
    const trackedWindow = window as typeof window & { __pendingFetches?: number };
    trackedWindow.__pendingFetches = 0;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (...args) => {
      trackedWindow.__pendingFetches = (trackedWindow.__pendingFetches ?? 0) + 1;
      return originalFetch(...args).finally(() => {
        trackedWindow.__pendingFetches = Math.max(
          0,
          (trackedWindow.__pendingFetches ?? 1) - 1
        );
      });
    };
  });
  page.on("dialog", (dialog) => dialog.accept());
});

test.afterEach(async ({ page }) => {
  await page.request.post(`${apiUrl}/api/dev/reset-demo-data`);
});

test("owner and member complete the first payment family flow", async ({ page }) => {
  const messages: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning", "warn"].includes(message.type())) {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    messages.push(`pageerror: ${error.message}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      messages.push(`${response.status()}: ${response.url()}`);
    }
  });

  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("market-screen")).toBeVisible();
  await expect(page.getByTestId("market-first-run-banner")).toBeVisible();
  await expect(page.getByTestId("market-search-input")).toBeVisible();
  await expect(page.getByTestId("family-type-subscription")).toBeVisible();
  await expect(page.getByTestId("family-type-tariff")).toBeVisible();
  await expect(page.getByTestId("market-buy-gigabytes")).toBeVisible();
  await expect(page.getByTestId("market-buy-accounts")).toBeVisible();
  // The default Spotify-style dock keeps "Создать" inside the nav: 4 buttons.
  await expect(page.locator('nav[aria-label="Главная навигация"] button')).toHaveCount(4);

  await openCreate(page);
  await expect(page.getByTestId("create-family-form")).toBeVisible();
  await openCreateSection(page, "price");
  await expect(page.getByTestId("create-share-preview")).toContainText("650 ₸");
  await fillCreateField(page, "create-total-price-input", "3990");
  await fillCreateField(page, "create-max-members-input", "4");
  await expect(page.getByTestId("create-share-preview")).toContainText("1 000 ₸");
  await fillCreateField(page, "create-payment-phone-input", "+77001234567");
  await fillCreateField(page, "create-description-input", "E2E subscription family");
  await fillCreateField(page, "create-owner-rules-input", "Access first, payment after check.");
  await submitCreateFamily(page);
  await expect(page.getByTestId("family-workspace")).toHaveCount(1);
  await expandFirstFamilyCard(page);
  await expect(page.locator(".family-workspace")).toContainText("Access first");

  await page
    .getByTestId("owner-settings-toggle")
    .evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByTestId("owner-description-input")).toBeVisible();
  await page.getByTestId("owner-description-input").fill("Updated owner description");
  await clickAndWait(page, "owner-save-description-button");
  await expect(page.getByTestId("owner-description-input")).toHaveValue(
    "Updated owner description"
  );
  await page.getByTestId("owner-price-input").fill("4200");
  await clickAndWait(page, "owner-save-price-button");
  await expect(page.getByTestId("owner-price-input")).toHaveValue("4200");
  const nextPaymentDate = futureDateISO(45);
  await page.getByTestId("owner-payment-day-input").fill("18");
  await page.getByTestId("owner-next-payment-date-input").fill(nextPaymentDate);
  await clickAndWait(page, "owner-save-payment-day-button");
  await expect(page.getByTestId("owner-payment-day-input")).toHaveValue("18");
  await expect(page.getByTestId("owner-next-payment-date-input")).toHaveValue(
    nextPaymentDate
  );

  await openFamilyDetailsFromMine(page);
  const createInviteButton = page.getByTestId("create-invite-button");
  if ((await createInviteButton.count()) > 0) {
    await clickAndWait(page, "create-invite-button");
  }
  await expect(page.getByTestId("owner-invite-code")).toBeVisible();
  const inviteCode = (await page.getByTestId("owner-invite-code").innerText()).replace(
    /\s/g,
    ""
  );
  expect(inviteCode).toMatch(/^\d{8}$/);
  await clickAndWait(page, "toggle-family-visibility-button");

  await switchDevUser(page, "200002");
  await openNav(page, 0);
  await expect(page.getByTestId("family-card")).toHaveCount(0);
  await page.getByTestId("market-search-input").fill(inviteCode);
  await page.getByRole("button", { name: `Открыть семью по коду ${inviteCode}` }).click({
    force: true
  });
  await expect(page.getByTestId("detail-send-request-button")).toBeVisible();
  await page.getByTestId("detail-send-request-button").evaluate(el => el.scrollIntoView({ block: "center" }));
  await page.getByTestId("detail-send-request-button").click();
  await waitForNetworkQuiet(page);
  await expect(page.getByText("Заявка отправлена", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("owner-chat-button")).toHaveCount(0);
  await openNav(page, 3);
  await expect(page.getByTestId("request-card")).toContainText("Apple One");
  await expect(page.getByTestId("request-owner-chat-button")).toHaveCount(0);

  await switchDevUser(page, "200001");
  const notificationsButton = page.getByTestId("market-notifications");
  await expect(notificationsButton).toBeVisible();
  await notificationsButton.click({ force: true });
  await waitForNetworkQuiet(page);
  await openNav(page, 1);
  await openOwnerDetails(page);
  await expect(page.getByTestId("approve-request-button")).toBeVisible();
  await clickAndWait(page, "approve-request-button");
  await expect(page.getByTestId("access-provided-button")).toBeVisible();
  await clickAndWait(page, "access-provided-button");
  await expect(page.getByTestId("access-provided-button")).toHaveCount(0);
  await expect(page.getByTestId("remind-access-button")).toBeVisible();
  await clickAndWait(page, "remind-access-button");

  await switchDevUser(page, "200002");
  await expect(page.getByTestId("market-notifications")).toHaveAttribute(
    "aria-label",
    /Заявка принята|Проверьте доступ/
  );
  await openNav(page, 1);
  await expandFirstFamilyCard(page);
  await expect(page.getByTestId("confirm-access-button")).toBeVisible();
  await clickAndWait(page, "confirm-access-button");
  await openFamilyDetailsFromMine(page);
  await expect(page.getByTestId("owner-chat-button")).toBeVisible();
  await openNav(page, 1);
  await expandFirstFamilyCard(page);
  await expect(page.locator(".requisite-box")).toBeVisible();
  await clickAndWait(page, "report-payment-button");
  await expect(page.getByTestId("cancel-payment-report-button")).toBeVisible();

  await switchDevUser(page, "200001");
  await openNav(page, 1);
  await openOwnerDetails(page);
  await expect(page.getByTestId("confirm-payment-button").first()).toBeVisible();
  await clickAndWait(page, "confirm-payment-button");
  await expect(page.getByTestId("confirm-payment-button")).toHaveCount(0);

  await switchDevUser(page, "200002");
  await openNav(page, 1);
  await expect(page.locator(".sm-listing-detail").first()).toContainText("Оплачен");
  await expandFirstFamilyCard(page);
  await expect(page.getByTestId("create-prepayment-button")).toBeVisible();
  await clickAndWait(page, "create-prepayment-button");
  await expect(page.locator(".payment-list")).toContainText("предоплата");
  await expect(page.getByTestId("report-payment-button")).toBeVisible();
  await clickAndWait(page, "report-payment-button");

  await switchDevUser(page, "200001");
  await openNav(page, 1);
  await openOwnerDetails(page);
  await expect(page.getByTestId("confirm-payment-button").first()).toBeVisible();
  await clickAndWait(page, "confirm-payment-button");
  await expect(page.getByTestId("owner-prepayment-periods")).toBeVisible();
  await clickAndWait(page, "owner-record-prepayment-button");
  await expect(page.locator(".payment-list").last()).toContainText("предоплата");

  await selectOptionByLabel(page, "remove-member-reason", "Нет связи");
  await clickAndWait(page, "remove-member-button");
  await expect(page.getByTestId("remove-member-button")).toHaveCount(0);

  await switchDevUser(page, "200002");
  await openNav(page, 1);
  await expect(page.getByTestId("family-workspace")).toHaveCount(0);

  await switchDevUser(page, "200001");
  await openNav(page, 1);
  await openOwnerDetails(page);
  await expect(page.getByTestId("remove-member-button")).toHaveCount(0);

  const relevantMessages = messages.filter(
    (message) =>
      !message.includes("telegram.org/js/telegram-web-app.js") &&
      !message.includes("not supported in version 6.0") &&
      !message.includes("net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin") &&
      !message.includes("React DevTools") &&
      !message.includes("WebSocket") &&
      !message.includes("[vite]") &&
      !message.includes("Vite server")
  );
  expect(relevantMessages).toEqual([]);
});

test("subscription and tariff families stay in separate storefronts", async ({
  page
}) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openCreate(page);
  await page.getByTestId("family-type-tariff").click({ force: true });
  await expect(page.getByTestId("create-family-form")).toBeVisible();
  await fillCreateField(page, "create-plan-name-input", "Семейный 4");
  await fillCreateField(page, "create-total-price-input", "12000");
  await fillCreateField(page, "create-max-members-input", "4");
  await fillCreateField(page, "create-payment-phone-input", "+77001234567");
  await fillCreateField(page, "create-description-input", "Семейный тариф оператора");
  await submitCreateFamily(page);

  await expect(page.getByTestId("family-workspace")).toHaveCount(1);
  await expect(page.getByTestId("family-card")).toHaveAttribute(
    "data-family-type",
    "tariff"
  );

  await switchDevUser(page, "200002");
  await openNav(page, 0);
  await selectMarketTariffs(page);
  await expect(page.getByTestId("family-card")).toHaveCount(1);
  await expect(page.getByTestId("family-card")).toHaveAttribute(
    "data-family-type",
    "tariff"
  );

  // Счётчик рядом с заголовком раздела совпадает с количеством предложений.
  const sectionCount = page.locator(".sm-market-section-heading-copy .sm-market-section-count");
  await expect(sectionCount).toContainText("1");

  await selectMarketSubscriptions(page);
  await expect(
    page.locator(
      '[data-catalog-type="subscription"][aria-hidden="false"] [data-testid="family-card"]'
    )
  ).toHaveCount(0);
});

test("create family form validates phone in real time", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openCreate(page);

  // Nothing is ticked until the owner looks at it; the main button leads to the next section.
  await expect(page.getByTestId("create-hub-status")).toContainText("Осталось 4 раздела");
  await expect(page.getByTestId("create-family-submit")).toHaveCount(0);
  await expect(page.getByTestId("create-family-continue")).toBeEnabled();

  await fillCreateField(page, "create-payment-phone-input", "123");
  await expect(page.locator(".field-error")).toBeVisible();
  await expect(page.locator(".field-error")).toContainText("Формат");
  await expect(page.getByTestId("create-section-done")).toBeDisabled();

  await fillCreateField(page, "create-payment-phone-input", "+77001234567");
  await expect(page.locator(".field-error")).toHaveCount(0);
  await backToCreateSections(page);
  await expect(page.getByTestId("create-section-payment")).toHaveAttribute("data-state", "done");

  await fillCreateField(page, "create-total-price-input", "0");
  await expect(page.locator(".field-error")).toBeVisible();
  await expect(page.locator(".field-error")).toContainText("больше нуля");
  await expect(page.getByTestId("create-section-done")).toBeDisabled();
  await backToCreateSections(page);
  await expect(page.getByTestId("create-section-price")).toHaveAttribute("data-state", "error");
  await expect(page.getByTestId("create-section-price")).toContainText("больше нуля");
  await expect(page.getByTestId("create-family-submit")).toHaveCount(0);
});

test("create family picks a service from the logo list and moves on", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openCreate(page);
  await page.getByTestId("create-family-continue").evaluate((element) => (element as HTMLElement).click());
  await expect(page.locator('[data-create-section="service"]')).toBeVisible();
  const options = page.locator('[data-testid^="create-service-option-"]');
  await expect(options.first()).toBeVisible();
  const second = options.nth(1);
  const name = (await second.locator("strong").innerText()).trim();
  await second.evaluate((element) => (element as HTMLElement).click());
  await expect(page.locator('[data-create-section="price"]')).toBeVisible();
  await backToCreateSections(page);
  await expect(page.getByTestId("create-section-service")).toHaveAttribute("data-state", "done");
  await expect(page.getByTestId("create-section-service")).toContainText(name);
  await expect(page.getByTestId("create-section-service").locator(".service-logo")).toHaveCount(1);
});

test("create family enter key moves to the next section, not the family", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openCreate(page);
  await fillCreateField(page, "create-payment-phone-input", "+77001234567");
  await page.getByTestId("create-payment-phone-input").press("Enter");
  await expect(page.locator('[data-create-section="payment"]')).toHaveCount(0);
  await expect(page.getByTestId("family-workspace")).toHaveCount(0);
  await backToCreateSections(page);
  await expect(page.getByTestId("create-section-payment")).toHaveAttribute("data-state", "done");
  await expect(page.getByTestId("create-family-submit")).toHaveCount(0);
});

test("inside Telegram the native main button drives family creation", async ({ page }) => {
  await page.route("https://telegram.org/js/telegram-web-app.js*", (route) => route.abort());
  // The fake initData switches the app into Telegram mode; API calls keep using dev auth.
  await page.route(`${apiUrl}/**`, (route) => {
    const headers = { ...route.request().headers() };
    delete headers["x-telegram-init-data"];
    route.continue({
      headers: {
        ...headers,
        "X-Dev-Telegram-User-Id": "200001",
        "X-Dev-Telegram-Username": "demo_owner",
        "X-Dev-Telegram-First-Name": "Demo Owner"
      }
    });
  });
  await page.addInitScript(() => {
    const noop = () => {};
    const state = { text: "", visible: false, enabled: true, handlers: [] as (() => void)[] };
    (window as unknown as { __mainButton: typeof state }).__mainButton = state;
    (window as unknown as { Telegram: unknown }).Telegram = {
      WebApp: {
        initData: "query_id=e2e",
        initDataUnsafe: {},
        colorScheme: "dark",
        version: "8.0",
        viewportHeight: 844,
        viewportStableHeight: 844,
        themeParams: {},
        isVersionAtLeast: () => true,
        ready: noop,
        expand: noop,
        setHeaderColor: noop,
        setBackgroundColor: noop,
        setBottomBarColor: noop,
        disableVerticalSwipes: noop,
        enableVerticalSwipes: noop,
        enableClosingConfirmation: noop,
        disableClosingConfirmation: noop,
        onEvent: noop,
        offEvent: noop,
        BackButton: { show: noop, hide: noop, onClick: noop, offClick: noop },
        MainButton: {
          setText: (text: string) => { state.text = text; },
          setParams: noop,
          show: () => { state.visible = true; },
          hide: () => { state.visible = false; },
          enable: () => { state.enabled = true; },
          disable: () => { state.enabled = false; },
          showProgress: noop,
          hideProgress: noop,
          onClick: (fn: () => void) => { state.handlers.push(fn); },
          offClick: (fn: () => void) => { state.handlers = state.handlers.filter((h) => h !== fn); }
        }
      }
    };
  });
  const mainButton = () =>
    page.evaluate(() => {
      const s = (window as unknown as { __mainButton: { text: string; visible: boolean; enabled: boolean; handlers: unknown[] } }).__mainButton;
      return { text: s.text, visible: s.visible, enabled: s.enabled, handlers: s.handlers.length };
    });
  const pressMainButton = () =>
    page.evaluate(() => {
      const s = (window as unknown as { __mainButton: { handlers: (() => void)[] } }).__mainButton;
      s.handlers.forEach((fn) => fn());
    });

  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openCreate(page);
  await expect.poll(mainButton).toEqual({ text: "Продолжить", visible: true, enabled: true, handlers: 1 });
  await expect(page.getByTestId("create-family-continue")).toHaveCount(0);

  await pressMainButton();
  await expect(page.locator('[data-create-section="service"]')).toBeVisible();
  await expect(page.getByTestId("create-section-done")).toHaveCount(0);
  await expect.poll(mainButton).toMatchObject({ text: "Далее", visible: true, handlers: 1 });

  for (const section of ["price", "schedule", "payment"]) {
    await pressMainButton();
    await expect(page.locator(`[data-create-section="${section}"]`)).toBeVisible();
  }
  await expect.poll(mainButton).toMatchObject({ text: "Готово", enabled: false });
  await page.getByTestId("create-payment-phone-input").fill("+77001234567");
  await expect.poll(mainButton).toMatchObject({ text: "Готово", enabled: true, handlers: 1 });
  await pressMainButton();

  await expect(page.getByTestId("create-hub-status")).toContainText("Всё заполнено");
  await expect.poll(mainButton).toMatchObject({ text: "Создать семью", enabled: true, handlers: 1 });
  await pressMainButton();
  await waitForNetworkQuiet(page);
  await expect(page.getByTestId("family-workspace")).toHaveCount(1);
  await expect.poll(mainButton).toMatchObject({ visible: false, handlers: 0 });
});

test("requisite phone is masked until revealed", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openCreate(page);
  await fillCreateField(page, "create-payment-phone-input", "+77001234567");
  await submitCreateFamily(page);
  await expect(page.getByTestId("family-workspace")).toHaveCount(1);

  await switchDevUser(page, "200002");
  await openNav(page, 0);
  await expect(page.getByTestId("family-card")).toHaveCount(1);
  await openFirstFamilyAndRequest(page);

  await switchDevUser(page, "200001");
  await openNav(page, 1);
  await openOwnerDetails(page);
  await expect(page.getByTestId("approve-request-button")).toBeVisible();
  await clickAndWait(page, "approve-request-button");
  await clickAndWait(page, "access-provided-button");

  await switchDevUser(page, "200002");
  await openNav(page, 1);
  await expandFirstFamilyCard(page);
  await clickAndWait(page, "confirm-access-button");
  await expect(page.locator(".requisite-box")).toBeVisible();
  await expect(page.locator(".requisite-box")).toContainText("***");
  await expect(page.locator(".requisite-box")).not.toContainText("+77001234567");
});

test("owner tabs switch between requests members and payments", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openCreate(page);
  await fillCreateField(page, "create-payment-phone-input", "+77001234567");
  await submitCreateFamily(page);
  await expect(page.getByTestId("family-workspace")).toHaveCount(1);

  await openOwnerDetails(page);
  await expect(page.locator(".owner-tabs")).toBeVisible();
  await expect(page.getByTestId("approve-request-button")).toHaveCount(0);
});

test("owner removes a member immediately with a reason", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openCreate(page);
  await fillCreateField(page, "create-payment-phone-input", "+77001234567");
  await submitCreateFamily(page);
  await expect(page.getByTestId("family-workspace")).toHaveCount(1);

  await switchDevUser(page, "200002");
  await openNav(page, 0);
  await openFirstFamilyAndRequest(page);

  await switchDevUser(page, "200001");
  await openNav(page, 1);
  await openOwnerDetails(page);
  await expect(page.getByTestId("approve-request-button")).toBeVisible();
  await clickAndWait(page, "approve-request-button");
  await clickAndWait(page, "access-provided-button");

  await expect(page.getByTestId("remove-member-button")).toBeVisible();
  await selectOptionByLabel(page, "remove-member-reason", "Нет связи");
  await clickAndWait(page, "remove-member-button");

  await expect(page.getByTestId("remove-member-button")).toHaveCount(0);
});

test("cancelling family closure does not call the mutation or show success", async ({
  page
}) => {
  await createFamilyForOwner(page);
  await page
    .getByTestId("owner-settings-toggle")
    .evaluate((element) => (element as HTMLElement).click());
  await page.getByTestId("close-family-date-input").fill(futureDateISO(30));

  const closeRequests: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && /\/api\/families\/[^/]+\/close$/.test(path)) {
      closeRequests.push(path);
    }
  });
  dismissNextDialog(page);
  await page.getByTestId("close-family-button").click();
  await waitForNetworkQuiet(page);

  expect(closeRequests).toHaveLength(0);
  await expect(page.getByText("Семья закрывается", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("close-family-button")).toBeVisible();
});

test("cancelling leaving a family does not call the mutation or show success", async ({
  page
}) => {
  await createFamilyWithActiveMember(page);

  const leaveRequests: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && /\/api\/families\/members\/[^/]+\/leave$/.test(path)) {
      leaveRequests.push(path);
    }
  });
  dismissNextDialog(page);
  await page.getByTestId("leave-family-button").click({ force: true });
  await waitForNetworkQuiet(page);

  expect(leaveRequests).toHaveLength(0);
  await expect(page.getByText("Вы вышли из семьи", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("leave-family-button")).toBeVisible();
});

test("cancelling member removal does not call the mutation or show success", async ({
  page
}) => {
  await createFamilyWithActiveMember(page);
  await switchDevUser(page, "200001");
  await openNav(page, 1);
  await openOwnerDetails(page);
  await expect(page.getByTestId("remove-member-button")).toBeVisible();
  await selectOptionByLabel(page, "remove-member-reason", "Нет связи");

  const removeRequests: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && /\/api\/families\/members\/[^/]+\/remove$/.test(path)) {
      removeRequests.push(path);
    }
  });
  dismissNextDialog(page);
  await page.getByTestId("remove-member-button").click({ force: true });
  await waitForNetworkQuiet(page);

  expect(removeRequests).toHaveLength(0);
  await expect(page.getByText("Участник удалён", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("remove-member-button")).toBeVisible();
});

test("mutation errors stay visible and do not trigger owner detail reload", async ({
  page
}) => {
  await createOwnerPendingRequest(page);

  const approveRequests: string[] = [];
  const ownerDetailRequests: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && /\/api\/families\/requests\/[^/]+\/approve$/.test(path)) {
      approveRequests.push(path);
    }
    if (
      request.method() === "GET" &&
      (/\/api\/families\/[^/]+\/requests\/page$/.test(path) ||
        /\/api\/families\/[^/]+\/members\/page$/.test(path) ||
        /\/api\/families\/[^/]+\/payments$/.test(path))
    ) {
      ownerDetailRequests.push(path);
    }
  });
  await page.route(/\/api\/families\/requests\/[^/]+\/approve$/, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Тестовая ошибка мутации" })
    })
  );

  await clickAndWait(page, "approve-request-button");

  expect(approveRequests).toHaveLength(1);
  expect(ownerDetailRequests).toHaveLength(0);
  await expect(page.locator(".inline-error")).toHaveText("Тестовая ошибка мутации");
  await expect(page.getByTestId("approve-request-button")).toBeVisible();
});

test("successful mutation shows success and refreshes owner details once", async ({ page }) => {
  await createOwnerPendingRequest(page);

  const approveRequests: string[] = [];
  const ownerDetailRequests: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && /\/api\/families\/requests\/[^/]+\/approve$/.test(path)) {
      approveRequests.push(path);
    }
    if (
      request.method() === "GET" &&
      (/\/api\/families\/[^/]+\/requests\/page$/.test(path) ||
        /\/api\/families\/[^/]+\/members\/page$/.test(path) ||
        /\/api\/families\/[^/]+\/payments$/.test(path))
    ) {
      ownerDetailRequests.push(path);
    }
  });

  await clickAndWait(page, "approve-request-button");

  expect(approveRequests).toHaveLength(1);
  expect(ownerDetailRequests.length).toBeGreaterThan(0);
  await expect(page.getByText("Заявка принята", { exact: true })).toBeVisible();
  await expect(page.getByTestId("access-provided-button")).toBeVisible();
});

const CREATE_FIELD_SECTION: Record<string, string> = {
  "create-plan-name-input": "service",
  "create-max-members-input": "price",
  "create-total-price-input": "price",
  "create-payment-day-input": "schedule",
  "create-next-payment-date-input": "schedule",
  "create-payment-phone-input": "payment",
  "create-description-input": "details",
  "create-owner-rules-input": "details"
};

async function openCreateSection(page: Page, section: string) {
  const pane = page.locator(`[data-create-section="${section}"]`);
  if ((await pane.count()) > 0) {
    return;
  }
  await backToCreateSections(page);
  await page
    .getByTestId(`create-section-${section}`)
    .evaluate((element) => (element as HTMLElement).click());
  await expect(pane).toBeVisible();
}

async function backToCreateSections(page: Page) {
  const back = page.getByTestId("create-family-back");
  if ((await back.count()) > 0) {
    await back.evaluate((element) => (element as HTMLElement).click());
  }
  await expect(page.getByTestId("create-hub-status")).toBeVisible();
}

async function fillCreateField(page: Page, testId: string, value: string) {
  await openCreateSection(page, CREATE_FIELD_SECTION[testId] ?? "service");
  await page.getByTestId(testId).fill(value);
}

async function submitCreateFamily(page: Page) {
  const submit = page.getByTestId("create-family-submit");
  for (let attempt = 0; attempt < 12 && (await submit.count()) === 0; attempt += 1) {
    const next = page.getByTestId("create-section-done");
    const target = (await next.count()) > 0 ? next : page.getByTestId("create-family-continue");
    await expect(target).toBeEnabled();
    await target.evaluate((element) => (element as HTMLElement).click());
  }
  await expect(submit).toBeEnabled();
  await submit.scrollIntoViewIfNeeded();
  await submit.evaluate((element) => (element as HTMLElement).click());
  await waitForNetworkQuiet(page);
}

async function createFamilyForOwner(page: Page) {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openCreate(page);
  await fillCreateField(page, "create-payment-phone-input", "+77001234567");
  await submitCreateFamily(page);
  await expect(page.getByTestId("family-workspace")).toHaveCount(1);
  await expandFirstFamilyCard(page);
  await expect(page.getByTestId("owner-settings-toggle")).toBeVisible();
}

async function createOwnerPendingRequest(page: Page) {
  await createFamilyForOwner(page);
  await switchDevUser(page, "200002");
  await openNav(page, 0);
  await openFirstFamilyAndRequest(page);
  await switchDevUser(page, "200001");
  await openNav(page, 1);
  await openOwnerDetails(page);
  await expect(page.getByTestId("approve-request-button")).toBeVisible();
}

async function createFamilyWithActiveMember(page: Page) {
  await createOwnerPendingRequest(page);
  await clickAndWait(page, "approve-request-button");
  await expect(page.getByTestId("access-provided-button")).toBeVisible();
  await clickAndWait(page, "access-provided-button");
  await switchDevUser(page, "200002");
  await openNav(page, 1);
  await expandFirstFamilyCard(page);
  await expect(page.getByTestId("confirm-access-button")).toBeVisible();
  await clickAndWait(page, "confirm-access-button");
  await expect(page.getByTestId("leave-family-button")).toBeVisible();
}

function dismissNextDialog(page: Page) {
  page.removeAllListeners("dialog");
  page.once("dialog", (dialog) => void dialog.dismiss());
}




async function switchDevUser(page: Page, userId: string) {
  await waitForNetworkQuiet(page);
  const select = page.getByTestId("dev-user-select");
  let returnedToMarket = false;
  if (!(await select.isVisible())) {
    const nav = page.getByRole("navigation", { name: "Главная навигация" });
    await nav.getByRole("button", { name: "Мои", exact: true }).click({ force: true });
    const toggleBtn = page.getByTestId("dev-controls-toggle");
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
    }
    await expect(select).toBeVisible();
    returnedToMarket = true;
  }
  const label = userId === "200001" ? "Owner · @demo_owner" : "Member · @demo_member";
  await selectOptionByLabel(page, "dev-user-select", label);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem("subsmarket.devTelegramUser")
      )
    )
    .toBe(userId);
  await expect(page.getByTestId("market-screen")).toBeVisible();
  await waitForNetworkQuiet(page);
  if (returnedToMarket) {
    const nav = page.getByRole("navigation", { name: "Главная навигация" });
    await nav.getByRole("button", { name: "Маркет", exact: true }).click({ force: true });
    await expect(page.getByTestId("market-screen")).toBeVisible();
  }
}

async function selectOptionByLabel(page: Page, testId: string, optionName: string) {
  const select = page.getByTestId(testId).locator("select");
  await select.selectOption({ label: optionName });
  await waitForNetworkQuiet(page);
}

async function openCreate(page: Page) {
  await openNav(page, 2);
  await expect(page.getByTestId("create-family-form")).toBeVisible();
}

async function selectMarketSubscriptions(page: Page) {
  if ((await page.getByTestId("market-screen").count()) === 0) {
    if ((await page.getByTestId("family-catalog-screen").count()) > 0) {
      await page.getByRole("navigation").getByRole("button", { name: "Маркет", exact: true }).click({
        force: true
      });
    } else {
      await page
        .getByRole("navigation")
        .getByRole("button", { name: "Маркет", exact: true })
        .click({ force: true });
    }
    await expect(page.getByTestId("market-screen")).toBeVisible();
  }
  await page
    .getByTestId("family-type-subscription")
    .evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByTestId("family-catalog-screen")).toBeVisible();
  await expect(page.getByTestId("family-type-subscription")).toHaveAttribute("aria-pressed", "true");
  await waitForNetworkQuiet(page);
}

async function selectMarketTariffs(page: Page) {
  if ((await page.getByTestId("market-screen").count()) === 0) {
    if ((await page.getByTestId("family-catalog-screen").count()) > 0) {
      await page.getByRole("navigation").getByRole("button", { name: "Маркет", exact: true }).click({
        force: true
      });
    } else {
      await page
        .getByRole("navigation")
        .getByRole("button", { name: "Маркет", exact: true })
        .click({ force: true });
    }
    await expect(page.getByTestId("market-screen")).toBeVisible();
  }
  await page
    .getByTestId("family-type-tariff")
    .evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByTestId("family-catalog-screen")).toBeVisible();
  await expect(page.getByTestId("family-type-tariff")).toHaveAttribute("aria-pressed", "true");
  await waitForNetworkQuiet(page);
}

async function openNav(page: Page, index: number) {
  const labels = ["Маркет", "Мои", "Создать", "Заявки"] as const;
  const nav = page.getByRole("navigation", { name: "Главная навигация" });
  const button = index === 2
    ? page.locator(".subs-dock-create").getByRole("button", { name: labels[index], exact: true })
    : nav.getByRole("button", { name: labels[index], exact: true });
  await button.evaluate((element) => (element as HTMLElement).click());
  await waitForNetworkQuiet(page);
  await expect(navScreenLocator(page, index)).toBeVisible();
}

function navScreenLocator(page: Page, index: number) {
  switch (index) {
    case 0:
      return page.getByTestId("market-screen");
    case 1:
      return page.getByTestId("my-screen");
    case 3:
      return page.getByTestId("actions-screen");
    case 2:
      return page.getByTestId("create-family-form");
    default:
      return page.locator(".native-screen, .home-page");
  }
}

async function openFamilyDetailsFromMine(page: Page) {
  const openButton = page.getByTestId("workspace-open-family-button").first();
  if ((await openButton.count()) === 0) {
    await expandFirstFamilyCard(page);
  }
  await clickAndWait(page, "workspace-open-family-button");
  await expect(page.locator(".detail-grid")).toBeVisible();
}

async function openOwnerDetails(page: Page) {
  const detailsButton = page.getByTestId("owner-details-button");
  if ((await detailsButton.count()) === 0) {
    await expandFirstFamilyCard(page);
  }
  await detailsButton.evaluate((element) => (element as HTMLElement).click());
}

async function expandFirstFamilyCard(page: Page) {
  await page
    .getByTestId("family-card")
    .first()
    .evaluate((element) => (element as HTMLElement).click());
}

async function openFirstFamilyAndRequest(page: Page) {
  const familyCard = page.getByTestId("family-card").first();
  await familyCard.click({ force: true });
  await expect(page.getByTestId("detail-send-request-button")).toBeVisible();
  await clickAndWait(page, "detail-send-request-button");
  await expect(page.getByText("Заявка отправлена", { exact: true }).first()).toBeVisible();
}

async function clickAndWait(page: Page, testId: string) {
  const target = page.getByTestId(testId);
  await expect(target).toBeEnabled();
  await target.scrollIntoViewIfNeeded();
  // DOM click keeps the flow deterministic when a mobile overlay intercepts pointer events.
  await target.evaluate((element) => (element as HTMLElement).click());
  await waitForNetworkQuiet(page);
}

async function waitForNetworkQuiet(page: Page) {
  for (let index = 0; index < 30; index += 1) {
    const pending = await page.evaluate(
      () => (window as typeof window & { __pendingFetches?: number }).__pendingFetches ?? 0
    );
    if (pending === 0) {
      await page.waitForTimeout(100);
      const stillPending = await page.evaluate(
        () =>
          (window as typeof window & { __pendingFetches?: number })
            .__pendingFetches ?? 0
      );
      if (stillPending === 0) {
        return;
      }
    }
    await page.waitForTimeout(50);
  }
}

function futureDateISO(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
