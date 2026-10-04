import { expect, test } from "@playwright/test";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";

test.use({
  deviceScaleFactor: 2,
  isMobile: true,
  viewport: { width: 390, height: 844 }
});

test("swiping directly on the segment switch toggles between inbox and outbox", async ({ page }) => {
  await page.goto(`${appUrl}?platform=ios`, { waitUntil: "domcontentloaded" });
  const nav = page.getByRole("navigation", { name: "Главная навигация" });
  await expect(nav).toBeVisible();

  // Go to "Заявки"
  await nav.getByRole("button", { name: "Заявки", exact: true }).click({ force: true });
  await expect(page.getByTestId("actions-screen")).toBeVisible();

  const switchEl = page.locator(".actions-screen .product-scope-switch");
  const inboxBtn = switchEl.getByTestId("actions-tab-inbox");
  const outboxBtn = switchEl.getByTestId("actions-tab-outbox");

  // Initial state: "Входящие" is active
  await expect(inboxBtn).toHaveAttribute("aria-pressed", "true");
  await expect(outboxBtn).toHaveAttribute("aria-pressed", "false");

  const box = await switchEl.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const y = box.y + box.height / 2;

  // 1. Swipe right on the switch: from inbox area (25% width) to outbox area (75% width)
  await page.mouse.move(box.x + box.width * 0.25, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, y, { steps: 8 });
  await page.mouse.up();

  // Verify that it switched to "Исходящие"
  await expect(outboxBtn).toHaveAttribute("aria-pressed", "true");
  await expect(inboxBtn).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("actions-outbox-pane")).toBeVisible();

  // Visual screenshot after swipe to Outbox
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_actions_swiped_to_outbox.png"
  });

  // 2. Swipe left on the switch: from outbox area (75% width) to inbox area (25% width)
  await page.mouse.move(box.x + box.width * 0.75, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.25, y, { steps: 8 });
  await page.mouse.up();

  // Verify that it switched back to "Входящие"
  await expect(inboxBtn).toHaveAttribute("aria-pressed", "true");
  await expect(outboxBtn).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("actions-inbox-pane")).toBeVisible();

  // Visual screenshot after swipe back to Inbox
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_actions_swiped_to_inbox.png"
  });
});

test("moderate drag without velocity commits to target and does not snap back", async ({ page }) => {
  await page.goto(`${appUrl}?platform=ios`, { waitUntil: "domcontentloaded" });
  const nav = page.getByRole("navigation", { name: "Главная навигация" });
  await nav.getByRole("button", { name: "Заявки", exact: true }).click({ force: true });
  await expect(page.getByTestId("actions-screen")).toBeVisible();

  const switchEl = page.locator(".actions-screen .product-scope-switch");
  const inboxBtn = switchEl.getByTestId("actions-tab-inbox");
  const outboxBtn = switchEl.getByTestId("actions-tab-outbox");

  await expect(inboxBtn).toHaveAttribute("aria-pressed", "true");

  const box = await switchEl.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const y = box.y + box.height / 2;

  // Drag 35px to the right slowly and pause before releasing
  await page.mouse.move(box.x + box.width * 0.25, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.25 + 35, y, { steps: 5 });
  await page.waitForTimeout(100);
  await page.mouse.up();

  // Must commit to Outbox, not snap back to Inbox
  await expect(outboxBtn).toHaveAttribute("aria-pressed", "true");
  await expect(inboxBtn).toHaveAttribute("aria-pressed", "false");
});
