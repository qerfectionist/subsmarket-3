import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test.use({ deviceScaleFactor: 1, isMobile: true, viewport: { width: 390, height: 844 } });

test("probe scope stomp", async ({ page }) => {
  await page.goto("http://127.0.0.1:5174/", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Мои", exact: true })
    .click({ force: true });
  await page.getByTestId("my-screen").waitFor();

  const iterations = 1;
  const results: unknown[] = [];

  for (let i = 0; i < iterations; i += 1) {
    const target = i % 2 === 0 ? "Аккаунты" : "Подписки";
    await page.evaluate(() => {
      const sw = document.querySelector<HTMLElement>(".product-scope-switch");
      const track = document.querySelector<HTMLElement>(".my-product-scope-swipe-track");
      const pager = document.querySelector<HTMLElement>(".my-product-scope-swipe-viewport");
      if (!sw || !track || !pager) throw new Error("scope probe targets missing");
      const readX = (value: string) => (value === "none" ? 0 : new DOMMatrix(value).m41);
      const segments = Array.from(sw.querySelectorAll("button")).map((b) => b.getBoundingClientRect());
      const step = segments[1].left - segments[0].left;
      const pagerWidth = pager.getBoundingClientRect().width;
      const w = window as unknown as { __probe: { start: number; frames: unknown[]; mutations: unknown[] } };
      w.__probe = { start: performance.now(), frames: [], mutations: [] };
      const sample = () => {
        const indicatorX = readX(getComputedStyle(sw, "::before").transform);
        const trackX = readX(getComputedStyle(track).transform);
        w.__probe.frames.push({
          t: Math.round(performance.now() - w.__probe.start),
          inline: sw.style.getPropertyValue("--scope-position"),
          styleAttr: sw.getAttribute("style"),
          dragging: sw.dataset.scopeDragging ?? null,
          indicator: indicatorX / step,
          content: -trackX / pagerWidth
        });
      };
      const observer = new MutationObserver((list) => {
        for (const mutation of list) {
          w.__probe.mutations.push({
            t: Math.round(performance.now() - w.__probe.start),
            attr: mutation.attributeName,
            value: (mutation.target as HTMLElement).getAttribute("style"),
            dragging: sw.dataset.scopeDragging ?? null
          });
        }
      });
      observer.observe(sw, { attributes: true, attributeFilter: ["style", "data-scope-dragging"] });
      const loop = () => {
        sample();
        if (performance.now() - w.__probe.start < 900) requestAnimationFrame(loop);
        else (window as unknown as { __probeDone: boolean }).__probeDone = true;
      };
      requestAnimationFrame(loop);
    });

    await page
      .getByRole("group", { name: "Разделы", exact: true })
      .getByRole("button", { name: target, exact: true })
      .dispatchEvent("click");
    await page.waitForTimeout(1000);

    const data = await page.evaluate(() => {
      const w = window as unknown as {
        __probe: { frames: Array<{ t: number; inline: string; styleAttr: string | null; dragging: string | null; indicator: number; content: number }>; mutations: unknown[] };
      };
      const frames = w.__probe.frames;
      let maxDiff = 0;
      let maxFrame: unknown = null;
      let bad = 0;
      for (const frame of frames) {
        const diff = Math.abs(frame.indicator - frame.content);
        if (diff > 0.02) bad += 1;
        if (diff > maxDiff) {
          maxDiff = diff;
          maxFrame = frame;
        }
      }
      const integerWrites = w.__probe.mutations.filter((m) => {
        const mutation = m as { value: string | null; dragging: string | null };
        return mutation.value !== null && mutation.value.includes("--scope-position: 0.00") === false;
      });
      return {
        frames: frames.length,
        bad,
        maxDiff: Number(maxDiff.toFixed(4)),
        maxFrame,
        mutationCount: w.__probe.mutations.length,
        mutations: w.__probe.mutations.slice(0, 400),
        integerWrites: integerWrites.length
      };
    });
    results.push({ iteration: i, target, ...data });
  }

  fs.writeFileSync(
    path.join(process.env.TEMP ?? ".", "scope-stomp-probe.json"),
    JSON.stringify(results, null, 2)
  );
});