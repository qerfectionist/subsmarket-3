#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const repoRoot = process.cwd();
const startTime = performance.now();

// 1. Collect modified/staged/untracked files
const gitResult = spawnSync("git", ["status", "--porcelain"], {
  cwd: repoRoot,
  encoding: "utf8",
});

if (gitResult.error) {
  console.error(`❌ FAILED: git:0 - Git status check failed: ${gitResult.error.message}`);
  process.exit(1);
}

const lines = gitResult.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
const changedFiles = [];

for (const line of lines) {
  const rawPath = line.slice(3).trim();
  const filePath = rawPath.includes("->") ? rawPath.split("->")[1].trim() : rawPath;
  const normalized = filePath.replace(/^["']|["']$/g, "").replace(/\//g, "/");
  const fullPath = path.resolve(repoRoot, normalized);

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    changedFiles.push(normalized);
  }
}

const errors = [];
const codeExts = new Set([".ts", ".tsx", ".py", ".css", ".js", ".mjs"]);

// 2. Anti-Monolith Hygiene (Rule 17)
for (const relFile of changedFiles) {
  const ext = path.extname(relFile);
  if (!codeExts.has(ext) || relFile.endsWith("openapi.ts")) continue;

  const fullPath = path.join(repoRoot, relFile);
  const content = fs.readFileSync(fullPath, "utf8");
  const lineCount = content.split("\n").length;

  if (lineCount >= 1000) {
    errors.push({
      file: relFile,
      line: 1,
      message: `File exceeds 1000 lines (${lineCount} lines) [Rule 17 monolith violation]`,
    });
  }
}

// 3. Python Linting (Ruff on modified Python files)
const pyFiles = changedFiles.filter((f) => f.endsWith(".py"));
if (pyFiles.length > 0) {
  const ruffResult = spawnSync(
    "node",
    ["scripts/run-python.mjs", "-m", "ruff", "check", ...pyFiles],
    { cwd: repoRoot, encoding: "utf8" }
  );

  if (ruffResult.status !== 0) {
    const output = (ruffResult.stdout || "") + "\n" + (ruffResult.stderr || "");
    const ruffLines = output.split("\n").map((l) => l.trim()).filter(Boolean);
    let matched = false;
    for (const rLine of ruffLines) {
      const match = rLine.match(/^([^:\n]+):(\d+):(?:\d+:)?\s*(.+)$/);
      if (match) {
        matched = true;
        errors.push({
          file: match[1].replace(/\\/g, "/"),
          line: match[2],
          message: match[3],
        });
      }
    }
    if (!matched) {
      errors.push({
        file: pyFiles[0],
        line: 1,
        message: (output.trim().split("\n")[0] || "Ruff check failed").slice(0, 150),
      });
    }
  }
}

// 4. TypeScript Type Checking (tsc on frontend if TS files changed)
const tsFiles = changedFiles.filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
if (tsFiles.length > 0) {
  const localTsc = path.join(repoRoot, "frontend", "node_modules", "typescript", "bin", "tsc");
  let tscCmd = "node";
  let tscArgs = [localTsc, "-b", "frontend"];

  if (!fs.existsSync(localTsc)) {
    tscCmd = "npx";
    tscArgs = ["--prefix", "frontend", "tsc", "-b"];
  }

  const tscResult = spawnSync(tscCmd, tscArgs, {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (tscResult.status !== 0) {
    const output = (tscResult.stdout || "") + "\n" + (tscResult.stderr || "");
    const tscLines = output.split("\n").map((l) => l.trim()).filter(Boolean);
    let matched = false;
    for (const tLine of tscLines) {
      const m1 = tLine.match(/^([^(:\n]+)\((\d+),\d+\):\s*(?:error\s+TS\d+:\s*)?(.+)$/);
      const m2 = tLine.match(/^([^:\n]+):(\d+):\d+\s*-\s*(?:error\s+TS\d+:\s*)?(.+)$/);
      const m = m1 || m2;
      if (m) {
        matched = true;
        errors.push({
          file: m[1].replace(/\\/g, "/"),
          line: m[2],
          message: m[3],
        });
      }
    }
    if (!matched) {
      errors.push({
        file: tsFiles[0],
        line: 1,
        message: (output.trim().split("\n")[0] || "TypeScript type check failed").slice(0, 150),
      });
    }
  }
}

// 5. Output Results (concise, compressed, max 5 errors)
const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
const totalFiles = changedFiles.length;

// Deduplicate errors
const uniqueErrors = [];
const seen = new Set();
for (const err of errors) {
  const key = `${err.file}:${err.line}:${err.message}`;
  if (!seen.has(key)) {
    seen.add(key);
    uniqueErrors.push(err);
  }
}

if (uniqueErrors.length === 0) {
  console.log(`✅ VERIFY OK (0 errors, ${totalFiles} files checked in ${elapsed}s)`);
  process.exit(0);
} else {
  for (const err of uniqueErrors.slice(0, 5)) {
    console.log(`❌ FAILED: ${err.file}:${err.line} - ${err.message}`);
  }
  if (uniqueErrors.length > 5) {
    console.log(`... and ${uniqueErrors.length - 5} more error(s) truncated.`);
  }
  process.exit(1);
}
