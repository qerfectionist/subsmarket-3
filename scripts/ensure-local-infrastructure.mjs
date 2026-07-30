#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendDir = path.join(repoRoot, "backend");
const dockerCommand = process.platform === "win32" ? "docker.exe" : "docker";
const python =
  process.platform === "win32"
    ? path.join(backendDir, ".venv", "Scripts", "python.exe")
    : path.join(backendDir, ".venv", "bin", "python");

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const envPath = path.join(repoRoot, ".env");
  if (!existsSync(envPath)) return "";

  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith("DATABASE_URL="));
  return line?.slice("DATABASE_URL=".length).trim().replace(/^['"]|['"]$/g, "") ?? "";
}

function usesLocalPostgres(databaseUrl) {
  return /@(localhost|127\.0\.0\.1|\[::1\]):5432(?:\/|$)/i.test(databaseUrl);
}

function dockerIsReady() {
  const result = spawnSync(dockerCommand, ["info", "--format", "{{.ServerVersion}}"], {
    cwd: repoRoot,
    stdio: "ignore",
    windowsHide: true
  });
  return result.status === 0;
}

function startDockerDesktop() {
  if (process.platform !== "win32") return false;

  const candidates = [
    process.env.DOCKER_DESKTOP_PATH,
    "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"
  ].filter(Boolean);
  const executable = candidates.find((candidate) => existsSync(candidate));
  if (!executable) return false;

  const child = spawn(executable, [], {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
  return true;
}

async function waitFor(description, predicate, timeoutMs, intervalMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(intervalMs);
  }
  throw new Error(`${description} did not become ready within ${timeoutMs / 1000} seconds`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: process.env,
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: options.capture ? "utf8" : undefined,
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with code ${result.status}`);
  }
  return options.capture ? result.stdout.trim() : "";
}

function postgresIsHealthy(containerId) {
  const result = spawnSync(
    dockerCommand,
    ["inspect", "--format", "{{.State.Health.Status}}", containerId],
    { cwd: repoRoot, encoding: "utf8", windowsHide: true }
  );
  return result.status === 0 && result.stdout.trim() === "healthy";
}

export async function ensureLocalInfrastructure() {
  const databaseUrl = readDatabaseUrl();
  if (!usesLocalPostgres(databaseUrl)) {
    console.log("DATABASE_URL is not local PostgreSQL; Docker bootstrap skipped.");
    return;
  }

  if (!existsSync(python)) {
    throw new Error(`Python venv not found at ${python}`);
  }

  if (!dockerIsReady()) {
    console.log("Docker engine is not running. Starting Docker Desktop...");
    if (!startDockerDesktop()) {
      throw new Error("Start Docker and retry: Docker Desktop could not be started automatically");
    }
    await waitFor("Docker engine", dockerIsReady, 120_000, 3000);
  }

  console.log("Ensuring local PostgreSQL is running...");
  run(dockerCommand, ["compose", "up", "-d", "postgres"]);
  const containerId = run(
    dockerCommand,
    ["compose", "ps", "-q", "postgres"],
    { capture: true }
  );
  if (!containerId) throw new Error("Docker Compose did not return a PostgreSQL container");

  await waitFor("PostgreSQL", () => postgresIsHealthy(containerId), 60_000);

  console.log("Applying local database migrations...");
  run(python, ["-m", "alembic", "-c", "alembic.ini", "upgrade", "head"], {
    cwd: backendDir
  });
  console.log("Local PostgreSQL is ready.");
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  ensureLocalInfrastructure().catch((error) => {
    console.error(`Local infrastructure startup failed: ${error.message}`);
    process.exit(1);
  });
}
