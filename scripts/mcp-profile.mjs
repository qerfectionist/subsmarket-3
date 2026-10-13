#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const antigravityDir = process.env.ANTIGRAVITY_HOME || path.join(os.homedir(), ".gemini", "antigravity");
const mcpDir = path.join(antigravityDir, "mcp");
const configFile = path.join(antigravityDir, "mcp_config.json");
const configBackup = path.join(antigravityDir, "mcp_config.backup.json");

const PROFILES = {
  lean: {
    name: "Lean (Fast & Low Context)",
    description: "Core terminal, filesystem, and git only. Heavy design/cloud MCPs disabled.",
    allowed: ["github-mcp-server"]
  },
  design: {
    name: "Design & UI Exploration",
    description: "Figma, Mobbin, Awwwards, Pencil, Puppeteer enabled for UI workflows.",
    allowed: ["figma", "Mobbin", "awwwards", "pencil", "puppeteer", "github-mcp-server"]
  },
  dev: {
    name: "Backend & Cloud Services",
    description: "Postgres, Supabase, CloudRun, and Git enabled for backend development.",
    allowed: ["postgres", "supabase", "cloudrun", "github-mcp-server"]
  },
  full: {
    name: "Full (All MCP Servers)",
    description: "All installed MCP tools and schemas loaded simultaneously.",
    allowed: null // null means all enabled
  }
};

function getMcpConfig() {
  if (!fs.existsSync(configFile)) return { mcpServers: {}, _disabledServers: {} };
  try {
    const raw = fs.readFileSync(configFile, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed.mcpServers) parsed.mcpServers = {};
    if (!parsed._disabledServers) parsed._disabledServers = {};
    return parsed;
  } catch (err) {
    console.error("⚠️ Failed to parse mcp_config.json:", err.message);
    return { mcpServers: {}, _disabledServers: {} };
  }
}

function saveMcpConfig(data) {
  try {
    if (fs.existsSync(configFile)) {
      fs.copyFileSync(configFile, configBackup);
    }
    fs.writeFileSync(configFile, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("❌ Failed to save mcp_config.json:", err.message);
    return false;
  }
}

function listServers() {
  const config = getMcpConfig();
  const servers = new Map();

  if (fs.existsSync(mcpDir)) {
    const entries = fs.readdirSync(mcpDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const isDisabled = entry.name.endsWith(".disabled");
      const baseName = isDisabled ? entry.name.slice(0, -9) : entry.name;
      const folderPath = path.join(mcpDir, entry.name);
      const jsonTools = fs.readdirSync(folderPath).filter(f => f.endsWith(".json")).length;

      servers.set(baseName, {
        name: baseName,
        hasFolder: true,
        folderName: entry.name,
        folderDisabled: isDisabled,
        toolCount: jsonTools,
        hasConfig: false,
        configDisabled: false
      });
    }
  }

  for (const name of Object.keys(config.mcpServers || {})) {
    const s = servers.get(name) || {
      name,
      hasFolder: false,
      folderName: null,
      folderDisabled: false,
      toolCount: 0,
      hasConfig: true,
      configDisabled: false
    };
    s.hasConfig = true;
    s.configDisabled = false;
    servers.set(name, s);
  }

  for (const name of Object.keys(config._disabledServers || {})) {
    const s = servers.get(name) || {
      name,
      hasFolder: false,
      folderName: null,
      folderDisabled: false,
      toolCount: 0,
      hasConfig: true,
      configDisabled: true
    };
    s.hasConfig = true;
    s.configDisabled = true;
    servers.set(name, s);
  }

  return Array.from(servers.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function setServerState(server, enable) {
  let changed = false;
  if (server.hasFolder) {
    const currentPath = path.join(mcpDir, server.folderName);
    const targetName = enable ? server.name : `${server.name}.disabled`;
    const targetPath = path.join(mcpDir, targetName);

    if (currentPath !== targetPath && fs.existsSync(currentPath)) {
      try {
        fs.renameSync(currentPath, targetPath);
        server.folderName = targetName;
        server.folderDisabled = !enable;
        changed = true;
      } catch (err) {
        console.error(`⚠️ Could not rename ${server.folderName}:`, err.message);
      }
    }
  }

  if (server.hasConfig) {
    const config = getMcpConfig();
    if (enable && config._disabledServers[server.name]) {
      config.mcpServers[server.name] = config._disabledServers[server.name];
      delete config._disabledServers[server.name];
      saveMcpConfig(config);
      server.configDisabled = false;
      changed = true;
    } else if (!enable && config.mcpServers[server.name]) {
      config._disabledServers[server.name] = config.mcpServers[server.name];
      delete config.mcpServers[server.name];
      saveMcpConfig(config);
      server.configDisabled = true;
      changed = true;
    }
  }

  return changed;
}

function detectCurrentProfile(servers) {
  const active = servers.filter(s => !s.folderDisabled && !s.configDisabled).map(s => s.name);
  if (active.length === 0) return "Ultra-Minimal (0 active)";
  if (active.length === servers.length) return "Full (all active)";

  for (const [key, prof] of Object.entries(PROFILES)) {
    if (!prof.allowed) continue;
    const isMatch = active.length === prof.allowed.length &&
      active.every(name => prof.allowed.includes(name));
    if (isMatch) return prof.name;
  }
  return `Custom (${active.length}/${servers.length} active)`;
}

function printStatus() {
  const servers = listServers();
  const currentProfile = detectCurrentProfile(servers);

  console.log("\n📦 Antigravity MCP Profile Manager");
  console.log(`📂 Location: ${mcpDir}`);
  console.log(`🎯 Active Profile: \x1b[1m\x1b[36m${currentProfile}\x1b[0m\n`);

  console.log("Status  | Server Name         | Type           | Tools/Schemas | Token Overhead (est.)");
  console.log("------- | ------------------- | -------------- | ------------- | --------------------");

  let totalActiveTools = 0;
  for (const s of servers) {
    const isActive = !s.folderDisabled && !s.configDisabled;
    const statusLabel = isActive ? "\x1b[32m🟢 ON \x1b[0m" : "\x1b[90m⚪ OFF\x1b[0m";
    const type = s.hasFolder && s.hasConfig ? "Schema + Config" : s.hasFolder ? "Schema Only" : "Config Only";
    const tools = s.toolCount > 0 ? `${s.toolCount} tools` : "-";
    const estTokens = isActive ? `~${Math.max(1, s.toolCount) * 90} tokens` : "0 (saved)";

    if (isActive) totalActiveTools += Math.max(1, s.toolCount);
    console.log(
      `${statusLabel}  | ${s.name.padEnd(19)} | ${type.padEnd(14)} | ${tools.padEnd(13)} | ${estTokens}`
    );
  }

  console.log("------- | ------------------- | -------------- | ------------- | --------------------");
  console.log(`Estimated active schema context load: ~${totalActiveTools * 90} tokens\n`);

  console.log("Available profiles:");
  console.log("  npm run mcp:profile -- lean     ⚡ Core only (github-mcp-server, native file/exec)");
  console.log("  npm run mcp:profile -- design   🎨 UI & Design (figma, mobbin, awwwards, pencil)");
  console.log("  npm run mcp:profile -- dev      💻 Backend & Cloud (postgres, supabase, cloudrun)");
  console.log("  npm run mcp:profile -- full     🚀 All MCP servers enabled");
  console.log("  npm run mcp:profile -- toggle <name>  🔄 Toggle individual server\n");
}

function applyProfile(profileKey) {
  const prof = PROFILES[profileKey];
  if (!prof) {
    console.error(`❌ Unknown profile: "${profileKey}". Available: ${Object.keys(PROFILES).join(", ")}`);
    process.exit(1);
  }

  const servers = listServers();
  let changedCount = 0;

  for (const s of servers) {
    const shouldEnable = prof.allowed === null ? true : prof.allowed.includes(s.name);
    if (setServerState(s, shouldEnable)) changedCount++;
  }

  console.log(`\n✅ Switched to profile: \x1b[1m\x1b[32m${prof.name}\x1b[0m`);
  console.log(`ℹ️  ${prof.description}`);
  console.log(`🔄 Updated ${changedCount} server(s).\n`);
  printStatus();
}

function toggleServer(name) {
  const servers = listServers();
  const match = servers.find(s => s.name.toLowerCase() === name.toLowerCase());
  if (!match) {
    console.error(`❌ Server "${name}" not found. Run "npm run mcp:profile" to list servers.`);
    process.exit(1);
  }

  const currentState = !match.folderDisabled && !match.configDisabled;
  setServerState(match, !currentState);
  console.log(`\n🔄 Toggled ${match.name} -> ${!currentState ? "\x1b[32mENABLED\x1b[0m" : "\x1b[31mDISABLED\x1b[0m"}\n`);
  printStatus();
}

const args = process.argv.slice(2);
const command = args[0]?.toLowerCase();

if (!command || command === "status") {
  printStatus();
} else if (command === "toggle") {
  if (!args[1]) {
    console.error("❌ Please specify server name to toggle: npm run mcp:profile -- toggle <name>");
    process.exit(1);
  }
  toggleServer(args[1]);
} else if (PROFILES[command]) {
  applyProfile(command);
} else {
  console.error(`❌ Unknown command: "${command}". Run "npm run mcp:profile" for usage.`);
  process.exit(1);
}
