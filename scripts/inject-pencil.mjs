import { spawn } from "node:child_process";

const MCP_BIN = "C:\\Users\\qerfe\\AppData\\Local\\Programs\\Pencil\\resources\\app.asar.unpacked\\out\\mcp-server-windows-x64.exe";
const DOC_PATH = "C:\\Users\\qerfe\\.pencil\\documents\\d1ea2792-13ab-49e4-85e1-2c0eabf9b97d\\pencil-new.pen";

const cp = spawn(MCP_BIN, ["--app", "desktop", "--agent", "antigravity"]);

let out = "";
cp.stdout.on("data", (d) => {
  out += d.toString();
});
cp.stderr.on("data", (d) => {
  console.log("[STDERR]", d.toString().trim());
});

const initMsg = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "antigravity", version: "1.0" }
  }
}) + "\n";
cp.stdin.write(initMsg);

const snippet = `
  Insert(document, {
    type: "frame",
    name: "Spotify Clean Nav",
    x: 60,
    y: 80,
    width: 390,
    height: 844,
    cornerRadius: 16,
    clip: true,
    fill: { type: "image", url: "./spotify_bottom_nav_clean.png", mode: "fill" }
  });

  Insert(document, {
    type: "frame",
    name: "Spotify Mini Player",
    x: 500,
    y: 80,
    width: 390,
    height: 844,
    cornerRadius: 16,
    clip: true,
    fill: { type: "image", url: "./spotify_with_miniplayer.png", mode: "fill" }
  });

  Insert(document, {
    type: "frame",
    name: "Specs Card",
    x: 940,
    y: 80,
    width: 400,
    height: 440,
    cornerRadius: 16,
    fill: "#18191C"
  });

  Insert(document, {
    type: "text",
    name: "Specs Title",
    x: 964,
    y: 110,
    fontFamily: "Inter",
    fontSize: 20,
    fill: "#30D158",
    content: "Spotify iOS 18 Bottom Nav Specs"
  });

  Insert(document, {
    type: "text",
    name: "Specs Details",
    x: 964,
    y: 155,
    fontFamily: "Inter",
    fontSize: 14,
    lineHeight: 1.6,
    fill: "#E5E5EA",
    content: "• 4 Tabs: Home, Search, Your Library, Create\\n• Bar Height: 49px (+ 34px Safe Area)\\n• Background: #000000 with top fade gradient\\n• Active Tab: #FFFFFF bold\\n• Inactive Tab: #B3B3B3 regular\\n• Font Size: 10.5px\\n• Icons: 24x24px (gap to label: 4px)"
  });

  Insert(document, {
    type: "text",
    name: "MiniPlayer Details",
    x: 964,
    y: 310,
    fontFamily: "Inter",
    fontSize: 14,
    lineHeight: 1.6,
    fill: "#64D2FF",
    content: "• Mini-Player: Floating 56px capsule (radius 8px)\\n• Album art: 40x40px (radius 4px)\\n• Track name + Artist (13px / 11px)\\n• Scrubber line: 1.5px white progress bar"
  });
`;

setTimeout(() => {
  const callMsg = JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "execute",
      arguments: {
        filePath: DOC_PATH,
        input: snippet
      }
    }
  }) + "\n";
  cp.stdin.write(callMsg);
}, 1000);

setTimeout(() => {
  console.log("RESULT:", out);
  cp.kill();
  process.exit(0);
}, 4500);
