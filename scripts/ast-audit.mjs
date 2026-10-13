#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

console.log("🔍 Running AST & Anti-Monolith hygiene audit...");

function walkDir(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".venv" || entry.name === "__pycache__") {
        continue;
      }
      results.push(...walkDir(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

const targetDirs = [
  path.join(repoRoot, "frontend", "src"),
  path.join(repoRoot, "backend", "src")
];

const codeExts = new Set([".ts", ".tsx", ".py", ".css", ".js", ".mjs"]);
const allFiles = targetDirs.flatMap(walkDir).filter((file) => codeExts.has(path.extname(file)));

// 1. Line Length Audit (Anti-Monolith & Rule 17)
const over400Files = [];
const monolithFiles = [];

for (const file of allFiles) {
  const relPath = path.relative(repoRoot, file);
  if (relPath.endsWith("openapi.ts")) continue; // Explicit schema exception

  const content = fs.readFileSync(file, "utf8");
  const lineCount = content.split("\n").length;

  if (lineCount >= 1000) {
    monolithFiles.push({ file: relPath, lineCount });
  } else if (lineCount > 400) {
    over400Files.push({ file: relPath, lineCount });
  }
}

over400Files.sort((a, b) => b.lineCount - a.lineCount);
monolithFiles.sort((a, b) => b.lineCount - a.lineCount);

console.log(`\n📊 File Length Audit (Scanned ${allFiles.length} files across frontend/src & backend/src):`);

if (monolithFiles.length > 0) {
  console.log(`\n🚨 MONOLITH VIOLATIONS (>= 1,000 lines - Strictly forbidden per Rule 17): ${monolithFiles.length}`);
  for (const item of monolithFiles) {
    console.log(`  ❌ ${item.lineCount.toString().padStart(4, " ")} lines: ${item.file}`);
  }
} else {
  console.log("  ✅ Zero files >= 1,000 lines (No monolithic violations detected).");
}

if (over400Files.length > 0) {
  console.log(`\n⚠️  Files exceeding 400-line threshold (${over400Files.length} files marked for refactoring/decomposition):`);
  for (const item of over400Files) {
    console.log(`  ⚠️  ${item.lineCount.toString().padStart(4, " ")} lines: ${item.file}`);
  }
} else {
  console.log("  ✅ All files under 400 lines.");
}

// 2. Architectural Invariants in backend/src/subsmarket/families
console.log("\n🛡️  Auditing architectural invariants in backend/src/subsmarket/families...");
const familiesDir = path.join(repoRoot, "backend", "src", "subsmarket", "families");
const familiesFiles = walkDir(familiesDir).filter((f) => f.endsWith(".py"));

const forbiddenIssues = [];

for (const file of familiesFiles) {
  const relPath = path.relative(repoRoot, file);
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    // Rule: Services in families must use db.flush(), not db.commit()
    if (/\bdb\.commit\s*\(/.test(line)) {
      forbiddenIssues.push({
        file: relPath,
        lineNum,
        line: line.trim(),
        rule: "Forbidden direct db.commit() in families service. Use db.flush() instead (AGENTS.md)."
      });
    }
    // Rule: JSON payload filtered through Column.payload['key'].as_string(), not .astext
    if (/\.astext\b/.test(line)) {
      forbiddenIssues.push({
        file: relPath,
        lineNum,
        line: line.trim(),
        rule: "Forbidden .astext on JSON payload. Use .as_string() instead (AGENTS.md)."
      });
    }
  });
}

if (forbiddenIssues.length > 0) {
  console.error(`\n❌ Found ${forbiddenIssues.length} forbidden architectural pattern(s):`);
  for (const issue of forbiddenIssues) {
    console.error(`  - ${issue.file}:${issue.lineNum} -> ${issue.rule}\n    Code: "${issue.line}"`);
  }
} else {
  console.log(`  ✅ Audited ${familiesFiles.length} files in families domain: zero forbidden patterns found.`);
}

console.log("\n------------------------------------------------------------");

if (monolithFiles.length > 0 || forbiddenIssues.length > 0) {
  console.error("❌ AST Audit failed: Found violations that require attention.");
  process.exit(1);
} else {
  console.log("✨ AST & Anti-Monolith hygiene audit passed cleanly!");
  process.exit(0);
}
