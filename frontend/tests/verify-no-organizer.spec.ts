import { test, expect } from "@playwright/test";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";

test.use({
  deviceScaleFactor: 2,
  isMobile: true,
  viewport: { width: 390, height: 844 }
});

test("outbox family requests do not duplicate organizer label", async ({ page }) => {
  // Mock family requests matching user screenshot
  await page.route("**/api/families/requests/me/page*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "req-1",
            family_id: "fam-1",
            user_id: "200002",
            service_name: "Netflix Premium",
            service_variant: "Premium",
            family_type: "subscription",
            owner_username: "beeline_owner",
            status: "approved",
            member_share_kzt: 1200,
            created_at: "2026-09-13T12:00:00Z",
            expires_at: null,
            telegram_draft: null
          },
          {
            id: "req-2",
            family_id: "fam-2",
            user_id: "200002",
            service_name: "Google One 2 ТБ",
            service_variant: null,
            family_type: "subscription",
            owner_username: "youtube_owner",
            status: "approved",
            member_share_kzt: 850,
            created_at: "2026-09-13T12:00:00Z",
            expires_at: null,
            telegram_draft: null
          },
          {
            id: "req-3",
            family_id: "fam-3",
            user_id: "200002",
            service_name: "Spotify Family",
            service_variant: "Family",
            family_type: "subscription",
            owner_username: "netflix_owner",
            status: "approved",
            member_share_kzt: 600,
            created_at: "2026-09-13T12:00:00Z",
            expires_at: null,
            telegram_draft: null
          }
        ],
        next_cursor: null
      })
    });
  });

  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Заявки", exact: true })
    .click({ force: true });
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Исходящие" }).click({ force: true });
  await page.waitForTimeout(400);

  // Take screenshot of outbox matching user's exact screen
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_outbox_fixed_no_organizer.png"
  });

  // Verify that "Организатор:" is gone and clean usernames are displayed
  await expect(page.getByText("@beeline_owner")).toBeVisible();
  await expect(page.getByText("@youtube_owner")).toBeVisible();
  await expect(page.getByText("@netflix_owner")).toBeVisible();
  await expect(page.locator(".trade-counterparty-role:has-text('Организатор')")).toHaveCount(0);

  // Verify that prices are displayed instead of date
  await expect(page.getByText("1 200 ₸")).toBeVisible();
  await expect(page.getByText("850 ₸")).toBeVisible();
  await expect(page.getByText("600 ₸")).toBeVisible();
});
