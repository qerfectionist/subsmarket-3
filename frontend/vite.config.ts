import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type PluginOption } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ mode }) => {
  const plugins: PluginOption[] = [react(), tailwindcss()];

  if (mode === "analyze" || process.env.ANALYZE === "true") {
    plugins.push(
      visualizer({
        filename: "dist/stats.html",
        open: false,
        gzipSize: true,
        brotliSize: true
      })
    );
  }

  return {
    plugins,
    server: {
      port: 5173,
      strictPort: false,
      hmr: {
        host: "127.0.0.1",
        clientPort: 5173
      },
      allowedHosts: true,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8002",
          changeOrigin: true
        },
        "/health": {
          target: "http://127.0.0.1:8002",
          changeOrigin: true
        },
        "/ready": {
          target: "http://127.0.0.1:8002",
          changeOrigin: true
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("@tanstack/react-query")) return "query";
            if (id.includes("sf-symbols-lib")) return "symbols";
            if (id.includes("react-dom") || id.includes("react/")) return "react";
          }
        }
      }
    }
  };
});
