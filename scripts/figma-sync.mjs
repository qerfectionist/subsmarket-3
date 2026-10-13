#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const tokensCssPath = path.join(repoRoot, "frontend", "src", "styles", "tokens.css");
const outputJsonPath = path.join(repoRoot, "docs", "figma-tokens.json");

function parseCssTokens(cssContent) {
  const darkMap = new Map();
  const lightMap = new Map();

  // Split into :root and :root.tma-light blocks
  const rootMatch = cssContent.match(/:root\s*\{([\s\S]*?)\}/);
  const lightMatch = cssContent.match(/:root\.tma-light\s*\{([\s\S]*?)\}/);

  function extractVars(blockText, targetMap) {
    if (!blockText) return;
    const lines = blockText.split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*(--app-[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        targetMap.set(key, value);
      }
    }
  }

  if (rootMatch) extractVars(rootMatch[1], darkMap);
  if (lightMatch) extractVars(lightMatch[1], lightMap);

  return { darkMap, lightMap };
}

function classifyToken(key, value) {
  // Determine category and Figma resolvedType
  const cleanKey = key.replace(/^--app-/, "");

  if (cleanKey.startsWith("space-")) {
    return { name: `space/${cleanKey.replace("space-", "")}`, type: "FLOAT" };
  }
  if (cleanKey.startsWith("radius-")) {
    return { name: `radius/${cleanKey.replace("radius-", "")}`, type: "FLOAT" };
  }
  if (cleanKey.startsWith("size-")) {
    return { name: `typography/size/${cleanKey.replace("size-", "")}`, type: "STRING" };
  }
  if (cleanKey.startsWith("weight-")) {
    return { name: `typography/weight/${cleanKey.replace("weight-", "")}`, type: "FLOAT" };
  }
  if (cleanKey.startsWith("leading-")) {
    return { name: `typography/leading/${cleanKey.replace("leading-", "")}`, type: "FLOAT" };
  }
  if (cleanKey.startsWith("duration-")) {
    return { name: `motion/duration/${cleanKey.replace("duration-", "")}`, type: "STRING" };
  }

  // Colors: hex, rgb, or color-specific prefixes
  if (/^#|rgb/i.test(value) || /^(bg|surface|text|muted|accent|info|success|warning|danger|raspberry|category|border|nav|shadow)/.test(cleanKey)) {
    return { name: `color/${cleanKey.replace(/-/g, "/")}`, type: "COLOR" };
  }

  return { name: `misc/${cleanKey.replace(/-/g, "/")}`, type: "STRING" };
}

function normalizeValue(value, type) {
  if (type === "FLOAT") {
    const num = parseFloat(value);
    return isNaN(num) ? value : num;
  }
  return value;
}

function buildFigmaPayload(darkMap, lightMap) {
  const allKeys = Array.from(new Set([...darkMap.keys(), ...lightMap.keys()]));
  const tokens = [];

  for (const key of allKeys) {
    const darkVal = darkMap.get(key);
    const lightVal = lightMap.get(key) || darkVal;
    if (!darkVal) continue;

    const { name, type } = classifyToken(key, darkVal);

    tokens.push({
      name,
      resolvedType: type,
      description: `CSS variable ${key}`,
      values: {
        Dark: normalizeValue(darkVal, type),
        Light: normalizeValue(lightVal, type),
      },
    });
  }

  // Figma limits batch create to 100 tokens per collection call
  return {
    collectionName: "SubsMarket iOS Design Tokens",
    modes: ["Dark", "Light"],
    tokens: tokens.slice(0, 100),
    totalExtracted: tokens.length,
    allTokens: tokens,
  };
}

function main() {
  const args = process.argv.slice(2);
  const isExport = args.includes("--export") || args.length === 0;
  const isPrintMcp = args.includes("--print-mcp");
  const isStats = args.includes("--stats");

  if (!fs.existsSync(tokensCssPath)) {
    console.error(`❌ tokens.css not found at: ${tokensCssPath}`);
    process.exit(1);
  }

  const cssContent = fs.readFileSync(tokensCssPath, "utf8");
  const { darkMap, lightMap } = parseCssTokens(cssContent);
  const payload = buildFigmaPayload(darkMap, lightMap);

  if (isExport) {
    fs.mkdirSync(path.dirname(outputJsonPath), { recursive: true });
    fs.writeFileSync(outputJsonPath, JSON.stringify(payload, null, 2), "utf8");
    console.log(`\n🎨 Figma Design Tokens exported successfully!`);
    console.log(`   Source: frontend/src/styles/tokens.css`);
    console.log(`   Output: docs/figma-tokens.json`);
    console.log(`   Extracted ${payload.totalExtracted} tokens (Dark & Light modes).`);
  }

  if (isStats || isExport) {
    const colors = payload.allTokens.filter((t) => t.resolvedType === "COLOR");
    const floats = payload.allTokens.filter((t) => t.resolvedType === "FLOAT");
    const others = payload.allTokens.filter((t) => t.resolvedType === "STRING");

    console.log(`\n📊 Token Breakdown:`);
    console.log(`   - Colors:     ${colors.length} tokens (Dark/Light pairs)`);
    console.log(`   - Spacing/Num:${floats.length} tokens`);
    console.log(`   - Typography: ${others.length} tokens`);
    console.log(`   - Total:      ${payload.totalExtracted} tokens`);
  }

  if (isPrintMcp) {
    console.log(`\n🚀 Figma MCP Execution Snippet:`);
    console.log(`Call MCP tool: figma_setup_design_tokens`);
    console.log(`Arguments:`);
    console.log(JSON.stringify({
      collectionName: payload.collectionName,
      modes: payload.modes,
      tokens: payload.tokens
    }, null, 2));
  }

  console.log(`\n💡 To sync directly to Figma:`);
  console.log(`   1. Open Figma file with Figma Console Plugin connected.`);
  console.log(`   2. In Antigravity chat, run: "Sync design tokens from docs/figma-tokens.json via figma_setup_design_tokens"`);
  console.log(`   3. All color, typography, and spacing variables will be created automatically in Figma!`);
}

main();
