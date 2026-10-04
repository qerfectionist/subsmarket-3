import { expect, test } from "@playwright/test";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";

test.use({
  deviceScaleFactor: 2,
  isMobile: true,
  viewport: { width: 390, height: 844 },
});

test("adds and displays rejected outbox requests in archive and constructor", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });

  // 1. Go to Actions tab (Заявки)
  const nav = page.getByRole("navigation", { name: "Главная навигация" });
  await nav.getByRole("button", { name: "Заявки", exact: true }).click({ force: true });
  await expect(page.getByTestId("actions-screen")).toBeVisible();

  // 2. Open Dev Constructor "⚡ Карточки"
  const devFab = page.getByTestId("dev-floating-fab-btn");
  await expect(devFab).toBeVisible();
  await devFab.click({ force: true });

  const devModal = page.getByRole("dialog", { name: "Конструктор карточек" });
  await expect(devModal).toBeVisible();

  // 3. Switch to Outbox (Исходящие / Покупки)
  await devModal.getByRole("button", { name: "Исходящие (Покупки)" }).click({ force: true });
  await expect(devModal.getByText("Отклонённые мои заявки (В архив)")).toBeVisible();

  // Capture screenshot of Constructor with rejected buttons
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_constructor_rejected_options.png"
  });

  // 4. Click "Все 3 в архив"
  const addAllRejectedBtn = devModal.getByRole("button", { name: "Все 3 в архив" });
  await expect(addAllRejectedBtn).toBeVisible();
  await addAllRejectedBtn.click({ force: true });

  // Close constructor modal
  const closeBtn = devModal.getByRole("button", { name: "Закрыть" });
  await closeBtn.click({ force: true });
  await expect(devModal).toHaveCount(0);

  // 5. Open Archive
  const archiveToggle = page.getByTestId("actions-archive-trigger");
  await expect(archiveToggle).toBeVisible();
  await archiveToggle.click({ force: true });

  const archiveDisclosure = page.locator("#actions-archive-disclosure");
  await expect(archiveDisclosure).toHaveClass(/is-open/);

  // Switch to Outbox tab in Archive
  await page.getByRole("group", { name: "Разделы заявок" }).getByRole("button", { name: "Исходящие" }).click({ force: true });
  await page.waitForTimeout(400);

  // 6. Verify rejected cards appear in archive
  const archiveList = page.getByTestId("actions-archive-list");
  await expect(archiveList).toBeVisible();

  const rejectedBadges = page.locator(".my-trade-request-status:has-text('Отклонена'), .my-trade-request-status:has-text('Отклонён')");
  await expect(rejectedBadges.first()).toBeVisible();

  // Visual snapshot 1: Archive with rejected cards
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_archive_rejected_cards.png"
  });

  // Scroll archive feed down to verify last card scrolls to the top (first position)
  const archiveScrollContainer = page.locator(".actions-scope-swipe-pane[data-actions-tab='outbox'] .actions-archive-feed-scroll");
  await archiveScrollContainer.evaluate((el) => {
    el.scrollTo({ top: el.scrollHeight, behavior: "instant" });
  });
  await page.waitForTimeout(400);

  // Visual snapshot: Last card scrolled to top position
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_archive_scrolled_last_card_first.png"
  });

  // Verify that the last card is now near the top of the container
  const lastCard = archiveScrollContainer.locator(".actions-archive-card").last();
  const containerBox = await archiveScrollContainer.boundingBox();
  const lastCardBox = await lastCard.boundingBox();
  expect(containerBox).not.toBeNull();
  expect(lastCardBox).not.toBeNull();
  if (containerBox && lastCardBox) {
    // The top of the last card should be within 30px of the container's top edge
    expect(lastCardBox.y - containerBox.y).toBeLessThanOrEqual(30);
  }

  // 7. Cycle filter to "Успешные"
  const filterChip = page.locator('button[aria-label^="Статус архива"]');
  await filterChip.click();
  await expect(filterChip).toContainText("Успешные");
  await page.waitForTimeout(300);

  // Since there are 0 successful but 3 rejected, empty state should show "Показать отклонённые" button
  const showRejectedBtn = page.getByRole("button", { name: "Показать отклонённые" });
  await expect(showRejectedBtn).toBeVisible();

  // Visual snapshot 2: Empty state under "Успешные" with quick button
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_archive_successful_filter_with_quick_btn.png"
  });

  // 8. Clicking "Показать отклонённые" switches filter to cancelled
  await showRejectedBtn.click({ force: true });
  await expect(filterChip).toContainText("Отклонённые");
  await page.waitForTimeout(300);
  await expect(archiveList).toBeVisible();

  // Visual snapshot 3: Rejected filter active with cards
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_archive_rejected_filter_active.png"
  });
});
