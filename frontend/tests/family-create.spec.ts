import { expect, test, type Page } from "@playwright/test";
import {
  openCreateKind,
  fillCreateField,
  goToCreateStep,
  revealPayout,
} from "./create-family-helpers";

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

async function openCreate(page: Page) {
  await openNav(page, 2);
  await openCreateKind(page, "subscription");
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
      return page.getByTestId("create-home");
    default:
      return page.locator(".native-screen, .home-page");
  }
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

test("payout step leads one question at a time: bank, phone, name, chat", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openCreate(page);
  await goToCreateStep(page, "payout");
  const phone = page.getByTestId("create-payment-phone-input");
  const name = page.getByTestId("create-recipient-name-input");
  const chat = page.getByTestId("create-chat-telegram");
  const submit = page.getByTestId("create-family-submit");

  // Everything is in view, but only the bank can be touched, and nothing is picked for the person.
  await expect(page.getByTestId("create-bank-kaspi")).toHaveAttribute("aria-checked", "false");
  await expect(page.getByTestId("create-bank-kaspi")).toBeEnabled();
  await expect(phone).toBeDisabled();
  await expect(name).toBeDisabled();
  await expect(chat).toBeDisabled();

  // The «Выплата» bar below fills by thirds as the questions are answered.
  const payoutBar = page.getByTestId("create-progress-payout");
  await expect(payoutBar).toHaveAttribute("data-fill", "0");
  await page.getByTestId("create-bank-halyk").evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByTestId("create-bank-halyk")).toHaveAttribute("aria-checked", "true");
  await expect(payoutBar).toHaveAttribute("data-fill", "1");
  await expect(phone).toBeEnabled();
  await expect(name).toBeDisabled();

  // The name wakes up once the ten digits are in.
  await phone.fill("+77001234567");
  await expect(name).toBeEnabled();

  // «(!) Зачем указывать имя» by the «Получатель» caption opens its answer under the caption.
  const nameInfo = page.getByTestId("create-name-info-panel");
  await expect(nameInfo).toHaveAttribute("aria-hidden", "true");
  await page.getByTestId("create-name-info").click();
  await expect(nameInfo).toHaveAttribute("data-open", "true");
  await expect(page.getByTestId("create-name-info-text")).toContainText("уверен, что платит именно вам");
  await page.getByTestId("create-name-info").click();
  await expect(nameInfo).toHaveAttribute("aria-hidden", "true");
  await expect(chat).toBeDisabled();

  // Leaving the name empty wakes the chat; the family can be created only after picking it.
  await name.evaluate((element) => {
    (element as HTMLElement).focus();
    (element as HTMLElement).blur();
  });
  await expect(chat).toBeEnabled();
  await expect(chat).toHaveAttribute("aria-checked", "false");
  await expect(submit).toBeDisabled();
  await chat.evaluate((element) => (element as HTMLElement).click());
  await expect(submit).toBeEnabled();
  await expect(payoutBar).toHaveAttribute("data-fill", "3");

  // Under the chat: whether the Market shows the family.
  const visibility = page.getByTestId("create-visibility-switch");
  await expect(visibility).toHaveAttribute("aria-checked", "true");
  await visibility.evaluate((element) => (element as HTMLElement).click());
  await expect(visibility).toHaveAttribute("aria-checked", "false");
  await expect(page.getByTestId("create-terms-summary")).toContainText("Так увидят по приглашению");
  await visibility.evaluate((element) => (element as HTMLElement).click());

  // Going back to the terms and forward again keeps everything that was woken up.
  await goToCreateStep(page, "terms");
  await goToCreateStep(page, "payout");
  await expect(page.getByTestId("create-bank-halyk")).toHaveAttribute("aria-checked", "true");
  await expect(chat).toHaveAttribute("aria-checked", "true");
  await expect(submit).toBeEnabled();
});

test("a family can be created without a chat, and the hint explains what the chat is for", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openCreate(page);
  await revealPayout(page, "chat");
  await page.getByTestId("create-payment-phone-input").fill("+77001234567");

  // The text stays in the page so it can unfold smoothly; closed, it is folded and inert.
  const panel = page.getByTestId("create-chat-info-panel");
  await expect(panel).toHaveAttribute("aria-hidden", "true");
  await page.getByTestId("create-chat-info").evaluate((element) => (element as HTMLElement).click());
  await expect(panel).toHaveAttribute("data-open", "true");
  await expect(page.getByTestId("create-chat-info-text")).toContainText("будет напоминать об оплате");
  await expect(page.getByTestId("create-chat-info-text")).toBeVisible();
  await page.getByTestId("create-chat-info").evaluate((element) => (element as HTMLElement).click());
  await expect(panel).toHaveAttribute("aria-hidden", "true");
  await expect(panel).not.toHaveAttribute("data-open");

  await page.getByTestId("create-chat-none").evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByTestId("create-chat-none")).toHaveAttribute("aria-checked", "true");
  // Hidden from the Market: reachable only by the invite link.
  await page.getByTestId("create-visibility-switch").evaluate((element) => (element as HTMLElement).click());
  const submit = page.getByTestId("create-family-submit");
  await expect(submit).toBeEnabled();
  const request = page.waitForRequest((item) => item.method() === "POST" && /\/api\/families$/.test(item.url()));
  await submit.evaluate((element) => (element as HTMLElement).click());
  const sent = (await request).postDataJSON();
  expect(sent.chat_kind).toBeNull();
  expect(sent.is_search_visible).toBe(false);
  await expect(page.getByTestId("family-created-screen")).toBeVisible();
});

test("half-made families survive leaving the app and resume from their kind", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openCreate(page);
  await revealPayout(page, "phone");
  await page.getByTestId("create-bank-halyk").evaluate((element) => (element as HTMLElement).click());
  await page.getByTestId("create-payment-phone-input").fill("+77001234567");

  // An accidental exit: the Mini App is opened again from scratch. The test setup
  // clears storage on every load, so the saved drafts are put back after it.
  const saved = await page.evaluate(() =>
    Object.entries(window.localStorage).filter(([key]) => key.startsWith("subsmarket.createFamilyDrafts."))
  );
  expect(saved).toHaveLength(1);
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), saved[0]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await openNav(page, 2);

  // The kind shows a pencil and the count; tapping it asks: the draft, or a new one.
  await expect(page.getByTestId("create-kind-subscription").getByTestId("create-drafts-count")).toHaveText("1");
  await page.getByTestId("create-kind-subscription").evaluate((element) => (element as HTMLElement).click());
  const sheet = page.getByTestId("create-drafts-sheet");
  await expect(sheet).toContainText("Нужны реквизиты");
  await page.getByTestId("create-draft-resume").evaluate((element) => (element as HTMLElement).click());

  await expect(page.getByTestId("create-family-form")).toHaveAttribute("data-step", "payout");
  await expect(page.getByTestId("create-bank-halyk")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("create-payment-phone-input")).toHaveValue("700 123 45 67");
  await expect(page.getByTestId("create-recipient-name-input")).toBeEnabled();

  // Back on the menu: «Удалить» (behind a swipe) forgets it, «Вернуть» brings it back.
  for (let step = 0; step < 3; step += 1) {
    await page.getByTestId("create-form-back").evaluate((element) => (element as HTMLElement).click());
  }
  await page.getByTestId("create-kind-subscription").evaluate((element) => (element as HTMLElement).click());
  await expect(sheet).toContainText("6 мест");
  await page.getByTestId("create-draft-discard").evaluate((element) => (element as HTMLElement).click());
  await expect(sheet).toHaveCount(0);
  await expect(page.getByTestId("create-drafts-count")).toHaveCount(0);
  await page.getByTestId("create-draft-undo-button").evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByTestId("create-drafts-count")).toHaveText("1");
});

test("create family form validates payout fields in real time", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openCreate(page);
  await goToCreateStep(page, "payout");

  // Empty phone and name: the button waits, and nothing nags before a try.
  await expect(page.getByTestId("create-family-submit")).toBeDisabled();
  await expect(page.getByTestId("create-fix-hint")).toHaveCount(0);

  await fillCreateField(page, "create-payment-phone-input", "123");
  await page.getByTestId("create-payment-phone-input").blur();
  // It says exactly how many digits are still missing: 3 of 10 typed.
  await expect(page.locator(".field-error")).toContainText("Номер неполный: осталось 7 цифр");

  await fillCreateField(page, "create-payment-phone-input", "+77001234567");
  await fillCreateField(page, "create-recipient-name-input", "Айгерим 4400");
  await page.getByTestId("create-recipient-name-input").blur();
  await expect(page.locator(".field-error")).toContainText("без цифр");

  await fillCreateField(page, "create-recipient-name-input", "Айгерим Б.");
  await expect(page.locator(".field-error")).toHaveCount(0);
  await expect(page.getByTestId("create-fix-hint")).toHaveCount(0);
  // Valid, but the chat has not been picked yet: the button still waits.
  await expect(page.getByTestId("create-family-submit")).toBeDisabled();
  await revealPayout(page, "chat");
  await page.getByTestId("create-chat-telegram").evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByTestId("create-family-submit")).toBeEnabled();

  await fillCreateField(page, "create-total-price-input", "0");
  await expect(page.locator(".field-error")).toContainText("больше нуля");
  await expect(page.getByTestId("create-family-next")).toBeDisabled();
  await expect(page.getByTestId("create-fix-hint")).toHaveCount(0);
});

test("create family picks a service from the logo grid and moves on", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openCreate(page);
  await expect(page.getByTestId("create-family-form")).toHaveAttribute("data-step", "service");
  const options = page.locator('[data-testid^="create-service-option-"]');
  await expect(options.first()).toBeVisible();
  const second = options.nth(1);
  const name = (await second.locator("strong").innerText()).trim();
  await second.evaluate((element) => (element as HTMLElement).click());
  await expect(second).toHaveAttribute("aria-checked", "true");
  // The picked tile is ringed and the others dim; the button only says «Далее».
  await expect(page.getByTestId("create-family-next")).toHaveText("Далее");
  await expect(page.getByTestId("create-family-next")).toBeEnabled();
  await expect
    .poll(() => options.first().evaluate((element) => getComputedStyle(element).opacity))
    .toBe("0.38");

  // A second tap on the picked tile takes it back: nothing picked, nothing dim.
  await second.evaluate((element) => (element as HTMLElement).click());
  await expect(second).toHaveAttribute("aria-checked", "false");
  await expect(page.getByTestId("create-family-next")).toBeDisabled();
  await expect
    .poll(() => options.first().evaluate((element) => getComputedStyle(element).opacity))
    .toBe("1");
  await second.evaluate((element) => (element as HTMLElement).click());
  await expect(second).toHaveAttribute("aria-checked", "true");

  await page.getByTestId("create-family-next").evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByTestId("create-family-form")).toHaveAttribute("data-step", "terms");
  await expect(page.getByTestId("create-progress-service")).toHaveAttribute("data-state", "done");
  // Step 2 opens with the family as the Market will show it; the header arrow leads back to step 1.
  await expect(page.getByTestId("create-preview-card")).toContainText(name);
  await expect(page.getByTestId("create-preview-card").locator(".service-logo")).toHaveCount(1);
  await expect(page.getByTestId("create-family-back")).toHaveCount(0);
  await page.getByTestId("create-form-back").click();
  await expect(page.getByTestId("create-family-form")).toHaveAttribute("data-step", "service");
  await page.getByTestId("create-family-next").evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByTestId("create-family-form")).toHaveAttribute("data-step", "terms");

  // Search narrows the grid and says when nothing matches.
  await goToCreateStep(page, "service");
  await page.getByTestId("create-service-search").fill("zzzz");
  await expect(page.getByTestId("create-service-empty")).toContainText("zzzz");
});

test("create family enter key moves to the next step, not the family", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await openCreate(page);
  await fillCreateField(page, "create-total-price-input", "4500");
  await page.getByTestId("create-total-price-input").press("Enter");
  await expect(page.getByTestId("create-family-form")).toHaveAttribute("data-step", "payout");
  await expect(page.getByTestId("family-workspace")).toHaveCount(0);
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
  // Nothing is preselected, so the native button waits for a service.
  await expect.poll(mainButton).toMatchObject({ text: "Далее", visible: true, enabled: false, handlers: 1 });
  await page.getByTestId("create-service-option-youtube-premium").evaluate((element) => (element as HTMLElement).click());
  await expect
    .poll(mainButton)
    .toMatchObject({ text: "Далее", visible: true, enabled: true, handlers: 1 });
  await expect(page.getByTestId("create-family-next")).toHaveCount(0);

  await pressMainButton();
  await expect(page.getByTestId("create-family-form")).toHaveAttribute("data-step", "terms");
  await expect.poll(mainButton).toMatchObject({ text: "Далее", visible: true, handlers: 1 });

  await pressMainButton();
  await expect(page.getByTestId("create-family-form")).toHaveAttribute("data-step", "payout");
  await expect.poll(mainButton).toMatchObject({ text: "Создать семью", enabled: false });
  await revealPayout(page, "name");
  await page.getByTestId("create-payment-phone-input").fill("+77001234567");
  await page.getByTestId("create-recipient-name-input").fill("Айгерим Б.");
  // The chat is the last question: the button waits for it.
  await expect.poll(mainButton).toMatchObject({ text: "Создать семью", enabled: false });
  await revealPayout(page, "chat");
  await page.getByTestId("create-chat-telegram").evaluate((element) => (element as HTMLElement).click());
  await expect.poll(mainButton).toMatchObject({ text: "Создать семью", enabled: true, handlers: 1 });
  await pressMainButton();
  await waitForNetworkQuiet(page);
  // «Семья создана»: the Telegram chat waits for the bot; the main button can postpone it.
  await expect(page.getByTestId("family-created-screen")).toBeVisible();
  await expect(page.getByTestId("family-chat-panel")).toHaveAttribute("data-chat-kind", "telegram");
  await expect(page.getByTestId("family-chat-create-telegram")).toBeVisible();
  await expect(page.getByTestId("family-created-done")).toHaveCount(0);
  await expect.poll(mainButton).toMatchObject({ text: "Подключить позже", visible: true, handlers: 1 });
  await pressMainButton();
  await expect(page.getByTestId("family-workspace")).toHaveCount(1);
  await expect.poll(mainButton).toMatchObject({ visible: false, handlers: 0 });
});
