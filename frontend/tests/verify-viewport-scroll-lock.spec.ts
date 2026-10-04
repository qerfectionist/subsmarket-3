import { expect, test } from "@playwright/test";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";

test.use({
  deviceScaleFactor: 2,
  isMobile: true,
  viewport: { width: 390, height: 844 }
});

test("viewport and shells are strictly locked to 100vh with zero outer scroll", async ({ page }) => {
  await page.goto(`${appUrl}?platform=ios`, { waitUntil: "domcontentloaded" });
  const nav = page.getByRole("navigation", { name: "Главная навигация" });
  await expect(nav).toBeVisible();

  // 1. Verify Market: window/body/html have 0 scroll and cannot be scrolled
  const marketMetrics = await page.evaluate(() => {
    window.scrollTo(0, 500);
    return {
      windowScrollY: window.scrollY,
      htmlScrollTop: document.documentElement.scrollTop,
      bodyScrollTop: document.body.scrollTop,
      windowInnerHeight: window.innerHeight,
      htmlScrollHeight: document.documentElement.scrollHeight
    };
  });

  expect(marketMetrics.windowScrollY).toBe(0);
  expect(marketMetrics.htmlScrollTop).toBe(0);
  expect(marketMetrics.bodyScrollTop).toBe(0);
  expect(marketMetrics.htmlScrollHeight).toBeLessThanOrEqual(marketMetrics.windowInnerHeight + 1);

  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_verify_market_locked.png"
  });

  // 2. Navigate to "Заявки" (Actions)
  await nav.getByRole("button", { name: "Заявки", exact: true }).click({ force: true });
  await expect(page.getByTestId("actions-screen")).toBeVisible();

  const actionsMetrics = await page.evaluate(() => {
    window.scrollTo(0, 500);
    return {
      windowScrollY: window.scrollY,
      htmlScrollTop: document.documentElement.scrollTop,
      bodyScrollTop: document.body.scrollTop,
      windowInnerHeight: window.innerHeight,
      htmlScrollHeight: document.documentElement.scrollHeight
    };
  });

  expect(actionsMetrics.windowScrollY).toBe(0);
  expect(actionsMetrics.htmlScrollTop).toBe(0);
  expect(actionsMetrics.bodyScrollTop).toBe(0);
  expect(actionsMetrics.htmlScrollHeight).toBeLessThanOrEqual(actionsMetrics.windowInnerHeight + 1);

  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_verify_actions_locked.png"
  });

  // 3. Navigate to "Мои" (My)
  await nav.getByRole("button", { name: "Мои", exact: true }).click({ force: true });
  await expect(page.getByTestId("my-screen")).toBeVisible();

  const myMetrics = await page.evaluate(() => {
    window.scrollTo(0, 500);
    return {
      windowScrollY: window.scrollY,
      htmlScrollTop: document.documentElement.scrollTop,
      bodyScrollTop: document.body.scrollTop,
      windowInnerHeight: window.innerHeight,
      htmlScrollHeight: document.documentElement.scrollHeight
    };
  });

  expect(myMetrics.windowScrollY).toBe(0);
  expect(myMetrics.htmlScrollTop).toBe(0);
  expect(myMetrics.bodyScrollTop).toBe(0);
  expect(myMetrics.htmlScrollHeight).toBeLessThanOrEqual(myMetrics.windowInnerHeight + 1);

  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_verify_my_locked.png"
  });
});
