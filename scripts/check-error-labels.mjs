#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendRoot = path.join(repoRoot, "backend", "src");
const labelsPath = path.join(repoRoot, "frontend", "src", "labels", "index.ts");

function walkPythonFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return walkPythonFiles(entryPath);
    }
    return entry.isFile() && entry.name.endsWith(".py") ? [entryPath] : [];
  });
}

const backendCodes = new Set();
const detailPattern = /detail\s*=\s*["']([A-Z][A-Z0-9_]+)["']/g;
for (const filePath of walkPythonFiles(backendRoot)) {
  const source = readFileSync(filePath, "utf8");
  for (const match of source.matchAll(detailPattern)) {
    backendCodes.add(match[1]);
  }
}

const labelsSource = readFileSync(labelsPath, "utf8");
const frontendCodes = new Set(
  [...labelsSource.matchAll(/^\s*([A-Z][A-Z0-9_]+):/gm)].map((match) => match[1])
);
const missing = [...backendCodes]
  .filter((code) => !frontendCodes.has(code))
  .sort();

if (missing.length > 0) {
  console.error("Missing user-facing frontend labels for backend error codes:");
  for (const code of missing) {
    console.error(`- ${code}`);
  }
  process.exit(1);
}

console.log(`All ${backendCodes.size} literal backend error codes have labels.`);
