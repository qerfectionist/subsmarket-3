#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendDir = path.join(repoRoot, "backend");
const backupDir = path.join(repoRoot, "backups");
const python = path.join(
  backendDir,
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const postgresImage = process.env.RESTORE_POSTGRES_IMAGE || "postgres:17-alpine";
const sourceRaw = process.env.RESTORE_SOURCE_DATABASE_URL;
const configuredAdminRaw = process.env.RESTORE_TARGET_ADMIN_URL;

if (!sourceRaw) {
  console.error("RESTORE_SOURCE_DATABASE_URL is required");
  process.exit(1);
}
if (!existsSync(python)) {
  console.error(`Python venv not found at ${python}`);
  process.exit(1);
}

function postgresUrl(raw) {
  return new URL(
    raw
      .replace("postgresql+psycopg://", "postgresql://")
      .replace("postgres://", "postgresql://"),
  );
}

function dockerHost(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname)
    ? "host.docker.internal"
    : hostname;
}

function run(command, args, { password, capture = false, allowFailure = false } = {}) {
  const dockerArgs = ["run", "--rm", "--add-host", "host.docker.internal:host-gateway"];
  if (password !== undefined) dockerArgs.push("--env", "PGPASSWORD");
  dockerArgs.push(...command, ...args);
  const result = spawnSync("docker", dockerArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: { ...process.env, PGPASSWORD: password },
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    if (capture && result.stderr) process.stderr.write(result.stderr);
    throw new Error(`docker command failed with status ${result.status}`);
  }
  return result;
}

function docker(args, { env = {}, capture = false, allowFailure = false } = {}) {
  const result = spawnSync("docker", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: { ...process.env, ...env },
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    if (capture && result.stderr) process.stderr.write(result.stderr);
    throw new Error(`docker command failed with status ${result.status}`);
  }
  return result;
}

function startDisposablePostgres() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const name = `subsmarket-restore-${suffix}`;
  const password = randomUUID();
  docker(
    [
      "run",
      "--detach",
      "--name",
      name,
      "--publish",
      "127.0.0.1::5432",
      "--env",
      "POSTGRES_PASSWORD",
      "--env",
      "POSTGRES_USER=restore",
      "--env",
      "POSTGRES_DB=postgres",
      postgresImage,
    ],
    { env: { POSTGRES_PASSWORD: password }, capture: true },
  );

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const ready = docker(
      ["exec", name, "pg_isready", "--username", "restore", "--dbname", "postgres"],
      { capture: true, allowFailure: true },
    );
    if (ready.status === 0) {
      const portResult = docker(
        ["port", name, "5432/tcp"],
        { capture: true },
      );
      const match = portResult.stdout.trim().match(/:(\d+)$/);
      if (!match) throw new Error("could not determine disposable PostgreSQL port");
      return {
        name,
        adminUrl: `postgresql://restore:${encodeURIComponent(password)}@localhost:${match[1]}/postgres`,
      };
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  docker(["rm", "--force", name], { allowFailure: true });
  throw new Error("disposable PostgreSQL did not become ready");
}

function postgresCommand(url, executable, extraArgs = [], options = {}) {
  return run(
    [postgresImage, executable],
    [
      "--host",
      dockerHost(url.hostname),
      "--port",
      url.port || "5432",
      "--username",
      decodeURIComponent(url.username),
      ...extraArgs,
    ],
    { ...options, password: decodeURIComponent(url.password) },
  );
}

function ensureSupabaseClientRoles(adminUrl, databaseName) {
  const sql = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;
`;
  postgresCommand(adminUrl, "psql", [
    "--dbname",
    databaseName,
    "--set",
    "ON_ERROR_STOP=1",
    "--command",
    sql,
  ]);
}

mkdirSync(backupDir, { recursive: true });
const startedAt = new Date();
const timestamp = startedAt.toISOString().replaceAll(/[:.]/g, "-");
const targetDatabase = `subsmarket_restore_${Date.now()}`;
const backupName = `restore-source-${timestamp}.dump`;
const backupPath = path.join(backupDir, backupName);
const reportPath = path.join(backupDir, `restore-drill-${timestamp}.json`);
const source = postgresUrl(sourceRaw);
const managedPostgres = configuredAdminRaw ? null : startDisposablePostgres();
const admin = postgresUrl(configuredAdminRaw || managedPostgres.adminUrl);
const target = new URL(admin);
target.pathname = `/${targetDatabase}`;

if (source.hostname === admin.hostname && source.pathname === `/${targetDatabase}`) {
  throw new Error("restore target must not be the source database");
}

let smokeResult;
let completed = false;
try {
  console.log("Creating a logical backup of the public schema...");
  run(
    ["--volume", `${backupDir}:/backups`, postgresImage, "pg_dump"],
    [
      "--host",
      dockerHost(source.hostname),
      "--port",
      source.port || "5432",
      "--username",
      decodeURIComponent(source.username),
      "--dbname",
      source.pathname.slice(1),
      "--schema",
      "public",
      "--format",
      "custom",
      "--no-owner",
      "--no-privileges",
      "--file",
      `/backups/${backupName}`,
    ],
    { password: decodeURIComponent(source.password) },
  );

  console.log(`Creating disposable database ${targetDatabase}...`);
  postgresCommand(admin, "dropdb", ["--if-exists", "--force", targetDatabase]);
  postgresCommand(admin, "createdb", [targetDatabase]);
  ensureSupabaseClientRoles(admin, targetDatabase);
  run(
    ["--volume", `${backupDir}:/backups`, postgresImage, "pg_restore"],
    [
      "--host",
      dockerHost(admin.hostname),
      "--port",
      admin.port || "5432",
      "--username",
      decodeURIComponent(admin.username),
      "--dbname",
      targetDatabase,
      "--exit-on-error",
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      `/backups/${backupName}`,
    ],
    { password: decodeURIComponent(admin.password) },
  );

  const smoke = spawnSync(
    python,
    ["-m", "subsmarket.ops.restore_database_smoke"],
    {
      cwd: backendDir,
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: target.toString(),
        PAYMENT_REQUISITE_SECRET:
          process.env.RESTORE_PAYMENT_REQUISITE_SECRET ||
          process.env.PAYMENT_REQUISITE_SECRET,
        PAYMENT_REQUISITE_PREVIOUS_SECRETS:
          process.env.RESTORE_PAYMENT_REQUISITE_PREVIOUS_SECRETS ||
          process.env.PAYMENT_REQUISITE_PREVIOUS_SECRETS ||
          "",
      },
    },
  );
  if (smoke.error) throw smoke.error;
  if (smoke.stderr) process.stderr.write(smoke.stderr);
  if (smoke.status !== 0) throw new Error(`restore smoke failed: ${smoke.stdout}`);
  smokeResult = JSON.parse(smoke.stdout);
  completed = true;
} finally {
  const finishedAt = new Date();
  const report = {
    ok: completed,
    drill_type: process.env.RESTORE_DRILL_TYPE || "unspecified",
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    rto_seconds: Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000),
    source_database: source.pathname.slice(1),
    restored_database: targetDatabase,
    smoke: smokeResult ?? null,
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Restore drill report: ${reportPath}`);

  if (process.env.RESTORE_KEEP_DATABASE !== "true") {
    postgresCommand(admin, "dropdb", ["--if-exists", "--force", targetDatabase], {
      allowFailure: true,
    });
  }
  if (process.env.RESTORE_KEEP_BACKUP !== "true" && existsSync(backupPath)) {
    rmSync(backupPath, { force: true });
  }
  if (managedPostgres) {
    docker(["rm", "--force", managedPostgres.name], { allowFailure: true });
  }
}

if (!completed) process.exit(1);
console.log(JSON.stringify(smokeResult, null, 2));
