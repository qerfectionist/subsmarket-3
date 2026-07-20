#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendDir = path.join(repoRoot, "backend");
const python = path.join(
  backendDir,
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python"
);
const defaultDatabaseUrl =
  "postgresql+psycopg://subsmarket:subsmarket@localhost:5432/subsmarket?connect_timeout=5";
const testDatabaseUrl = process.env.POSTGRES_TEST_DATABASE_URL || defaultDatabaseUrl;
const env = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
  POSTGRES_TEST_DATABASE_URL: testDatabaseUrl
};

if (!existsSync(python)) {
  console.error(`Python venv not found at ${python}`);
  process.exit(1);
}

const migration = spawnSync(python, ["-m", "alembic", "upgrade", "head"], {
  cwd: backendDir,
  stdio: "inherit",
  env
});

if (migration.error) {
  console.error(migration.error.message);
  process.exit(1);
}
if (migration.status !== 0) {
  process.exit(migration.status ?? 1);
}

const result = spawnSync(
  process.execPath,
  [
    path.join("scripts", "run-python.mjs"),
    "-m",
    "pytest",
    "backend/tests/test_postgres_concurrency.py",
    "backend/tests/test_postgres_jobs.py",
    "backend/tests/test_postgres_schema_security.py",
    "-q"
  ],
  {
    cwd: repoRoot,
    stdio: "inherit",
    env
  }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
