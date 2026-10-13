#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const frontendPkg = path.join(repoRoot, "frontend", "package.json");
const req = createRequire(frontendPkg);
const ts = req("typescript");

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    query: "",
    file: null,
    kind: null,
    exportedOnly: false,
    json: false,
    limit: 50,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--file" || arg === "-f") {
      options.file = args[++i];
    } else if (arg === "--kind" || arg === "-k") {
      options.kind = args[++i]?.toLowerCase();
    } else if (arg === "--exported" || arg === "-e") {
      options.exportedOnly = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--limit" || arg === "-l") {
      options.limit = parseInt(args[++i], 10) || 50;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith("-") && !options.query) {
      options.query = arg;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
🔍 SubsMarket TS/AST Symbol Search Tool (TypeScript Compiler API)

Usage:
  node scripts/lsp-symbols.mjs [query] [options]

Options:
  --file, -f <path>    Search/inspect symbols only in specified file
  --kind, -k <kind>    Filter by kind: component, function, interface, type, const, class
  --exported, -e       Show only exported symbols
  --limit, -l <num>    Limit output count (default: 50)
  --json               Output results as JSON for programmatic consumption
  --help, -h           Show this help message

Examples:
  node scripts/lsp-symbols.mjs ListingCard
  node scripts/lsp-symbols.mjs --file frontend/src/components/ui.tsx
  node scripts/lsp-symbols.mjs use --kind function
  node scripts/lsp-symbols.mjs Family --kind interface --json
`);
}

function walkDir(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".tmp") continue;
      results.push(...walkDir(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (ext === ".ts" || ext === ".tsx") {
        results.push(fullPath);
      }
    }
  }
  return results;
}

function getNodeKindName(node) {
  if (ts.isFunctionDeclaration(node)) return "function";
  if (ts.isInterfaceDeclaration(node)) return "interface";
  if (ts.isTypeAliasDeclaration(node)) return "type";
  if (ts.isClassDeclaration(node)) return "class";
  if (ts.isEnumDeclaration(node)) return "enum";
  if (ts.isVariableDeclaration(node)) {
    // Check if it's a React component: starts with uppercase and is an arrow func or func expression
    const name = node.name.getText();
    if (/^[A-Z]/.test(name) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      return "component";
    }
    return "const";
  }
  return "unknown";
}

function extractDoc(node, sourceFile) {
  const fullText = sourceFile.getFullText();
  const ranges = ts.getLeadingCommentRanges(fullText, node.getFullStart());
  if (!ranges || ranges.length === 0) return "";
  const lastRange = ranges[ranges.length - 1];
  const commentText = fullText.substring(lastRange.pos, lastRange.end).trim();
  if (commentText.startsWith("/**")) {
    return commentText
      .replace(/^\/\*\*|\*\/$/g, "")
      .split("\n")
      .map((l) => l.replace(/^\s*\*\s?/, "").trim())
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function extractSymbolsFromFile(filePath, sourceFile) {
  const symbols = [];
  const relPath = path.relative(repoRoot, filePath).replace(/\\/g, "/");

  function isExported(node) {
    const modifiers = ts.getModifiers(node);
    if (!modifiers) return false;
    return modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  }

  function isDefaultExport(node) {
    const modifiers = ts.getModifiers(node);
    if (!modifiers) return false;
    return modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
  }

  function addSymbol(name, kind, node, exported, isDefault) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const doc = extractDoc(node, sourceFile);

    let signature = "";
    if (ts.isFunctionDeclaration(node)) {
      const params = node.parameters.map((p) => p.getText(sourceFile)).join(", ");
      const ret = node.type ? `: ${node.type.getText(sourceFile)}` : "";
      signature = `function ${name}(${params})${ret}`;
    } else if (ts.isInterfaceDeclaration(node)) {
      signature = `interface ${name}`;
    } else if (ts.isTypeAliasDeclaration(node)) {
      signature = `type ${name} = ${node.type.getText(sourceFile).slice(0, 60)}`;
    } else if (ts.isVariableDeclaration(node)) {
      if (kind === "component") {
        const init = node.initializer;
        const params = init.parameters ? init.parameters.map((p) => p.getText(sourceFile)).join(", ") : "";
        signature = `Component ${name}(${params})`;
      } else {
        const typeStr = node.type ? `: ${node.type.getText(sourceFile)}` : "";
        signature = `const ${name}${typeStr}`;
      }
    }

    symbols.push({
      name,
      kind,
      exported: isDefault ? "default" : exported ? "yes" : "no",
      file: relPath,
      line: line + 1,
      column: character + 1,
      signature,
      doc,
    });
  }

  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.text;
      const exported = isExported(node);
      const isDefault = isDefaultExport(node);
      const kind = /^[A-Z]/.test(name) ? "component" : "function";
      addSymbol(name, kind, node, exported, isDefault);
    } else if (ts.isInterfaceDeclaration(node)) {
      addSymbol(node.name.text, "interface", node, isExported(node), false);
    } else if (ts.isTypeAliasDeclaration(node)) {
      addSymbol(node.name.text, "type", node, isExported(node), false);
    } else if (ts.isClassDeclaration(node) && node.name) {
      addSymbol(node.name.text, "class", node, isExported(node), isDefaultExport(node));
    } else if (ts.isEnumDeclaration(node)) {
      addSymbol(node.name.text, "enum", node, isExported(node), false);
    } else if (ts.isVariableStatement(node)) {
      const exported = isExported(node);
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const name = decl.name.text;
          const kind = getNodeKindName(decl);
          addSymbol(name, kind, decl, exported, false);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return symbols;
}

function run() {
  const options = parseArgs();
  const startTime = Date.now();

  let filesToScan = [];
  if (options.file) {
    const full = path.isAbsolute(options.file) ? options.file : path.join(repoRoot, options.file);
    if (!fs.existsSync(full)) {
      console.error(`❌ File not found: ${options.file}`);
      process.exit(1);
    }
    filesToScan = [full];
  } else {
    const srcDir = path.join(repoRoot, "frontend", "src");
    filesToScan = walkDir(srcDir);
  }

  const allSymbols = [];
  const queryLower = options.query.toLowerCase();

  for (const filePath of filesToScan) {
    const content = fs.readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const symbols = extractSymbolsFromFile(filePath, sourceFile);

    for (const sym of symbols) {
      if (options.query && !sym.name.toLowerCase().includes(queryLower)) {
        continue;
      }
      if (options.kind && sym.kind !== options.kind) {
        continue;
      }
      if (options.exportedOnly && sym.exported === "no") {
        continue;
      }
      allSymbols.push(sym);
    }
  }

  const durationMs = Date.now() - startTime;
  const results = allSymbols.slice(0, options.limit);

  if (options.json) {
    console.log(JSON.stringify({ query: options.query, total: allSymbols.length, scannedFiles: filesToScan.length, durationMs, results }, null, 2));
    return;
  }

  console.log(`\n🔎 Found ${allSymbols.length} symbol(s) across ${filesToScan.length} file(s) in ${durationMs}ms`);
  if (options.query) console.log(`   Filter query: "${options.query}"`);
  if (options.kind) console.log(`   Filter kind: "${options.kind}"`);
  console.log("--------------------------------------------------------------------------------");

  if (results.length === 0) {
    console.log("  (No matching symbols found)");
    return;
  }

  for (const sym of results) {
    const expBadge = sym.exported === "default" ? "[export default]" : sym.exported === "yes" ? "[export]" : "[internal]";
    const kindBadge = `[${sym.kind.toUpperCase()}]`.padEnd(13, " ");
    console.log(`${kindBadge} \x1b[36m${sym.name}\x1b[0m ${expBadge}`);
    console.log(`  📍 ${sym.file}:${sym.line}:${sym.column}`);
    if (sym.signature) console.log(`  📝 ${sym.signature}`);
    if (sym.doc) console.log(`  💡 ${sym.doc}`);
    console.log("");
  }

  if (allSymbols.length > options.limit) {
    console.log(`⚠️  Showing top ${options.limit} of ${allSymbols.length} symbols. Use --limit <n> to see more.`);
  }
}

run();
