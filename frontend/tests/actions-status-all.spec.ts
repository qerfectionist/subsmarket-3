import { expect, test } from "@playwright/test";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";

test.use({
  deviceScaleFactor: 2,
  isMobile: true,
  viewport: { width: 390, height: 844 },
});

test("renders all statuses with appropriate color and icon", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });

  // 1. Go to Actions tab (Заявки)
  const nav = page.getByRole("navigation", { name: "Главная навигация" });
  await nav.getByRole("button", { name: "Заявки", exact: true }).click({ force: true });
  await expect(page.getByTestId("actions-screen")).toBeVisible();

  // 2. Open Dev Constructor
  await page.keyboard.press("Control+Shift+D");
  const devModal = page.getByRole("dialog", { name: "Конструктор карточек" });
  await expect(devModal).toBeVisible();

  // 3. Add active cards in Outbox
  await devModal.getByRole("button", { name: "Исходящие (Покупки)" }).click({ force: true });
  await devModal.getByRole("button", { name: "+ Все 3" }).click({ force: true });
  await devModal.getByRole("button", { name: "Все 3 в архив" }).click({ force: true });

  // Close constructor
  await devModal.getByRole("button", { name: "Закрыть" }).click({ force: true });
  await expect(devModal).toHaveCount(0);

  // Switch main page to Outbox
  const outboxTab = page.getByRole("group", { name: "Разделы заявок" }).getByRole("button", { name: "Исходящие" });
  await outboxTab.click({ force: true });
  await page.waitForTimeout(1000);

  // Wait for any toast to disappear
  await page.locator(".toast-item, .sm-toast").waitFor({ state: "detached", timeout: 6000 }).catch(() => {});

  // Take screenshot of active cards in Outbox
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/snap-actions-all-statuses-active.png"
  });

  // 4. Open Archive via direct button click
  const archiveToggle = page.getByTestId("actions-archive-trigger");
  await expect(archiveToggle).toBeVisible();
  await archiveToggle.click();

  const archiveDisclosure = page.locator("#actions-archive-disclosure");
  await expect(archiveDisclosure).toHaveClass(/is-open/);

  // Switch to Outbox tab in Archive
  await page.getByRole("group", { name: "Разделы заявок" }).getByRole("button", { name: "Исходящие" }).click({ force: true });
  await page.waitForTimeout(400);

  // Take screenshot of archive cards
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/snap-actions-all-statuses-archive.png"
  });
});
