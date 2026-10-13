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

  const myDeep = await page.evaluate(() => {
    const cs = (el) => el ? window.getComputedStyle(el) : null;
    const headerBtn = document.querySelector(".my-screen-header button, header button");
    const container = document.querySelector(".my-screen-container, main > div, .app-shell");
    const header = document.querySelector(".my-screen-header, header");
    const scopeContainer = document.querySelector(".my-screen-scope, .my-product-scope");
    const contentContainer = document.querySelector(".my-product-scope-swipe-pane");

    return {
      headerBtn: headerBtn ? {
        width: cs(headerBtn).width,
        height: cs(headerBtn).height,
        borderRadius: cs(headerBtn).borderRadius,
        padding: cs(headerBtn).padding,
        background: cs(headerBtn).backgroundColor
      } : null,
      gaps: {
        headerBottomMargin: cs(header)?.marginBottom,
        headerPadding: cs(header)?.padding,
        scopeMarginBottom: cs(document.querySelector(".product-scope-switch"))?.marginBottom,
        filterRowMarginTop: cs(document.querySelector(".my-family-filter-row"))?.marginTop,
        filterRowMarginBottom: cs(document.querySelector(".my-family-filter-row"))?.marginBottom
      }
    };
  });

  // 2. Actions (Заявки)
  await navItems.nth(2).click();
  await page.waitForTimeout(800);

  const actionsDeep = await page.evaluate(() => {
    const cs = (el) => el ? window.getComputedStyle(el) : null;
    const headerBtn = document.querySelector(".actions-screen-header button, .actions-archive-btn, header button");
    const card = document.querySelector(".actions-card, .request-card, [data-testid='request-card']");
    const cardTitle = card?.querySelector(".request-card-title, .actions-card-title, h3, strong");
    const cardPrice = card?.querySelector(".request-card-price, .actions-card-price");
    const actionBtns = Array.from(card?.querySelectorAll("button") || []);
    const header = document.querySelector(".actions-screen-header, .actions-header, header");

    return {
      headerBtn: headerBtn ? {
        width: cs(headerBtn).width,
        height: cs(headerBtn).height,
        borderRadius: cs(headerBtn).borderRadius,
        padding: cs(headerBtn).padding,
        background: cs(headerBtn).backgroundColor
      } : null,
      gaps: {
        headerBottomMargin: cs(header)?.marginBottom,
        headerPadding: cs(header)?.padding,
        scopeMarginBottom: cs(document.querySelector(".actions-direction-switch"))?.marginBottom,
        filterRowMarginTop: cs(document.querySelector(".actions-section-header, .my-family-filter-row"))?.marginTop,
        filterRowMarginBottom: cs(document.querySelector(".actions-section-header, .my-family-filter-row"))?.marginBottom
      },
      card: card ? {
        borderRadius: cs(card).borderRadius,
        padding: cs(card).padding,
        background: cs(card).backgroundColor,
        marginBottom: cs(card).marginBottom,
        border: cs(card).border
      } : null,
      cardTitle: cardTitle ? {
        fontSize: cs(cardTitle).fontSize,
        fontWeight: cs(cardTitle).fontWeight,
        color: cs(cardTitle).color
      } : null,
      cardPrice: cardPrice ? {
        fontSize: cs(cardPrice).fontSize,
        fontWeight: cs(cardPrice).fontWeight,
        color: cs(cardPrice).color
      } : null,
      actionBtns: actionBtns.map(b => ({
        text: b.textContent?.trim(),
        height: cs(b).height,
        borderRadius: cs(b).borderRadius,
        fontSize: cs(b).fontSize,
        fontWeight: cs(b).fontWeight,
        background: cs(b).backgroundColor,
        padding: cs(b).padding
      }))
    };
  });

  console.log("=== MY DEEP ===");
  console.log(JSON.stringify(myDeep, null, 2));
  console.log("=== ACTIONS DEEP ===");
  console.log(JSON.stringify(actionsDeep, null, 2));
  await browser.close();
}

run();
