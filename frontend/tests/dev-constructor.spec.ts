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
  });
  page.on("dialog", (dialog) => dialog.accept());
});

test.afterEach(async ({ page }) => {
  await page.request.post(`${apiUrl}/api/dev/reset-demo-data`);
});

async function waitForNetworkQuiet(page: Page) {
  await page.waitForTimeout(300);
}

async function openActions(page: Page) {
  const nav = page.getByRole("navigation", { name: "Главная навигация" });
  const button = nav.getByRole("button", { name: "Заявки", exact: true });
  await button.evaluate((element) => (element as HTMLElement).click());
  await waitForNetworkQuiet(page);
  await expect(page.getByTestId("actions-screen")).toBeVisible();
}

test("dev constructor adds and clears test cards across all 3 categories", async ({ page }) => {
  await page.goto(appUrl);
  await openActions(page);

  // Check that the + trigger button exists
  const constructorTrigger = page.getByTestId("actions-dev-constructor-trigger");
  await expect(constructorTrigger).toBeVisible();

  // Open constructor
  await constructorTrigger.click();
  const constructorPanel = page.getByTestId("actions-dev-constructor");
  await expect(constructorPanel).toBeVisible();

  // Add 1 card of each category
  await page.getByTestId("dev-add-family").click();
  await expect(page.getByTestId("family-sales-actions-card")).toBeVisible();

  await page.getByTestId("dev-add-account").click();
  await expect(page.getByTestId("account-sales-actions-card")).toBeVisible();

  await page.getByTestId("dev-add-gb").click();
  await expect(page.getByTestId("marketplace-actions-card")).toBeVisible();

  // Accept the account card to see the exact state from user's screenshot
  const accountCard = page.getByTestId("account-sales-actions-card");
  await accountCard.getByRole("button", { name: "Принять" }).click();
  const writeBtn = accountCard.getByRole("button", { name: "Написать" });
  await expect(writeBtn).toBeVisible();
  await writeBtn.click();
  await expect(accountCard.getByRole("button", { name: "Продано", exact: true })).toBeVisible();

  // Verify prototype switcher buttons exist in constructor
  const protoBtn1 = page.getByTestId("dev-proto-btn-1");
  const protoBtn2 = page.getByTestId("dev-proto-btn-2");
  const protoBtn3 = page.getByTestId("dev-proto-btn-3");
  const protoBtn4 = page.getByTestId("dev-proto-btn-4");

  await expect(protoBtn1).toBeVisible();
  await expect(protoBtn2).toBeVisible();
  await expect(protoBtn3).toBeVisible();
  await expect(protoBtn4).toBeVisible();

  // Test mode 2: Context
  await protoBtn2.click();
  await expect(protoBtn2).toHaveClass(/is-active/);

  // Test mode 3: "разово"
  await protoBtn3.click();
  await expect(protoBtn3).toHaveClass(/is-active/);

  // Test mode 4: Timer under price
  await protoBtn4.click();
  await expect(protoBtn4).toHaveClass(/is-active/);

  // Switch to mode 2 (Контекст)
  await protoBtn2.click();
  await page.waitForTimeout(100);

  // Scroll to family card (pending) to see the 5h timer in action
  const famCard = page.getByTestId("family-sales-actions-card");
  await famCard.scrollIntoViewIfNeeded();

  // Take screenshot showing the family candidate card with mode 2 (5h timer)
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_family_5h.png"
  });

  // Scroll to marketplace card (pending) to see the timer in action
  const gbCard = page.getByTestId("marketplace-actions-card");
  await gbCard.scrollIntoViewIfNeeded();

  // Take screenshot showing the pending card with mode 2
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_dev_constructor.png"
  });

  // Switch to mode 4 (Под ценой)
  await protoBtn4.click();
  await page.waitForTimeout(100);
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_proto_mode4.png"
  });

  // Switch to mode 3 (Разово)
  await protoBtn3.click();
  await page.waitForTimeout(100);
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_proto_mode3.png"
  });

  // Switch to mode 1 (Каноничный)
  await protoBtn1.click();
  await page.waitForTimeout(100);
  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_proto_mode1.png"
  });

  // Scroll back to top to show constructor
  await page.evaluate(() => window.scrollTo(0, 0));

  // Verify Clear All works
  const clearBtn = page.getByTestId("dev-clear-all");
  await expect(clearBtn).toBeVisible();
  await clearBtn.click();

  // Cards should be gone
  await expect(page.getByTestId("marketplace-actions-card")).toHaveCount(0);
  await expect(page.getByTestId("account-sales-actions-card")).toHaveCount(0);
  await expect(page.getByTestId("family-sales-actions-card")).toHaveCount(0);

  // Test "All 3 categories" button in 1 click
  await page.getByTestId("dev-add-all-categories").click();
  await expect(page.getByTestId("family-sales-actions-card")).toBeVisible();
  await expect(page.getByTestId("account-sales-actions-card")).toBeVisible();
  await expect(page.getByTestId("marketplace-actions-card")).toBeVisible();

  // Close constructor with + (which is now x)
  await constructorTrigger.click();
  await expect(constructorPanel).toHaveCount(0);
});
