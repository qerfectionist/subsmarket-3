#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const venvDir = path.join(repoRoot, "backend", ".venv");
const python =
  process.platform === "win32"
    ? path.join(venvDir, "Scripts", "python.exe")
    : path.join(venvDir, "bin", "python");

if (!existsSync(python)) {
  console.error(
    `Python venv not found at ${python}. Create it with:\n` +
      `  python -m venv backend/.venv\n` +
      `  ${python} -m pip install -e "backend/[dev]"`
  );
  process.exit(1);
}

const result = spawnSync(python, process.argv.slice(2), {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);