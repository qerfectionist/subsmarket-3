import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: false,
    hmr: {
      host: "127.0.0.1",
      clientPort: 5173
    },
    allowedHosts: ["sampling-action-castle-ware.trycloudflare.com"],
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
});
