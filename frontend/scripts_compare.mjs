import { chromium } from "playwright";

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("http://localhost:5173/?nav=spotify");
  await page.waitForTimeout(1000);
  const navItems = page.locator(".subs-dock-surface--spotify .subs-dock-item");

  // 1. My Families
  await navItems.nth(1).click();
  await page.waitForTimeout(800);

  const myStyles = await page.evaluate(() => {
    const cs = (el) => el ? window.getComputedStyle(el) : null;
    const title = document.querySelector("h1, .my-screen-title, .screen-title");
    const headerRow = document.querySelector(".my-screen-header, .app-header, header");
    const scopeSwitch = document.querySelector(".product-scope-switch, [role='group']");
    const scopeBtn = scopeSwitch?.querySelector("button[aria-pressed='true']");
    const sectionRow = document.querySelector(".my-family-filter-row");
    const sectionTitle = document.querySelector(".my-family-section-title");
    const sectionCount = document.querySelector(".my-family-section-count");
    const chips = Array.from(document.querySelectorAll(".my-family-filter-row button"));

    return {
      titleText: title?.textContent?.trim(),
      titleFont: cs(title) ? `${cs(title).fontSize} / ${cs(title).lineHeight} weight:${cs(title).fontWeight} color:${cs(title).color}` : null,
      titleMargins: cs(title) ? `m:${cs(title).margin} p:${cs(title).padding}` : null,
      headerRow: cs(headerRow) ? {
        height: cs(headerRow).height,
        padding: cs(headerRow).padding,
        margin: cs(headerRow).margin
      } : null,
      scopeSwitch: cs(scopeSwitch) ? {
        height: cs(scopeSwitch).height,
        padding: cs(scopeSwitch).padding,
        borderRadius: cs(scopeSwitch).borderRadius,
        background: cs(scopeSwitch).backgroundColor,
        gap: cs(scopeSwitch).gap,
        margin: cs(scopeSwitch).margin
      } : null,
      scopeBtn: cs(scopeBtn) ? {
        height: cs(scopeBtn).height,
        fontSize: cs(scopeBtn).fontSize,
        fontWeight: cs(scopeBtn).fontWeight,
        borderRadius: cs(scopeBtn).borderRadius,
        background: cs(scopeBtn).backgroundColor,
        padding: cs(scopeBtn).padding
      } : null,
      sectionRow: cs(sectionRow) ? {
        height: cs(sectionRow).height,
        gap: cs(sectionRow).gap,
        margin: cs(sectionRow).margin,
        padding: cs(sectionRow).padding
      } : null,
      sectionTitleFont: cs(sectionTitle) ? `${cs(sectionTitle).fontSize} / ${cs(sectionTitle).lineHeight} weight:${cs(sectionTitle).fontWeight} color:${cs(sectionTitle).color}` : null,
      sectionCountFont: cs(sectionCount) ? `${cs(sectionCount).fontSize} / ${cs(sectionCount).lineHeight} weight:${cs(sectionCount).fontWeight} color:${cs(sectionCount).color}` : null,
      chips: chips.map(c => ({
        text: c.textContent?.trim(),
        height: cs(c)?.height,
        padding: cs(c)?.padding,
        fontSize: cs(c)?.fontSize,
        fontWeight: cs(c)?.fontWeight,
        borderRadius: cs(c)?.borderRadius,
        background: cs(c)?.backgroundColor,
        border: cs(c)?.border,
        gap: cs(c)?.gap
      }))
    };
  });

  // 2. Actions (Заявки)
  await navItems.nth(2).click();
  await page.waitForTimeout(800);

  const actionsStyles = await page.evaluate(() => {
    const cs = (el) => el ? window.getComputedStyle(el) : null;
    const title = document.querySelector("h1, .actions-screen-title, .screen-title");
    const headerRow = document.querySelector(".actions-screen-header, .actions-header, .app-header, header");
    const scopeSwitch = document.querySelector(".actions-direction-switch, .family-type-switch, [role='group']");
    const scopeBtn = scopeSwitch?.querySelector("button[aria-pressed='true'], button.is-active");
    const sectionRow = document.querySelector(".my-family-filter-row, .actions-section-header, .actions-feed-header");
    const sectionTitle = document.querySelector(".my-family-section-title, .actions-section-title, h2");
    const sectionCount = document.querySelector(".my-family-section-count, .actions-section-count");
    const chips = Array.from(document.querySelectorAll(".actions-section-header button, .actions-filter-row button, .my-family-filter-row button, .actions-feed-header button, [data-testid*='filter-chip']"));

    return {
      titleText: title?.textContent?.trim(),
      titleFont: cs(title) ? `${cs(title).fontSize} / ${cs(title).lineHeight} weight:${cs(title).fontWeight} color:${cs(title).color}` : null,
      titleMargins: cs(title) ? `m:${cs(title).margin} p:${cs(title).padding}` : null,
      headerRow: cs(headerRow) ? {
        height: cs(headerRow).height,
        padding: cs(headerRow).padding,
        margin: cs(headerRow).margin
      } : null,
      scopeSwitch: cs(scopeSwitch) ? {
        height: cs(scopeSwitch).height,
        padding: cs(scopeSwitch).padding,
        borderRadius: cs(scopeSwitch).borderRadius,
        background: cs(scopeSwitch).backgroundColor,
        gap: cs(scopeSwitch).gap,
        margin: cs(scopeSwitch).margin
      } : null,
      scopeBtn: cs(scopeBtn) ? {
        height: cs(scopeBtn).height,
        fontSize: cs(scopeBtn).fontSize,
        fontWeight: cs(scopeBtn).fontWeight,
        borderRadius: cs(scopeBtn).borderRadius,
        background: cs(scopeBtn).backgroundColor,
        padding: cs(scopeBtn).padding
      } : null,
      sectionRow: cs(sectionRow) ? {
        height: cs(sectionRow).height,
        gap: cs(sectionRow).gap,
        margin: cs(sectionRow).margin,
        padding: cs(sectionRow).padding
      } : null,
      sectionTitleFont: cs(sectionTitle) ? `${cs(sectionTitle).fontSize} / ${cs(sectionTitle).lineHeight} weight:${cs(sectionTitle).fontWeight} color:${cs(sectionTitle).color}` : null,
      sectionCountFont: cs(sectionCount) ? `${cs(sectionCount).fontSize} / ${cs(sectionCount).lineHeight} weight:${cs(sectionCount).fontWeight} color:${cs(sectionCount).color}` : null,
      chips: chips.map(c => ({
        text: c.textContent?.trim(),
        height: cs(c)?.height,
        padding: cs(c)?.padding,
        fontSize: cs(c)?.fontSize,
        fontWeight: cs(c)?.fontWeight,
        borderRadius: cs(c)?.borderRadius,
        background: cs(c)?.backgroundColor,
        border: cs(c)?.border,
        gap: cs(c)?.gap
      }))
    };
  });

  console.log("=== SCREEN MY ===");
  console.log(JSON.stringify(myStyles, null, 2));
  console.log("=== SCREEN ACTIONS ===");
  console.log(JSON.stringify(actionsStyles, null, 2));
  await browser.close();
}

run();
