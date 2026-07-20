import { defineConfig } from "@playwright/test";
import { platform } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(frontendDir, "..");
const isWin = platform() === "win32";
const python = isWin
  ? path.join(repoRoot, "backend", ".venv", "Scripts", "python.exe")
  : path.join(repoRoot, "backend", ".venv", "bin", "python");
const tmpDir = path.join(repoRoot, ".tmp");
const e2eDb = path.join(tmpDir, "playwright-e2e.db");

const backendEnv = {
  APP_ENV: "development",
  DEV_AUTH_ENABLED: "true",
  DATABASE_URL: `sqlite:///${isWin ? e2eDb.replace(/\\/g, "/") : e2eDb}`,
  DEMO_ACTIVATE_CATALOG: "true",
  PAYMENT_REQUISITE_SECRET: "playwright-payment-requisite-secret"
};

const backendCommand = isWin
  ? `powershell -NoProfile -ExecutionPolicy Bypass -Command "New-Item -ItemType Directory -Force '${tmpDir}' | Out-Null; Remove-Item '${e2eDb}' -ErrorAction SilentlyContinue; & '${python}' -m subsmarket.dev.init_e2e_db; & '${python}' -m uvicorn subsmarket.main:app --host 127.0.0.1 --port 8001"`
  : `mkdir -p '${tmpDir}' && rm -f '${e2eDb}' && '${python}' -m subsmarket.dev.init_e2e_db && '${python}' -m uvicorn subsmarket.main:app --host 127.0.0.1 --port 8001`;

export default defineConfig({
  fullyParallel: false,
  testDir: "./tests",
  webServer: [
    {
      command: backendCommand,
      cwd: path.join(repoRoot, "backend"),
      env: backendEnv,
      reuseExistingServer: true,
      timeout: 30_000,
      url: "http://127.0.0.1:8001/ready"
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5174",
      env: {
        VITE_API_BASE_URL: "http://127.0.0.1:8001",
        VITE_SHOW_DEV_USER_SWITCH: "true"
      },
      reuseExistingServer: true,
      timeout: 30_000,
      url: "http://127.0.0.1:5174/"
    }
  ],
  workers: 1
});
