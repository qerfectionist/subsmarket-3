import { test, expect } from "@playwright/test";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";

test.use({
  deviceScaleFactor: 2,
  isMobile: true,
  viewport: { width: 390, height: 1100 }
});

test("capture visual prototypes for trade card timer", async ({ page }) => {
  await page.goto(appUrl);
  await page.waitForTimeout(500);

  // Render the 4 prototype cards using the app's native markup and CSS variables
  await page.evaluate(() => {
    const root = document.getElementById("root");
    if (!root) return;

    root.innerHTML = `
      <div style="padding: 16px; display: flex; flex-direction: column; gap: 20px; background: var(--app-bg, #000); min-height: 100vh; color: var(--app-text, #fff); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <header style="margin-bottom: 4px;">
          <h1 style="font-size: 1.25rem; font-weight: 700; margin: 0 0 4px 0;">Варианты таймера и цены</h1>
          <p style="font-size: 13px; color: var(--app-muted, #8e8e93); margin: 0;">Сравнение 4 компоновок на реальной карточке 10 ГБ</p>
        </header>

        <!-- ВАРИАНТ 1 -->
        <section style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <strong style="font-size: 13px; color: var(--app-accent, #38bdf8);">Вариант 1 · Каноничный</strong>
            <span style="font-size: 11px; color: var(--app-muted, #8e8e93);">Чистая цена + таймер в футере</span>
          </div>
          <article class="sm-listing my-trade-request" style="margin: 0;">
            <div class="sm-listing-main">
              <div class="service-logo" style="width: 40px; height: 40px; border-radius: 12px; background: #ffcc00; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #000; font-size: 14px;">
                <div style="width: 28px; height: 28px; border-radius: 50%; background: #000; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 3px; padding: 4px; box-sizing: border-box;">
                  <div style="width: 100%; height: 4px; background: #ffcc00; border-radius: 2px;"></div>
                  <div style="width: 100%; height: 4px; background: #ffcc00; border-radius: 2px;"></div>
                </div>
              </div>
              <div class="sm-listing-copy">
                <strong title="10 ГБ">10 ГБ</strong>
                <span>Покупка гигабайта</span>
              </div>
              <div class="sm-listing-price">
                <strong>800 ₸</strong>
              </div>
            </div>
            <div class="sm-listing-footer">
              <span class="sm-market-family-owner">
                <span class="sm-market-family-owner-avatar">T</span>
                <span class="sm-market-family-avatar-name">
                  <span class="sm-market-family-avatar-label">@timur_dev</span>
                </span>
              </span>
              <span class="timer-circular-wrap" title="Ждёт ответа">
                <svg class="timer-ring-svg" viewBox="0 0 18 18" style="width: 18px; height: 18px;">
                  <circle cx="9" cy="9" r="7" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2.2"></circle>
                  <circle cx="9" cy="9" r="7" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-dasharray="44" stroke-dashoffset="10" stroke-linecap="round"></circle>
                </svg>
                <span style="font-size: 13px; font-variant-numeric: tabular-nums; color: #f59e0b; font-weight: 600;">04:41:48</span>
              </span>
            </div>
            <div class="gb-request-actions my-trade-request-actions">
              <button type="button" style="flex: 1 1 0; min-height: 38px; border-radius: 9999px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                ✕ Отменить
              </button>
              <button type="button" style="flex: 1 1 0; min-height: 38px; border-radius: 9999px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                🔔 Напомнить
              </button>
            </div>
          </article>
        </section>

        <!-- ВАРИАНТ 2 -->
        <section style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <strong style="font-size: 13px; color: #34d399;">Вариант 2 · С контекстом у таймера</strong>
            <span style="font-size: 11px; color: var(--app-muted, #8e8e93);">Пояснение цели таймера в футере</span>
          </div>
          <article class="sm-listing my-trade-request" style="margin: 0;">
            <div class="sm-listing-main">
              <div class="service-logo" style="width: 40px; height: 40px; border-radius: 12px; background: #ffcc00; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #000; font-size: 14px;">
                <div style="width: 28px; height: 28px; border-radius: 50%; background: #000; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 3px; padding: 4px; box-sizing: border-box;">
                  <div style="width: 100%; height: 4px; background: #ffcc00; border-radius: 2px;"></div>
                  <div style="width: 100%; height: 4px; background: #ffcc00; border-radius: 2px;"></div>
                </div>
              </div>
              <div class="sm-listing-copy">
                <strong title="10 ГБ">10 ГБ</strong>
                <span>Покупка гигабайта</span>
              </div>
              <div class="sm-listing-price">
                <strong>800 ₸</strong>
              </div>
            </div>
            <div class="sm-listing-footer">
              <span class="sm-market-family-owner">
                <span class="sm-market-family-owner-avatar">T</span>
                <span class="sm-market-family-avatar-name">
                  <span class="sm-market-family-avatar-label">@timur_dev</span>
                </span>
              </span>
              <span style="display: inline-flex; align-items: center; gap: 6px;">
                <span style="font-size: 12px; color: var(--app-muted, #8e8e93);">Ждём ответа</span>
                <span class="timer-circular-wrap">
                  <svg class="timer-ring-svg" viewBox="0 0 18 18" style="width: 18px; height: 18px;">
                    <circle cx="9" cy="9" r="7" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2.2"></circle>
                    <circle cx="9" cy="9" r="7" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-dasharray="44" stroke-dashoffset="10" stroke-linecap="round"></circle>
                  </svg>
                  <span style="font-size: 13px; font-variant-numeric: tabular-nums; color: #f59e0b; font-weight: 600;">04:41:48</span>
                </span>
              </span>
            </div>
            <div class="gb-request-actions my-trade-request-actions">
              <button type="button" style="flex: 1 1 0; min-height: 38px; border-radius: 9999px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                ✕ Отменить
              </button>
              <button type="button" style="flex: 1 1 0; min-height: 38px; border-radius: 9999px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                🔔 Напомнить
              </button>
            </div>
          </article>
        </section>

        <!-- ВАРИАНТ 3 -->
        <section style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <strong style="font-size: 13px; color: #fbbf24;">Вариант 3 · «Разово» под ценой</strong>
            <span style="font-size: 11px; color: var(--app-muted, #8e8e93);">Симметрия с подписками («в месяц»)</span>
          </div>
          <article class="sm-listing my-trade-request" style="margin: 0;">
            <div class="sm-listing-main">
              <div class="service-logo" style="width: 40px; height: 40px; border-radius: 12px; background: #ffcc00; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #000; font-size: 14px;">
                <div style="width: 28px; height: 28px; border-radius: 50%; background: #000; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 3px; padding: 4px; box-sizing: border-box;">
                  <div style="width: 100%; height: 4px; background: #ffcc00; border-radius: 2px;"></div>
                  <div style="width: 100%; height: 4px; background: #ffcc00; border-radius: 2px;"></div>
                </div>
              </div>
              <div class="sm-listing-copy">
                <strong title="10 ГБ">10 ГБ</strong>
                <span>Покупка гигабайта</span>
              </div>
              <div class="sm-listing-price">
                <strong>800 ₸</strong>
                <span style="color: var(--app-muted, #8e8e93); font-size: 12px;">разово</span>
              </div>
            </div>
            <div class="sm-listing-footer">
              <span class="sm-market-family-owner">
                <span class="sm-market-family-owner-avatar">T</span>
                <span class="sm-market-family-avatar-name">
                  <span class="sm-market-family-avatar-label">@timur_dev</span>
                </span>
              </span>
              <span class="timer-circular-wrap">
                <svg class="timer-ring-svg" viewBox="0 0 18 18" style="width: 18px; height: 18px;">
                  <circle cx="9" cy="9" r="7" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2.2"></circle>
                  <circle cx="9" cy="9" r="7" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-dasharray="44" stroke-dashoffset="10" stroke-linecap="round"></circle>
                </svg>
                <span style="font-size: 13px; font-variant-numeric: tabular-nums; color: #f59e0b; font-weight: 600;">04:41:48</span>
              </span>
            </div>
            <div class="gb-request-actions my-trade-request-actions">
              <button type="button" style="flex: 1 1 0; min-height: 38px; border-radius: 9999px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                ✕ Отменить
              </button>
              <button type="button" style="flex: 1 1 0; min-height: 38px; border-radius: 9999px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                🔔 Напомнить
              </button>
            </div>
          </article>
        </section>

        <!-- ВАРИАНТ 4 -->
        <section style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <strong style="font-size: 13px; color: #a78bfa;">Вариант 4 · Таймер прямо под ценой</strong>
            <span style="font-size: 11px; color: var(--app-muted, #8e8e93);">Срочность в блоке цены, статус в футере</span>
          </div>
          <article class="sm-listing my-trade-request" style="margin: 0;">
            <div class="sm-listing-main">
              <div class="service-logo" style="width: 40px; height: 40px; border-radius: 12px; background: #ffcc00; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #000; font-size: 14px;">
                <div style="width: 28px; height: 28px; border-radius: 50%; background: #000; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 3px; padding: 4px; box-sizing: border-box;">
                  <div style="width: 100%; height: 4px; background: #ffcc00; border-radius: 2px;"></div>
                  <div style="width: 100%; height: 4px; background: #ffcc00; border-radius: 2px;"></div>
                </div>
              </div>
              <div class="sm-listing-copy">
                <strong title="10 ГБ">10 ГБ</strong>
                <span>Покупка гигабайта</span>
              </div>
              <div class="sm-listing-price">
                <strong>800 ₸</strong>
                <span style="display: inline-flex; align-items: center; gap: 4px; color: #f59e0b; font-size: 12px; font-weight: 500; font-variant-numeric: tabular-nums;">
                  <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #f59e0b;"></span>
                  04:41:48
                </span>
              </div>
            </div>
            <div class="sm-listing-footer">
              <span class="sm-market-family-owner">
                <span class="sm-market-family-owner-avatar">T</span>
                <span class="sm-market-family-avatar-name">
                  <span class="sm-market-family-avatar-label">@timur_dev</span>
                </span>
              </span>
              <span class="my-trade-request-status is-pending" style="color: var(--app-muted, #8e8e93); font-size: 13px;">
                Ждём ответа
              </span>
            </div>
            <div class="gb-request-actions my-trade-request-actions">
              <button type="button" style="flex: 1 1 0; min-height: 38px; border-radius: 9999px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                ✕ Отменить
              </button>
              <button type="button" style="flex: 1 1 0; min-height: 38px; border-radius: 9999px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                🔔 Напомнить
              </button>
            </div>
          </article>
        </section>

      </div>
    `;
  });

  await page.waitForTimeout(300);

  await page.screenshot({
    path: "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212/screen_prototypes.png",
    fullPage: true
  });
});
