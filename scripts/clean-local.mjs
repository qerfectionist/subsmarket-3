#!/usr/bin/env node

import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoPrefix = `${repoRoot}${path.sep}`;

const generatedPaths = [
  ".tmp",
  ".local-logs",
  ".codex-local",
  ".ruff_cache",
  ".vercel",
  "test-results",
  "frontend/dist",
  "frontend/test-results",
  "frontend/.vercel",
  "backend/.pytest_cache",
  "backend/.ruff_cache"
];

const generatedFiles = [
  "backend-local-8000.log",
  "backend-local-8002.log",
  "frontend-local-5175.log",
  "frontend/vite-dev.log",
  "frontend/tsconfig.app.tsbuildinfo"
];

function safePath(relativePath) {
  const target = path.resolve(repoRoot, relativePath);
  if (!target.startsWith(repoPrefix)) {
    throw new Error(`Refusing to remove outside workspace: ${target}`);
  }
  return target;
}

function remove(relativePath) {
  const target = safePath(relativePath);
  if (!existsSync(target)) return;
  rmSync(target, { force: true, recursive: true });
  console.log(`removed ${relativePath}`);
}

function removePythonCaches(relativeRoot) {
  const root = safePath(relativeRoot);
  if (!existsSync(root) || !statSync(root).isDirectory()) return;

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const relative = path.join(relativeRoot, entry.name);
    if (entry.name === "__pycache__") {
      remove(relative);
      continue;
    }
    if (entry.name === ".venv" || entry.name === "node_modules") continue;
    removePythonCaches(relative);
  }
}

for (const relativePath of [...generatedPaths, ...generatedFiles]) {
  remove(relativePath);
}
for (const relativeRoot of ["backend", "scripts", "tools"]) {
  removePythonCaches(relativeRoot);
}
