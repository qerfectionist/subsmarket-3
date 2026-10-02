import { expect, test, type Page } from "@playwright/test";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";

test.use({
  deviceScaleFactor: 2,
  isMobile: true,
  viewport: { width: 390, height: 844 },
});

async function waitForNetworkQuiet(page: Page) {
  await page.waitForTimeout(250);
}

async function switchDevUser(page: Page, userId: string, optionName: string) {
  const container = page.getByTestId("dev-user-select");
  let returnedToMarket = false;
  if (!(await container.isVisible())) {
    const nav = page.getByRole("navigation", { name: "Главная навигация" });
    await nav.getByRole("button", { name: "Мои", exact: true }).click({ force: true });
    await expect(container).toBeVisible();
    returnedToMarket = true;
  }
  await container.locator("select").selectOption({ label: optionName });
  await waitForNetworkQuiet(page);
  await expect(page.getByTestId("market-screen")).toBeVisible();
  if (returnedToMarket) {
    const nav = page.getByRole("navigation", { name: "Главная навигация" });
    await nav.getByRole("button", { name: "Маркет", exact: true }).click({ force: true });
    await expect(page.getByTestId("market-screen")).toBeVisible();
  }
}

test("capture archive cards without username", async ({ page }) => {
  // Publish + request + accept + close to generate archive items
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await page.locator(".product-scope-switch").getByRole("button", { name: "ГБ" }).click({ force: true });
  await page.getByTestId("my-gigabytes-create-button").click({ force: true });
  await page.getByLabel("Цена за 1 ГБ, ₸").fill("200");
  await page.getByLabel("Описание").fill("Archive test listing");
  await page.getByRole("button", { name: "Опубликовать на 7 дней" }).click({ force: true });
  await waitForNetworkQuiet(page);

  // Buyer sends request
  await page.locator('nav[aria-label="Главная навигация"] button').nth(0).click({ force: true });
  await switchDevUser(page, "200002", "Member · @demo_member");
  await page.getByTestId("market-buy-gigabytes").click({ force: true });
  const listing = page.getByTestId("gigabytes-listing-card").first();
  await listing.click({ force: true });
  await page.getByRole("button", { name: "5 ГБ" }).click({ force: true });
  const submitRequest = page.getByTestId("marketplace-submit-request");
  await expect(submitRequest).toBeEnabled();
  await submitRequest.click();
  await waitForNetworkQuiet(page);

  // Seller rejects → goes to archive
  await page.locator('nav[aria-label="Главная навигация"] button').nth(0).click({ force: true });
  await switchDevUser(page, "200001", "Owner · @demo_owner");
  await page.getByTestId("market-notifications").click({ force: true });
  await waitForNetworkQuiet(page);

  // Click reject and wait for countdown to complete (350ms in test mode)
  const rejectBtn = page.getByTestId("trade-request-reject-btn");
  await rejectBtn.click({ force: true });
  await page.waitForTimeout(600);
  await waitForNetworkQuiet(page);

  // Open archive
  const archiveTrigger = page.getByTestId("actions-archive-trigger");
  await archiveTrigger.click({ force: true });
  await page.waitForTimeout(500);

  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_archive_no_username.png",
  });

  // Verify no @username is visible in archive cards
  const archiveItems = page.getByTestId("actions-archive-item");
  const count = await archiveItems.count();
  expect(count).toBeGreaterThan(0);

  // Verify the archive card does not contain @demo_member
  for (let i = 0; i < count; i++) {
    const text = await archiveItems.nth(i).textContent();
    expect(text).not.toContain("@demo_member");
    expect(text).not.toContain("@demo_owner");
  }
});
