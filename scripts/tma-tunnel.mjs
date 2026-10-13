#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const frontendPkg = path.join(repoRoot, "frontend", "package.json");
const req = createRequire(frontendPkg);
let QRCode;
try {
  QRCode = req("qrcode");
} catch {
  QRCode = null;
}

const targetPort = process.env.PORT || "5173";
const targetHost = process.env.HOST || "127.0.0.1";
const localTarget = `http://${targetHost}:${targetPort}`;

console.log("\n🌐 ========================================================");
console.log(`🚀 Starting Cloudflare Tunnel for Real Phone TMA Testing`);
console.log(`   Target: ${localTarget}`);
console.log("========================================================\n");

const cloudflared = spawn(
  "cloudflared",
  ["tunnel", "--url", localTarget, "--no-autoupdate"],
  { stdio: ["ignore", "pipe", "pipe"], shell: true }
);

let tunnelUrl = null;

async function onTunnelReady(url) {
  tunnelUrl = url;
  const devUser1Url = `${url}/?dev_user=1`;
  const devUser2Url = `${url}/?dev_user=2`;

  console.log("\n========================================================");
  console.log("✨ CLOUDFLARE TUNNEL ONLINE!");
  console.log("========================================================");
  console.log(`🔗 Public Base URL:     \x1b[32m${url}\x1b[0m`);
  console.log(`📱 Phone Tester (User 1): \x1b[36m${devUser1Url}\x1b[0m`);
  console.log(`👥 Phone Tester (User 2): \x1b[35m${devUser2Url}\x1b[0m`);
  console.log("--------------------------------------------------------");

  if (QRCode) {
    try {
      const qrAscii = await QRCode.toString(devUser1Url, {
        type: "terminal",
        small: true,
      });
      console.log("\n📷 Scan QR with phone camera / Telegram to open instantly:");
      console.log(qrAscii);
    } catch (e) {
      console.warn("Could not generate QR code:", e.message);
    }
  }

  console.log("💡 Testing Tips:");
  console.log("   • Open URL directly in mobile browser: full TMA theme & dev controls active.");
  console.log("   • Or set URL in @BotFather -> /newapp / /setmenubutton to test in real Telegram.");
  console.log("   • Press Ctrl+C anytime to close tunnel.");
  console.log("========================================================\n");
}

function processChunk(data) {
  const text = data.toString();
  if (!tunnelUrl) {
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match) {
      onTunnelReady(match[0]);
    }
  }
}

cloudflared.stdout.on("data", processChunk);
cloudflared.stderr.on("data", processChunk);

cloudflared.on("error", (err) => {
  console.error("❌ Failed to start cloudflared:", err.message);
  console.error("   Make sure cloudflared is installed (`winget install Cloudflare.cloudflared`).");
  process.exit(1);
});

cloudflared.on("exit", (code) => {
  console.log(`\n🛑 Cloudflare tunnel stopped (exit code: ${code}).`);
  process.exit(code || 0);
});

function cleanup() {
  if (cloudflared && !cloudflared.killed) {
    console.log("\nShutting down tunnel...");
    cloudflared.kill("SIGTERM");
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});
