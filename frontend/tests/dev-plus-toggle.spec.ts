import { expect, test } from "@playwright/test";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";
const apiUrl = process.env.TMA_API_URL ?? "http://127.0.0.1:8001";

test.use({
  deviceScaleFactor: 2,
  isMobile: true,
  viewport: { width: 390, height: 844 },
});

test.beforeEach(async ({ page }) => {
  await page.request.post(`${apiUrl}/api/dev/reset-demo-data`);
  await page.addInitScript(() => {
    window.localStorage.clear();
    // Default to collapsed for this test
    window.localStorage.setItem("sm_dev_panel_open", "false");
  });
});

test("dev panel collapses into plus button on top and opens on click", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });

  // Navigate to "Заявки" (requests) tab where dev controls appear
  await page.getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Заявки", exact: true })
    .click({ force: true });

  const toggleBtn = page.getByTestId("dev-controls-toggle");

  // In test environment, manually toggle to collapsed to capture collapsed state
  const collapseBtn = page.getByTestId("dev-controls-collapse");
  if (await collapseBtn.isVisible()) {
    await collapseBtn.click();
  }

  await expect(toggleBtn).toBeVisible();
  await expect(toggleBtn).toBeVisible();

  // 1. Screenshot collapsed plus button at top
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/dev_top_plus_collapsed.png",
  });

  // 2. Click plus button to expand
  await toggleBtn.click();
  await expect(page.getByTestId("dev-user-select")).toBeVisible();
  await expect(page.getByTestId("dev-controls-collapse")).toBeVisible();
  await page.waitForTimeout(250);

  // 3. Screenshot expanded dev panel
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/dev_top_plus_expanded.png",
  });

  // 4. Click collapse button (xmark) to close it again
  await page.getByTestId("dev-controls-collapse").click();
  await expect(toggleBtn).toBeVisible();
  await expect(page.getByTestId("dev-user-select")).toHaveCount(0);
});
