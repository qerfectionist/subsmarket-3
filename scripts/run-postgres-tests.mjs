#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultDatabaseUrl =
  "postgresql+psycopg://subsmarket:subsmarket@localhost:5432/subsmarket";
const env = {
  ...process.env,
  POSTGRES_TEST_DATABASE_URL:
    process.env.POSTGRES_TEST_DATABASE_URL || defaultDatabaseUrl
};

const result = spawnSync(
  process.execPath,
  [
    path.join("scripts", "run-python.mjs"),
    "-m",
    "pytest",
    "backend/tests/test_postgres_concurrency.py",
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
