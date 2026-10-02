import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const frontendRequire = createRequire(path.join(repoRoot, "frontend", "package.json"));
const { chromium } = frontendRequire("playwright");
const tmpDir = path.join(repoRoot, ".tmp");
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

const args = process.argv.slice(2);
const route = args[0] || "/?dev_user=1";
const name = (args[1] || "screen").replace(/[^a-zA-Z0-9_-]/g, "_");
const tabArg = args.find((a) => a.startsWith("--tab="));
const tabIndex = tabArg ? Number(tabArg.split("=")[1]) : null;

const port = process.env.VITE_PORT || "5173";
const targetUrl = route.startsWith("http") ? route : `http://localhost:${port}${route}`;
const outputPath = path.join(tmpDir, `snap-${name}.png`);

async function main() {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2
    });
    const page = await context.newPage();
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 10000 });

    if (tabIndex !== null && !isNaN(tabIndex)) {
      const tabButton = page.locator("nav button").nth(tabIndex);
      if (await tabButton.count()) {
        await tabButton.click();
        await page.waitForTimeout(300);
      }
    }

    await page.screenshot({ path: outputPath });
    console.log(`SNAP_OK: ${outputPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("SNAP_ERROR:", err.message);
  process.exit(1);
});
