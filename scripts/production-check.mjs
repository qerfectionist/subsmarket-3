#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runPython = path.join(repoRoot, "scripts", "run-python.mjs");

const productionApiUrl =
  process.env.PRODUCTION_API_URL || "https://api.subsmarket.xyz";
const miniAppUrl = process.env.TELEGRAM_MINI_APP_URL || "https://subsmarket.xyz";
const webhookUrl =
  process.env.TELEGRAM_WEBHOOK_URL ||
  "https://api.subsmarket.xyz/api/telegram/webhook";

const checks = [
  {
    name: "API production smoke",
    module: "subsmarket.ops.production_smoke",
    env: {
      PRODUCTION_API_URL: productionApiUrl,
    },
  },
  {
    name: "Read-only load smoke",
    module: "subsmarket.ops.load_smoke",
    env: {
      LOAD_SMOKE_BASE_URL: productionApiUrl,
      LOAD_SMOKE_REQUESTS: process.env.LOAD_SMOKE_REQUESTS || "30",
      LOAD_SMOKE_CONCURRENCY: process.env.LOAD_SMOKE_CONCURRENCY || "5",
      LOAD_SMOKE_WARMUP_REQUESTS: process.env.LOAD_SMOKE_WARMUP_REQUESTS || "3",
      LOAD_SMOKE_MAX_P95_MS: process.env.LOAD_SMOKE_MAX_P95_MS || "5000",
    },
  },
  {
    name: "Telegram production smoke",
    module: "subsmarket.ops.telegram_production_smoke",
    env: {
      TELEGRAM_MINI_APP_URL: miniAppUrl,
      TELEGRAM_WEBHOOK_URL: webhookUrl,
    },
  },
  {
    name: "Background jobs health",
    module: "subsmarket.ops.jobs_health_smoke",
    optionalEnv: ["PRODUCTION_INTERNAL_JOB_TOKEN", "INTERNAL_JOB_TOKEN"],
    env: {
      PRODUCTION_API_URL: productionApiUrl,
    },
  },
  {
    name: "Sentry smoke",
    module: "subsmarket.ops.sentry_smoke",
    env: {},
  },
];

for (const check of checks) {
  console.log(`\n== ${check.name} ==`);
  if (
    check.optionalEnv &&
    !check.optionalEnv.some((name) => Boolean(process.env[name]))
  ) {
    console.log(
      `Skipped: set ${check.optionalEnv.join(" or ")} to run this check.`
    );
    continue;
  }
  const result = spawnSync(
    process.execPath,
    [runPython, "-m", check.module],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        ...check.env,
      },
    }
  );
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`${check.name} failed`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nProduction checks passed.");
