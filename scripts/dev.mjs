#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

async function preflight() {
  const [backend, frontend] = await Promise.all([
    isUp("http://127.0.0.1:8000/health"),
    isUp("http://127.0.0.1:5173/")
  ]);
  if (backend && frontend) {
    console.log("Dev stack already running:");
    console.log("  frontend  http://127.0.0.1:5173/");
    console.log("  backend   http://127.0.0.1:8000/health");
    return true;
  }
  return false;
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
        ? await isUp("http://127.0.0.1:8000/health")
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
  if (await preflight()) {
    process.exit(0);
  }

  console.log("Starting backend on http://127.0.0.1:8000");
  start(
    "backend",
    python,
    ["-m", "uvicorn", "subsmarket.main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"],
    { cwd: backendDir, shell: false }
  );

  console.log("Starting frontend on http://127.0.0.1:5173");
  start("frontend", npmCmd, ["run", "dev"], { cwd: frontendDir, shell: true });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});