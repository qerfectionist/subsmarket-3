import { expect, test } from "@playwright/test";
import { readSegmentIndicatorGeometry } from "./motion-helpers";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";
const apiUrl = process.env.TMA_API_URL ?? "http://127.0.0.1:5174";

test.use({
  deviceScaleFactor: 1,
  isMobile: true,
  viewport: { width: 390, height: 844 }
});

test.beforeEach(async ({ page }) => {
  await page.request.post(`${apiUrl}/api/dev/reset-demo-data`);
  await page.addInitScript(() => window.localStorage.clear());
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

  // Switch to outbox
  await outbox.click();
  await expect(outbox).toHaveAttribute("aria-pressed", "true");
  await expect(inbox).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("actions-outbox-pane")).toBeVisible();

  // Switch back to inbox
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

  const categoryLabel = page.getByTestId("actions-category-filter-label");
  const statusLabel = page.getByTestId("actions-status-filter-label");
  await page.getByTestId("actions-category-filter-chip").click();
  await page.getByTestId("actions-status-filter-chip").click();
  await expect(categoryLabel).not.toHaveText("Все");
  await expect(statusLabel).not.toHaveText("Все статусы");

  const scopeSwitch = page.locator(".actions-screen .product-scope-switch");
  await scopeSwitch.getByTestId("actions-tab-outbox").click();
  await expect(categoryLabel).toHaveText("Все");
  await expect(statusLabel).toHaveText("Все статусы");
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

test("Actions expired requests do not hang in active feed and are placed in archive", async ({ page }, testInfo) => {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000 - 10000).toISOString();

  await page.addInitScript(({ sixHoursAgo, fiveHoursAgo }) => {
    const expiredDevCards = {
      candidates: [
        {
          family: {
            id: "test-fam-apple",
            service_id: "apple-1",
            service_name: "Apple One",
            service_slug: "apple-one",
            family_type: "subscription",
            plan_name: "Apple One Family",
            period: "monthly",
            total_price_kzt: 2600,
            member_share_kzt: 650,
            max_members: 4,
            active_members_count: 2,
            free_slots: 2,
            status: "active",
            rounding_delta_kzt: 0,
            payment_day: 15,
            next_payment_date: "2026-10-15",
            description: "",
            owner_rules: "",
            owner: { avatar_name: "Apple Owner", first_name: "Apple", photo_url: null },
            is_search_visible: true,
            service_variant: null,
            created_at: sixHoursAgo
          },
          request: {
            id: "test-req-apple-exp",
            family_id: "test-fam-apple",
            family_type: "subscription",
            service_name: "Apple One",
            service_variant: null,
            plan_name: "Apple One Family",
            owner_username: "apple_owner",
            user_id: "cand-user-1",
            status: "pending",
            cancel_reason: null,
            created_at: sixHoursAgo,
            expires_at: fiveHoursAgo,
            decided_at: null,
            cancelled_at: null,
            expired_at: null,
            candidate: {
              id: "cand-1",
              username: "daniyar_pro",
              first_name: "Daniyar",
              photo_url: null
            }
          }
        }
      ],
      sellerAccounts: [
        {
          id: "test-acc-tg-exp",
          listing_id: "list-tg-1",
          role: "seller",
          status: "expired",
          service_name: "Telegram Premium",
          service_slug: "telegram",
          title: "Telegram Premium 1 год",
          price_kzt: 3490,
          counterparty_username: "yerassyl_7",
          created_at: sixHoursAgo,
          can_remind: false
        }
      ],
      buyerAccounts: [],
      sellerGb: [],
      buyerGb: [],
      buyerFamilies: []
    };
    localStorage.setItem("sm_dev_test_cards_v3", JSON.stringify(expiredDevCards));
  }, { sixHoursAgo, fiveHoursAgo });

  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Заявки", exact: true })
    .click({ force: true });

  await expect(page.getByTestId("actions-screen")).toBeVisible();
  await expect(page.getByTestId("account-sales-actions-card")).toHaveCount(0);
  await expect(page.getByTestId("family-sales-actions-card")).toHaveCount(0);
  await expect(page.getByText("Нет входящих заявок")).toBeVisible();

  const openArchiveBtn = page.getByRole("button", { name: /Открыть архив \(2\)/ });
  await expect(openArchiveBtn).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("screen_actions_empty_state_composed.png")
  });
  await page.locator(".subs-dock").screenshot({
    path: testInfo.outputPath("dock_no_border.png")
  });

  await openArchiveBtn.click();
  const disclosure = page.locator("#actions-archive-disclosure");
  await expect(disclosure).toHaveClass(/is-open/);
  await page.waitForTimeout(400);

  const archiveItems = page.getByTestId("actions-archive-item");
  await expect(archiveItems).toHaveCount(2);
  await expect(page.getByText("Telegram Premium")).toBeVisible();
  await expect(page.getByText("Apple One")).toBeVisible();
  await expect(page.getByText("Вы не ответили, срок истёк").first()).toBeVisible();
  await expect(page.getByText("3 490 ₸")).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("screen_actions_archive_clarified_expired.png")
  });
});

test("Actions empty state copywriting is clean and verified visually", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.removeItem("sm_dev_test_cards_v3");
  });

  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Заявки", exact: true })
    .click({ force: true });

  await expect(page.getByTestId("actions-screen")).toBeVisible();
  await expect(page.getByText("Нет входящих заявок")).toBeVisible();
  await expect(page.getByText("Новые запросы от покупателей")).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("screen_actions_inbox_copy_fixed.png")
  });

  // Switch to Outbox
  await page.getByRole("button", { name: "Исходящие", exact: true }).click({ force: true });
  await page.waitForTimeout(400);
  await expect(page.getByText("Нет активных заявок")).toBeVisible();
  await expect(page.getByText("Ваши заявки на покупку")).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("screen_actions_outbox_copy_fixed.png")
  });

  // Open Archive from header trigger to verify empty archive copy
  await page.getByTestId("actions-archive-trigger").click();
  const disclosure = page.locator("#actions-archive-disclosure");
  await expect(disclosure).toHaveClass(/is-open/);
  await page.waitForTimeout(400);

  await expect(page.getByText("В архиве пока нет заявок").first()).toBeVisible();
  await expect(page.getByText("Завершённые и отменённые заявки").first()).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("screen_actions_archive_empty_copy_fixed.png")
  });
});
