#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
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

const args = process.argv.slice(2);
const isHeadless = args.includes("--headless");
const port = process.env.VITE_PORT || "5173";
const defaultUrl = `http://127.0.0.1:${port}/?dev_user=1`;

console.log("\n🌐 ========================================================");
console.log(`🚀 SubsMarket Live Playwright Session Runner`);
console.log(`   Target: ${defaultUrl}`);
console.log(`   Mode:   ${isHeadless ? "Headless" : "Headed (Live Chromium Window)"}`);
console.log("========================================================\n");

async function start() {
  const browser = await chromium.launch({
    headless: isHeadless,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS/10.14",
  });

  const page = await context.newPage();

  // Real-time console capture
  page.on("console", (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === "error") {
      console.log(`\x1b[31m[BROWSER ERROR]\x1b[0m ${text}`);
    } else if (type === "warning") {
      console.log(`\x1b[33m[BROWSER WARN]\x1b[0m ${text}`);
    } else if (args.includes("--verbose")) {
      console.log(`[BROWSER ${type.toUpperCase()}] ${text}`);
    }
  });

  page.on("pageerror", (err) => {
    console.error(`\x1b[31m[BROWSER UNCAUGHT]\x1b[0m ${err.message}`);
  });

  try {
    await page.goto(defaultUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    console.log(`✅ Page loaded: ${page.url()}`);
  } catch (err) {
    console.warn(`⚠️ Could not reach ${defaultUrl}: ${err.message}`);
    console.warn("   Make sure frontend dev server is running (`npm run dev` or `npm run dev:frontend`).");
  }

  printHelp();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "\x1b[36mlive-browser>\x1b[0m ",
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    const [cmd, ...rest] = input.split(" ");
    const argStr = rest.join(" ").trim();

    try {
      if (cmd === "q" || cmd === "quit" || cmd === "exit") {
        await cleanup(browser);
        process.exit(0);
      } else if (cmd === "h" || cmd === "help") {
        printHelp();
      } else if (cmd === "r" || cmd === "reload") {
        await page.reload({ waitUntil: "domcontentloaded" });
        console.log("🔄 Page reloaded.");
      } else if (cmd === "s" || cmd === "snap" || cmd === "screenshot") {
        const snapName = argStr || `live-${Date.now()}`;
        const snapPath = path.join(tmpDir, `${snapName}.png`);
        await page.screenshot({ path: snapPath });
        console.log(`📸 Screenshot saved: ${snapPath}`);
      } else if (cmd === "dom" || cmd === "inspect") {
        const selector = argStr || "body";
        const element = await page.$(selector);
        if (element) {
          const text = await element.innerText();
          console.log(`\n🔍 Text content of '${selector}':`);
          console.log(text.slice(0, 500) + (text.length > 500 ? "..." : ""));
        } else {
          console.log(`❌ Element not found for selector: '${selector}'`);
        }
      } else if (cmd === "e" || cmd === "eval") {
        if (!argStr) {
          console.log("Usage: eval <js_expression>");
        } else {
          const result = await page.evaluate((expr) => {
            try {
              // eslint-disable-next-line no-eval
              return window.eval(expr);
            } catch (e) {
              return `Error: ${e.message}`;
            }
          }, argStr);
          console.log("Result:", result);
        }
      } else if (cmd === "goto" || cmd === "g") {
        const target = argStr.startsWith("http")
          ? argStr
          : `http://127.0.0.1:${port}${argStr.startsWith("/") ? "" : "/"}${argStr}`;
        await page.goto(target, { waitUntil: "domcontentloaded" });
        console.log(`📍 Navigated to: ${page.url()}`);
      } else if (cmd === "user") {
        const userNum = argStr || "1";
        const currentUrl = new URL(page.url());
        currentUrl.searchParams.set("dev_user", userNum);
        await page.goto(currentUrl.toString(), { waitUntil: "domcontentloaded" });
        console.log(`👤 Switched to dev_user=${userNum}`);
      } else if (cmd === "theme") {
        const theme = argStr || "dark";
        await page.evaluate((t) => {
          document.documentElement.setAttribute("data-theme", t);
          if (t === "light") {
            document.documentElement.classList.add("tma-light");
          } else {
            document.documentElement.classList.remove("tma-light");
          }
        }, theme);
        console.log(`🎨 Theme set to: ${theme}`);
      } else {
        console.log(`Unknown command: '${cmd}'. Type 'help' for available commands.`);
      }
    } catch (e) {
      console.error(`❌ Error executing command: ${e.message}`);
    }

    rl.prompt();
  });

  browser.on("disconnected", () => {
    console.log("\n🛑 Browser closed. Exiting.");
    process.exit(0);
  });
}

function printHelp() {
  console.log(`
⌨️  Live DevTools Commands:
   • snap [name]        - Take screenshot and save to .tmp/<name>.png
   • dom [selector]     - Inspect element innerText (default: body)
   • eval <expression>  - Execute JS in the page context
   • user [1|2]         - Switch dev user query param
   • theme [dark|light] - Switch UI theme in runtime
   • goto <path>        - Navigate to route (e.g. goto /?screen=cards)
   • reload             - Reload current page
   • help               - Show this list
   • quit               - Close browser and exit
`);
}

async function cleanup(browser) {
  if (browser) {
    console.log("Closing browser session...");
    await browser.close();
  }
}

start().catch((err) => {
  console.error("Fatal error starting live browser:", err);
  process.exit(1);
});
