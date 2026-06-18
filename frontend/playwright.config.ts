import { defineConfig } from "@playwright/test";

export default defineConfig({
  fullyParallel: false,
  testDir: "./tests",
  webServer: [
    {
      command:
        "powershell -NoProfile -ExecutionPolicy Bypass -Command \"New-Item -ItemType Directory -Force ..\\.tmp | Out-Null; Remove-Item ..\\.tmp\\playwright-e2e.db -ErrorAction SilentlyContinue; .\\.venv\\Scripts\\python.exe -m subsmarket.dev.init_e2e_db; .\\.venv\\Scripts\\python.exe -m uvicorn subsmarket.main:app --host 127.0.0.1 --port 8001\"",
      cwd: "../backend",
      env: {
        APP_ENV: "development",
        DATABASE_URL: "sqlite:///../.tmp/playwright-e2e.db",
        DEMO_ACTIVATE_CATALOG: "true",
        PAYMENT_REQUISITE_SECRET: "playwright-payment-requisite-secret"
      },
      reuseExistingServer: false,
      timeout: 30_000,
      url: "http://127.0.0.1:8001/ready"
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5174",
      env: {
        VITE_API_BASE_URL: "http://127.0.0.1:8001"
      },
      reuseExistingServer: false,
      timeout: 30_000,
      url: "http://127.0.0.1:5174/"
    }
  ],
  workers: 1
});
