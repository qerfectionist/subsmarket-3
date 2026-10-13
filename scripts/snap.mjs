import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const frontendRequire = createRequire(path.join(repoRoot, "frontend", "package.json"));

let chromium;
try {
  const pw = frontendRequire("@playwright/test");
  chromium = pw.chromium;
} catch {
  const pw = frontendRequire("playwright");
  chromium = pw.chromium;
}

const tmpDir = path.join(repoRoot, ".tmp");
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// Conversation brain artifact directory for instant view_file inspection
const brainDir = "C:/Users/qerfe/.gemini/antigravity/brain/9940f9a5-6e3c-4ff4-bf17-5ddbc333f212";

const args = process.argv.slice(2);
const firstArg = args[0] || "market";

// Friendly screen aliases
const SCREEN_ALIASES = {
  market: { tab: 0, name: "market" },
  home: { tab: 0, name: "market" },
  my: { tab: 1, name: "my" },
  mine: { tab: 1, name: "my" },
  actions: { tab: 2, name: "actions" },
  requests: { tab: 2, name: "actions" },
  create: { tab: 3, name: "create" },
  cards: { tab: null, name: "cards", route: "/?screen=cards&dev_user=1" },
  showcase: { tab: null, name: "cards", route: "/?screen=cards&dev_user=1" }
};

let tabIndex = null;
let name = "screen";
let route = "/?dev_user=1";

if (SCREEN_ALIASES[firstArg.toLowerCase()]) {
  const alias = SCREEN_ALIASES[firstArg.toLowerCase()];
  tabIndex = alias.tab;
  name = alias.name;
  if (alias.route) route = alias.route;
} else if (firstArg.startsWith("http")) {
  route = firstArg;
  name = (args[1] || "custom").replace(/[^a-zA-Z0-9_-]/g, "_");
} else if (firstArg.startsWith("/")) {
  route = firstArg;
  name = (args[1] || "custom").replace(/[^a-zA-Z0-9_-]/g, "_");
} else {
  name = firstArg.replace(/[^a-zA-Z0-9_-]/g, "_");
}

const tabArg = args.find((a) => a.startsWith("--tab="));
if (tabArg) {
  tabIndex = Number(tabArg.split("=")[1]);
}

const clickArg = args.find((a) => a.startsWith("--click="));
const clickSelector = clickArg ? clickArg.slice("--click=".length) : null;

const port = process.env.VITE_PORT || "5173";
// Use 127.0.0.1 on Windows to prevent IPv6 [::1] connection delays
const targetUrl = route.startsWith("http") ? route : `http://127.0.0.1:${port}${route}`;
const targetBase = path.join(tmpDir, `snap-${name}`);
const outputPath = `${targetBase}.png`;
const axOutputPath = `${targetBase}.ax.json`;

async function main() {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2
    });
    const page = await context.newPage();

    // Fast and reliable load without networkidle hanging on HMR websocket
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 8000 });
    await page.waitForTimeout(600);

    if (tabIndex !== null && !isNaN(tabIndex)) {
      const tabButton = page.locator(".tab-nav-item, button.tab-nav-item, nav button, footer button").nth(tabIndex);
      if (await tabButton.count()) {
        await tabButton.click();
        await page.waitForTimeout(600);
      }
    }

    if (clickSelector) {
      const target = page.locator(clickSelector).first();
      if (await target.count()) {
        await target.click({ force: true });
        await page.waitForTimeout(400);
      }
    }

    await page.screenshot({ path: outputPath });
    console.log(`SNAP_OK: ${outputPath}`);

    try {
      let snapshot = null;
      if (page.accessibility && typeof page.accessibility.snapshot === "function") {
        snapshot = await page.accessibility.snapshot();
      } else {
        const aria = await page.locator(":root").ariaSnapshot().catch(() => null);
        let nodes = null;
        try {
          const client = await page.context().newCDPSession(page);
          const cdpResult = await client.send("Accessibility.getFullAXTree");
          nodes = cdpResult.nodes;
        } catch {}
        snapshot = { aria, nodes };
      }

      fs.writeFileSync(axOutputPath, JSON.stringify(snapshot, null, 2), "utf8");
      console.log(`AX_OK: ${axOutputPath}`);

      if (fs.existsSync(brainDir)) {
        const brainAxCopy = path.join(brainDir, `snap-${name}.ax.json`);
        fs.writeFileSync(brainAxCopy, JSON.stringify(snapshot, null, 2), "utf8");
        console.log(`BRAIN_AX: ${brainAxCopy}`);
      }
    } catch (axErr) {
      console.warn("AX_WARN:", axErr.message);
    }

    // Also mirror to brain artifact folder if present
    if (fs.existsSync(brainDir)) {
      const brainCopy = path.join(brainDir, `snap-${name}.png`);
      fs.copyFileSync(outputPath, brainCopy);
      console.log(`BRAIN_SNAP: ${brainCopy}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("SNAP_ERROR:", err.message);
  process.exit(1);
});
