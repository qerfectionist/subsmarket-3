import { expect, test } from "@playwright/test";
import path from "node:path";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";

test.use({
  deviceScaleFactor: 1,
  isMobile: true,
  viewport: { width: 390, height: 844 }
});

test("My empty state renders create family button and navigates to create flow", async ({ page }) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });

  const bottomNav = page.getByRole("navigation", { name: "Главная навигация" });
  await bottomNav.getByRole("button", { name: "Мои", exact: true }).click({ force: true });

  await expect(page.getByTestId("my-screen")).toBeVisible();

  const createButton = page.getByTestId("my-family-create-button");
  await expect(createButton).toBeVisible();
  await expect(createButton).toHaveText("Создать семью");

  const artifactDir = "C:\\Users\\qerfe\\.gemini\\antigravity\\brain\\9940f9a5-6e3c-4ff4-bf17-5ddbc333f212";
  const screenshotPath = path.join(artifactDir, "screen_my_family_empty_state_create.png");
  await page.screenshot({ path: screenshotPath });

  // Click «Создать семью»
  await createButton.click();

  // Verify navigation to create family screen
  await expect(page.getByTestId("create-family-form")).toBeVisible();

  const screenshotCreatePath = path.join(artifactDir, "screen_create_family_from_mine_empty.png");
  await page.screenshot({ path: screenshotCreatePath });

  // Click back to return to «Мои»
  const backBtn = page.getByRole("button", { name: "Назад", exact: true });
  if (await backBtn.isVisible()) {
    await backBtn.click();
    await expect(page.getByTestId("my-screen")).toBeVisible();
  }
});
