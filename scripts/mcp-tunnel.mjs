#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const pythonBin = path.join(repoRoot, "backend", ".venv", "Scripts", "python.exe");
const port = 8003;
const localUrl = `http://127.0.0.1:${port}`;

console.log("\n⚡ ========================================================");
console.log("🚀 Starting SubsMarket MCP Server + Cloudflare Tunnel");
console.log(`   Local Server: ${localUrl}/mcp`);
console.log("========================================================\n");

// 1. Start Python MCP server
const mcpProc = spawn(pythonBin, ["-m", "subsmarket.mcp.server"], {
  cwd: path.join(repoRoot, "backend"),
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    PYTHONPATH: path.join(repoRoot, "backend", "src"),
  },
});

mcpProc.stdout.on("data", (d) => {
  const line = d.toString().trim();
  if (line) console.log(`[MCP Server] ${line}`);
});

mcpProc.stderr.on("data", (d) => {
  const line = d.toString().trim();
  if (line) console.error(`[MCP Server Err] ${line}`);
});

mcpProc.on("exit", (code) => {
  console.log(`[MCP Server exited with code ${code}]`);
});

// 2. Start Cloudflare Tunnel
const cloudflared = spawn(
  "cloudflared",
  ["tunnel", "--url", localUrl, "--no-autoupdate"],
  { stdio: ["ignore", "pipe", "pipe"], shell: true }
);

let tunnelUrl = null;

function onTunnelReady(url) {
  tunnelUrl = url;
  const mcpEndpoint = `${url}/mcp`;

  console.log("\n========================================================");
  console.log("✨ SUBSMARKET MCP TUNNEL IS LIVE!");
  console.log("========================================================");
  console.log(`🔗 MCP Endpoint URL: \x1b[32m${mcpEndpoint}\x1b[0m`);
  console.log(`🌐 Web UI / Health:  \x1b[36m${url}/mcp\x1b[0m`);
  console.log("--------------------------------------------------------");
  console.log("📱 КАК ПОДКЛЮЧИТЬ К GEMINI SPARK:");
  console.log("  1. Открой gemini.google.com -> Settings -> Connected Apps");
  console.log("  2. В разделе 'Custom apps for Spark' нажми 'Add a custom app'");
  console.log(`  3. Вставь URL: ${mcpEndpoint}`);
  console.log("  4. Нажми Connect!");
  console.log("--------------------------------------------------------");
  console.log("💡 Доступные инструменты (Tools) в этом MCP (только чтение):");
  console.log("  • get_platform_stats      - число пользователей, семей и объявлений");
  console.log("  • get_system_health       - доступна ли база данных");
  console.log("  • list_active_families    - последние семьи и свободные места");
  console.log("  • list_marketplace_listings - последние объявления ГБ");
  console.log("--------------------------------------------------------");
  console.log("⚠️  У MCP-сервера нет авторизации: любой, у кого есть эта ссылка,");
  console.log("   видит данные из базы, указанной в DATABASE_URL. Не публикуйте");
  console.log("   ссылку и не запускайте туннель с production-базой.");
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
  process.exit(1);
});

function cleanup() {
  console.log("\n🛑 Stopping MCP Server and Tunnel...");
  if (mcpProc && !mcpProc.killed) mcpProc.kill("SIGTERM");
  if (cloudflared && !cloudflared.killed) cloudflared.kill("SIGTERM");
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});
