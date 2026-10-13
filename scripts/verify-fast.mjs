#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const repoRoot = process.cwd();
const startTime = performance.now();

console.log("⚡ Starting verify:fast...");

// 1. Get modified / untracked files via git status --porcelain
const gitResult = spawnSync("git", ["status", "--porcelain"], {
  cwd: repoRoot,
  encoding: "utf8"
});

if (gitResult.error) {
  console.error("❌ Git status check failed:", gitResult.error.message);
  process.exit(1);
}

const lines = gitResult.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
const changedFiles = [];

for (const line of lines) {
  // Line format: "XY path" or "R  old -> new"
  const rawPath = line.slice(3).trim();
  const filePath = rawPath.includes("->") ? rawPath.split("->")[1].trim() : rawPath;
  const normalized = filePath.replace(/^["']|["']$/g, "").replace(/\//g, path.sep);
  const fullPath = path.resolve(repoRoot, normalized);

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    changedFiles.push(normalized);
  }
}

console.log(`📁 Detected ${changedFiles.length} modified/untracked files.`);

let hasErrors = false;

// 2. File Length & Anti-Monolith Hygiene (Rule 17)
const codeExts = new Set([".ts", ".tsx", ".py", ".css", ".js", ".mjs"]);
const hygieneWarnings = [];

for (const relFile of changedFiles) {
  const ext = path.extname(relFile);
  if (!codeExts.has(ext)) continue;
  if (relFile.endsWith("openapi.ts")) continue; // Explicit exception in Rule 17

  const fullPath = path.join(repoRoot, relFile);
  const content = fs.readFileSync(fullPath, "utf8");
  const lineCount = content.split("\n").length;

  if (lineCount >= 1000) {
    hygieneWarnings.push(`🚨 [MONOLITH VIOLATION] ${relFile}: ${lineCount} lines (>= 1,000 lines strictly forbidden)`);
    hasErrors = true;
  } else if (lineCount > 400) {
    hygieneWarnings.push(`⚠️  [RULE 17 WARN] ${relFile}: ${lineCount} lines (> 400 target threshold)`);
  }
}

if (hygieneWarnings.length > 0) {
  console.log("\n--- File Length Hygiene ---");
  for (const warn of hygieneWarnings) {
    console.log(warn);
  }
}

// 3. Python Linting (ruff check only on modified Python files)
const pyFiles = changedFiles.filter((f) => f.endsWith(".py"));
if (pyFiles.length > 0) {
  console.log(`\n🐍 Linting ${pyFiles.length} modified Python file(s) with ruff...`);
  const ruffArgs = ["scripts/run-python.mjs", "-m", "ruff", "check", ...pyFiles];
  const ruffResult = spawnSync("node", ruffArgs, {
    cwd: repoRoot,
    stdio: "inherit"
  });

  if (ruffResult.status !== 0) {
    hasErrors = true;
    console.error("❌ Ruff check failed.");
  } else {
    console.log("✅ Ruff checks passed.");
  }
} else {
  console.log("🐍 Python: No modified python files to lint.");
}

// 4. TypeScript Type Checking (rapid tsc --noEmit / project check)
const tsFiles = changedFiles.filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
if (tsFiles.length > 0) {
  console.log(`\n🔷 Checking TypeScript types (${tsFiles.length} modified TS/TSX file(s))...`);
  const localTsc = path.join(repoRoot, "frontend", "node_modules", "typescript", "bin", "tsc");
  let tscCmd = "node";
  let tscArgs = [localTsc, "-b", "frontend"];

  if (!fs.existsSync(localTsc)) {
    tscCmd = "npx";
    tscArgs = ["--prefix", "frontend", "tsc", "-b"];
  }

  const tscResult = spawnSync(tscCmd, tscArgs, {
    cwd: repoRoot,
    stdio: "inherit"
  });

  if (tscResult.status !== 0) {
    hasErrors = true;
    console.error("❌ TypeScript type check failed.");
  } else {
    console.log("✅ TypeScript type check passed.");
  }
} else {
  console.log("🔷 TypeScript: No modified TS/TSX files to check.");
}

const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
console.log(`\n⏱️  verify:fast completed in ${elapsed}s`);

if (hasErrors) {
  console.error("❌ verify:fast found errors.");
  process.exit(1);
} else {
  console.log("✨ verify:fast passed cleanly!");
  process.exit(0);
}
