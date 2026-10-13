#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const repoRoot = process.cwd();
const startTime = performance.now();
const args = process.argv.slice(2);
const query = args.filter((a) => !a.startsWith("-")).join(" ").trim();
const isJson = args.includes("--json");

if (!query || args.includes("--help") || args.includes("-h")) {
  console.log(`
🔍 SubsMarket Scout - Instant Codebase Reconnaissance (< 300ms)

Usage:
  node scripts/scout.mjs <keyword>
  npm run scout -- <keyword>

Examples:
  npm run scout -- CategoryMenu
  npm run scout -- actions
  npm run scout -- FamilyCard
`);
  process.exit(0);
}

function getRgPath() {
  const localAppData = process.env.LOCALAPPDATA || "";
  const wingetPkg = path.join(localAppData, "Microsoft", "WinGet", "Packages");
  if (fs.existsSync(wingetPkg)) {
    try {
      const dirs = fs.readdirSync(wingetPkg).filter((d) => d.startsWith("BurntSushi.ripgrep"));
      for (const d of dirs) {
        const fullDir = path.join(wingetPkg, d);
        for (const sub of fs.readdirSync(fullDir)) {
          const exe = path.join(fullDir, sub, "rg.exe");
          if (fs.existsSync(exe)) return exe;
        }
      }
    } catch {}
  }
  return "rg";
}

let rgCmd = "rg";
const kebab = query
  .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
  .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
  .toLowerCase();
const variants = [query];
if (kebab !== query.toLowerCase() && kebab.length > 2) variants.push(kebab);

const searchRoots = ["frontend", "backend", "scripts"].filter((d) => fs.existsSync(path.join(repoRoot, d)));
const rgFilterArgs = [
  "-l", "-S", "-e", variants.join("|"), ...searchRoots,
  "-g", "!node_modules", "-g", "!dist", "-g", "!.tmp", "-g", "!.venv",
  "-g", "!*.log", "-g", "!.git", "-g", "!package-lock.json",
  "-g", "!scripts/scout.mjs", "-g", "!scripts/agent-verify.mjs",
];

let rgResult = spawnSync(rgCmd, rgFilterArgs, { cwd: repoRoot, encoding: "utf8" });
if (rgResult.error && rgResult.error.code === "ENOENT") {
  rgCmd = getRgPath();
  rgResult = spawnSync(rgCmd, rgFilterArgs, { cwd: repoRoot, encoding: "utf8" });
}

const matchedFiles = new Set();
if (!rgResult.error && rgResult.stdout) {
  for (const line of rgResult.stdout.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) matchedFiles.add(trimmed.replace(/\\/g, "/"));
  }
}

const testRegex = /(?:^|\/)(?:tests|__tests__)\/|\.(?:spec|test)\.[a-z0-9]+$|^test_|_test\.py$/i;
const styleConfigRegex = /\.(?:css|scss|json|toml|ya?ml)$/i;
const testFiles = [];
const styleConfigFiles = [];
const sourceFiles = [];

for (const file of matchedFiles) {
  if (testRegex.test(file)) testFiles.push(file);
  else if (styleConfigRegex.test(file)) styleConfigFiles.push(file);
  else sourceFiles.push(file);
}

const queryLower = query.toLowerCase();
const kebabLower = variants[1] ? variants[1].toLowerCase() : queryLower;
const entrypoints = [];
const callers = [];

for (const file of sourceFiles) {
  const baseName = path.basename(file, path.extname(file)).toLowerCase();
  const dirName = path.dirname(file).toLowerCase();
  if (
    baseName.includes(queryLower) ||
    (kebabLower && baseName.includes(kebabLower)) ||
    dirName.endsWith("/" + queryLower) ||
    dirName.endsWith("/" + kebabLower)
  ) {
    entrypoints.push(file);
  } else {
    callers.push(file);
  }
}

entrypoints.sort((a, b) => {
  const aBase = path.basename(a, path.extname(a)).toLowerCase();
  const bBase = path.basename(b, path.extname(b)).toLowerCase();
  const aExact = aBase === queryLower ? 4 : aBase.startsWith(queryLower) ? 3 : aBase.includes(queryLower) ? 2 : 1;
  const bExact = bBase === queryLower ? 4 : bBase.startsWith(queryLower) ? 3 : bBase.includes(queryLower) ? 2 : 1;
  if (bExact !== aExact) return bExact - aExact;
  const aScreen = aBase.includes("screen") ? 2 : 0;
  const bScreen = bBase.includes("screen") ? 2 : 0;
  if (bScreen !== aScreen) return bScreen - aScreen;
  return a.localeCompare(b);
});

if (entrypoints.length === 0 && callers.length > 0) {
  let promoted = false;
  for (let i = 0; i < callers.length; i++) {
    const full = path.join(repoRoot, callers[i]);
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, "utf8");
    if (new RegExp(`(?:export\\s+(?:function|class|interface|type|const)\\s+|def\\s+|class\\s+)${query}\\b`, "i").test(content)) {
      entrypoints.push(callers[i]);
      callers.splice(i, 1);
      promoted = true;
      break;
    }
  }
  if (!promoted) entrypoints.push(callers.shift());
}

for (const ep of entrypoints.slice(0, 2)) {
  const full = path.join(repoRoot, ep);
  if (!fs.existsSync(full)) continue;
  const content = fs.readFileSync(full, "utf8");
  const cssMatches = content.match(/import\s+['"]([^'"]+\.css)['"]/g);
  if (cssMatches) {
    for (const m of cssMatches) {
      const match = m.match(/import\s+['"]([^'"]+\.css)['"]/);
      if (match) {
        const resolved = path.normalize(path.join(path.dirname(ep), match[1])).replace(/\\/g, "/");
        if (fs.existsSync(path.join(repoRoot, resolved)) && !styleConfigFiles.includes(resolved)) {
          styleConfigFiles.push(resolved);
        }
      }
    }
  }
}

function extractSymbols(fileList, q) {
  const symbols = [];
  const qLower = q.toLowerCase();
  let ts = null;
  if (fileList.some((f) => f.endsWith(".ts") || f.endsWith(".tsx"))) {
    try {
      const req = createRequire(path.join(repoRoot, "frontend", "package.json"));
      ts = req("typescript");
    } catch {}
  }

  for (const relPath of fileList) {
    const full = path.join(repoRoot, relPath);
    if (!fs.existsSync(full)) continue;
    if (ts && (relPath.endsWith(".ts") || relPath.endsWith(".tsx"))) {
      const content = fs.readFileSync(full, "utf8");
      const sf = ts.createSourceFile(full, content, ts.ScriptTarget.Latest, true, relPath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const isExported = (n) => ts.getModifiers(n)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      const addSym = (name, kind, n) => symbols.push({ name, kind, file: path.basename(relPath), line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
      const visit = (node) => {
        if (ts.isFunctionDeclaration(node) && node.name && isExported(node)) {
          addSym(node.name.text, /^[A-Z]/.test(node.name.text) ? "Component" : "function", node);
        } else if (ts.isInterfaceDeclaration(node) && isExported(node)) {
          addSym(node.name.text, "interface", node);
        } else if (ts.isTypeAliasDeclaration(node) && isExported(node)) {
          addSym(node.name.text, "type", node);
        } else if (ts.isClassDeclaration(node) && node.name && isExported(node)) {
          addSym(node.name.text, "class", node);
        } else if (ts.isVariableStatement(node) && isExported(node)) {
          for (const d of node.declarationList.declarations) {
            if (ts.isIdentifier(d.name)) {
              const isComp = /^[A-Z]/.test(d.name.text) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer));
              addSym(d.name.text, isComp ? "Component" : "const", d);
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    } else if (relPath.endsWith(".py")) {
      const lines = fs.readFileSync(full, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const fn = lines[i].match(/^(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(/);
        if (fn) symbols.push({ name: fn[1], kind: "def", file: path.basename(relPath), line: i + 1 });
        const cls = lines[i].match(/^class\s+([A-Za-z0-9_]+)/);
        if (cls) symbols.push({ name: cls[1], kind: "class", file: path.basename(relPath), line: i + 1 });
      }
    }
  }

  return symbols.sort((a, b) => {
    const aM = a.name.toLowerCase().includes(qLower) ? 1 : 0;
    const bM = b.name.toLowerCase().includes(qLower) ? 1 : 0;
    return bM - aM;
  });
}

const symbols = extractSymbols(entrypoints.slice(0, 2), query);
let recentCommits = [];
const filesForGit = [...entrypoints, ...callers].slice(0, 3);
if (filesForGit.length > 0) {
  const logRes = spawnSync("git", ["log", "-n", "3", "--oneline", "--", ...filesForGit], { cwd: repoRoot, encoding: "utf8" });
  if (!logRes.error && logRes.stdout) {
    recentCommits = logRes.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
  }
}

const elapsed = (performance.now() - startTime).toFixed(0);

if (isJson) {
  console.log(JSON.stringify({ query, durationMs: parseInt(elapsed, 10), entrypoints, symbols, callers, tests: testFiles, styles: styleConfigFiles, commits: recentCommits }, null, 2));
  process.exit(0);
}

function printSection(title, list, max, fmt = (x) => `  • ${x}`) {
  console.log(`${title} (${list.length}):`);
  if (!list.length) return console.log("  (none)");
  for (const item of list.slice(0, max)) console.log(fmt(item));
  if (list.length > max) console.log(`  ... and ${list.length - max} more`);
}

console.log(`🔭 SCOUT: ${query} (${elapsed}ms)`);
console.log("--------------------------------------------------");
printSection("📂 ENTRYPOINTS / MATCHING", entrypoints, 3);
printSection("🔷 EXPORTED SYMBOLS", symbols, 4, (s) => `  • ${s.kind} ${s.name} (${s.file}:${s.line})`);
printSection("👥 CALLERS / IMPORTERS", callers, 3);
printSection("🧪 TESTS", testFiles, 2);
printSection("🎨 STYLES / CONFIGS", styleConfigFiles, 2);
console.log(`📜 RECENT COMMITS:`);
if (!recentCommits.length) console.log("  (none)");
else for (const cm of recentCommits) console.log(`  • ${cm}`);
