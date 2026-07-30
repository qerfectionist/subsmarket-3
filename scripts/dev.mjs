#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureLocalInfrastructure } from "./ensure-local-infrastructure.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const venvDir = path.join(repoRoot, "backend", ".venv");
const python =
  process.platform === "win32"
    ? path.join(venvDir, "Scripts", "python.exe")
    : path.join(venvDir, "bin", "python");

if (!existsSync(python)) {
  console.error(`Python venv not found at ${python}`);
  process.exit(1);
}

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const backendDir = path.join(repoRoot, "backend");
const frontendDir = path.join(repoRoot, "frontend");
const backendPort = 8002;
const backendBaseUrl = `http://127.0.0.1:${backendPort}`;
const children = [];
let shuttingDown = false;

function isUp(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      resolve(response.statusCode >= 200 && response.statusCode < 400);
      response.resume();
    });
    request.on("error", () => resolve(false));
    request.setTimeout(1500, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitUntilUp(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isUp(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function preflight() {
  const [backend, frontend] = await Promise.all([
    isUp(`${backendBaseUrl}/ready`),
    isUp("http://127.0.0.1:5173/")
  ]);
  if (backend && frontend) {
    console.log("Dev stack already running:");
    console.log("  frontend  http://127.0.0.1:5173/");
    console.log(`  backend   ${backendBaseUrl}/health`);
  }
  return { backend, frontend };
}

function start(name, command, args, options = {}) {
  const useShell = options.shell ?? process.platform === "win32";
  const child = spawn(command, args, {
    cwd: options.cwd ?? repoRoot,
    stdio: "inherit",
    env: { ...process.env, APP_ENV: "development", ...options.env },
    shell: useShell
  });
  child.on("exit", async (code) => {
    if (!code || shuttingDown) return;
    const stillHealthy =
      name === "backend"
        ? await isUp(`${backendBaseUrl}/health`)
        : await isUp("http://127.0.0.1:5173/");
    if (stillHealthy) {
      console.log(`[${name}] process exited, but service is still reachable — keeping dev session alive.`);
      return;
    }
    console.error(`[${name}] exited with code ${code}`);
    shutdown(code ?? 1);
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function main() {
  await ensureLocalInfrastructure();

  const status = await preflight();
  if (status.backend && status.frontend) {
    process.exit(0);
  }

  if (!status.backend) {
    console.log(`Starting backend on ${backendBaseUrl}`);
    start(
      "backend",
      python,
      [
        "-m",
        "uvicorn",
        "subsmarket.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        String(backendPort),
        "--reload"
      ],
      { cwd: backendDir, shell: false, env: { DEV_AUTH_ENABLED: "true" } }
    );
    console.log("Waiting for backend readiness...");
    await waitUntilUp(`${backendBaseUrl}/ready`);
    console.log("Backend is ready.");
  }

  if (!status.frontend) {
    console.log("Starting frontend on http://127.0.0.1:5173");
    start("frontend", npmCmd, ["run", "dev"], { cwd: frontendDir, shell: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
