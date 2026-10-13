import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const PORT = 11455;
const repoRoot = process.cwd();
const boardPath = path.join(repoRoot, "scripts", "design-canvas", "board.json");

function loadBoard() {
  try {
    if (fs.existsSync(boardPath)) {
      return JSON.parse(fs.readFileSync(boardPath, "utf8"));
    }
  } catch (e) {
    console.error("Error reading board.json:", e);
  }
  return { title: "Design Canvas", nodes: [] };
}

function saveBoard(data) {
  fs.writeFileSync(boardPath, JSON.stringify(data, null, 2), "utf8");
}

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SubsMarket Design Canvas</title>
  <style>
    :root {
      --bg: #141517;
      --dot: rgba(255, 255, 255, 0.08);
      --surface: #1E1F23;
      --border: rgba(255, 255, 255, 0.1);
      --accent: #0A84FF;
      --text: #F5F5F7;
      --muted: #8E8E93;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    body, html { width: 100%; height: 100%; overflow: hidden; background: var(--bg); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: var(--text); }

    /* Toolbar */
    .top-bar {
      position: fixed;
      top: 14px;
      left: 14px;
      right: 14px;
      height: 48px;
      background: rgba(30, 31, 35, 0.85);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      z-index: 1000;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 14px; }
    .brand-badge { background: #30D158; color: #000; padding: 2px 7px; border-radius: 6px; font-size: 11px; font-weight: 800; }
    .controls { display: flex; align-items: center; gap: 8px; }
    .btn { background: rgba(255, 255, 255, 0.06); border: 1px solid var(--border); color: var(--text); padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
    .btn:hover { background: rgba(255, 255, 255, 0.12); }
    .zoom-val { font-size: 12px; font-weight: 600; color: var(--muted); min-width: 44px; text-align: center; }

    /* Canvas Viewport */
    #viewport {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      cursor: grab;
      background-color: var(--bg);
      background-image: radial-gradient(var(--dot) 1.2px, transparent 1.2px);
      background-size: 24px 24px;
    }
    #viewport.is-dragging { cursor: grabbing; }

    #world {
      position: absolute;
      transform-origin: 0 0;
      will-change: transform;
    }

    /* Canvas Nodes */
    .canvas-node {
      position: absolute;
      border-radius: 16px;
      background: var(--surface);
      border: 1px solid var(--border);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
      transition: box-shadow 0.2s, border-color 0.2s;
      cursor: move;
    }
    .canvas-node:hover {
      border-color: rgba(255, 255, 255, 0.25);
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.6);
    }
    .canvas-node.is-selected {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px var(--accent), 0 20px 48px rgba(0, 0, 0, 0.6);
    }

    .node-header {
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(255, 255, 255, 0.02);
      border-radius: 16px 16px 0 0;
    }
    .node-title { font-size: 13px; font-weight: 700; color: #FFFFFF; }
    .node-sub { font-size: 11px; color: var(--muted); margin-top: 2px; }
    .node-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; text-transform: uppercase; }

    /* Screenshot Card */
    .screenshot-body {
      padding: 12px;
      background: #000;
      border-radius: 0 0 16px 16px;
      overflow: hidden;
      display: flex;
      justify-content: center;
    }
    .screenshot-img {
      max-width: 100%;
      height: auto;
      border-radius: 12px;
      display: block;
      pointer-events: none;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.8);
    }

    /* Spec Card */
    .spec-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .spec-row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px; }
    .spec-label { color: var(--muted); }
    .spec-val { color: #FFF; font-weight: 600; font-family: ui-monospace, monospace; }
    .spec-code { background: #0F1012; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px; font-family: ui-monospace, monospace; font-size: 11px; color: #30D158; white-space: pre-wrap; line-height: 1.4; user-select: text; }

    /* Note Card */
    .note-card {
      background: #23221B;
      border: 1px solid rgba(255, 214, 10, 0.3);
      padding: 16px;
      border-radius: 16px;
    }
    .note-title { font-size: 14px; font-weight: 700; color: #FFD60A; margin-bottom: 10px; }
    .note-text { font-size: 12px; line-height: 1.6; color: #E5E5EA; white-space: pre-line; user-select: text; }

    /* Instructions Overlay */
    .hint-bar {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(30, 31, 35, 0.85);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 8px 16px;
      font-size: 12px;
      color: var(--muted);
      z-index: 1000;
      display: flex;
      gap: 16px;
    }
    .hint-bar b { color: var(--text); }
  </style>
</head>
<body>
  <div class="top-bar">
    <div class="brand">
      <span>🎨</span>
      <span>SubsMarket Design Canvas</span>
      <span class="brand-badge">FIGMA-MODE</span>
    </div>
    <div class="controls">
      <button class="btn" id="btn-zoom-out">−</button>
      <span class="zoom-val" id="zoom-text">100%</span>
      <button class="btn" id="btn-zoom-in">+</button>
      <button class="btn" id="btn-fit">Fit Screen</button>
      <button class="btn" id="btn-reset">Reset (100%)</button>
    </div>
  </div>

  <div id="viewport">
    <div id="world"></div>
  </div>

  <div class="hint-bar">
    <span>🖱️ <b>Колесико:</b> Зум</span>
    <span>✋ <b>Зажать фон:</b> Перемещение по холсту</span>
    <span>🖐️ <b>Карточки:</b> Можно перетаскивать</span>
  </div>

  <script>
    let scale = 0.85;
    let panX = 40;
    let panY = 60;
    let isPanning = false;
    let startX = 0, startY = 0;
    let draggedNode = null;
    let dragNodeStartX = 0, dragNodeStartY = 0;
    let mouseStartWorldX = 0, mouseStartWorldY = 0;
    let lastBoardJson = "";

    const viewport = document.getElementById("viewport");
    const world = document.getElementById("world");
    const zoomText = document.getElementById("zoom-text");

    function updateTransform() {
      world.style.transform = \`translate(\${panX}px, \${panY}px) scale(\${scale})\`;
      zoomText.textContent = Math.round(scale * 100) + "%";
    }

    // Zooming via Wheel
    viewport.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newScale = Math.min(Math.max(scale * zoomFactor, 0.2), 3);
      panX = mouseX - (mouseX - panX) * (newScale / scale);
      panY = mouseY - (mouseY - panY) * (newScale / scale);
      scale = newScale;
      updateTransform();
    }, { passive: false });

    // Panning
    viewport.addEventListener("mousedown", (e) => {
      if (e.target === viewport || e.target === world) {
        isPanning = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        viewport.classList.add("is-dragging");
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (isPanning) {
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        updateTransform();
      } else if (draggedNode) {
        const dx = (e.clientX - mouseStartWorldX) / scale;
        const dy = (e.clientY - mouseStartWorldY) / scale;
        draggedNode.element.style.left = (dragNodeStartX + dx) + "px";
        draggedNode.element.style.top = (dragNodeStartY + dy) + "px";
      }
    });

    window.addEventListener("mouseup", () => {
      isPanning = false;
      viewport.classList.remove("is-dragging");
      draggedNode = null;
    });

    // Zoom Buttons
    document.getElementById("btn-zoom-in").onclick = () => { scale = Math.min(scale * 1.2, 3); updateTransform(); };
    document.getElementById("btn-zoom-out").onclick = () => { scale = Math.max(scale * 0.8, 0.2); updateTransform(); };
    document.getElementById("btn-reset").onclick = () => { scale = 1; panX = 60; panY = 80; updateTransform(); };
    document.getElementById("btn-fit").onclick = () => { scale = 0.55; panX = 30; panY = 70; updateTransform(); };

    // Render Board Nodes
    function renderBoard(data) {
      world.innerHTML = "";
      data.nodes.forEach(node => {
        const el = document.createElement("div");
        el.className = "canvas-node";
        el.style.left = node.x + "px";
        el.style.top = node.y + "px";
        el.style.width = node.width + "px";

        el.addEventListener("mousedown", (e) => {
          if (e.target.tagName === "BUTTON" || e.target.tagName === "CODE") return;
          e.stopPropagation();
          draggedNode = { element: el, node };
          dragNodeStartX = parseFloat(el.style.left);
          dragNodeStartY = parseFloat(el.style.top);
          mouseStartWorldX = e.clientX;
          mouseStartWorldY = e.clientY;
          document.querySelectorAll(".canvas-node").forEach(n => n.classList.remove("is-selected"));
          el.classList.add("is-selected");
        });

        if (node.type === "screenshot") {
          el.innerHTML = \`
            <div class="node-header">
              <div>
                <div class="node-title">\${node.title}</div>
                \${node.subtitle ? \`<div class="node-sub">\${node.subtitle}</div>\` : ""}
              </div>
              \${node.badge ? \`<span class="node-badge" style="background:\${node.badgeColor || '#0A84FF'};color:#FFF;">\${node.badge}</span>\` : ""}
            </div>
            <div class="screenshot-body">
              <img src="\${node.imageUrl}" class="screenshot-img" alt="\${node.title}">
            </div>
          \`;
        } else if (node.type === "spec") {
          const itemsHtml = (node.items || []).map(it => \`
            <div class="spec-row">
              <span class="spec-label">\${it.label}</span>
              <span class="spec-val">\${it.value}</span>
            </div>
          \`).join("");

          el.innerHTML = \`
            <div class="node-header">
              <div class="node-title">\${node.title}</div>
              \${node.badge ? \`<span class="node-badge" style="background:\${node.badgeColor || '#30D158'};color:#000;">\${node.badge}</span>\` : ""}
            </div>
            <div class="spec-body">
              \${itemsHtml}
              \${node.code ? \`<pre class="spec-code"><code>\${node.code}</code></pre>\` : ""}
            </div>
          \`;
        } else if (node.type === "note") {
          el.className += " note-card";
          el.innerHTML = \`
            <div class="note-title">\${node.title}</div>
            <div class="note-text">\${node.text}</div>
          \`;
        }

        world.appendChild(el);
      });
    }

    // Polling for live updates
    async function fetchBoard() {
      try {
        const res = await fetch("/api/board");
        const jsonText = await res.text();
        if (jsonText !== lastBoardJson) {
          lastBoardJson = jsonText;
          renderBoard(JSON.parse(jsonText));
        }
      } catch (e) {}
    }

    fetchBoard();
    setInterval(fetchBoard, 2000);
    updateTransform();
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (parsedUrl.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  if (parsedUrl.pathname === "/api/board") {
    if (req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(loadBoard()));
      return;
    }
  }

  // Static images from assets/
  if (parsedUrl.pathname.startsWith("/assets/")) {
    const filePath = path.join(repoRoot, parsedUrl.pathname);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
      res.writeHead(200, { "Content-Type": mime });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`SubsMarket Design Canvas running at http://127.0.0.1:${PORT}`);
});
