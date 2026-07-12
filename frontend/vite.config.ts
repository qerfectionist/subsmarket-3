import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true
      },
      "/health": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true
      },
      "/ready": {
        target: "http://127.0.0.1:8000",
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
          if (id.includes("@worldcoin/mini-apps-ui-kit-react")) return "world-ui";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("react-dom") || id.includes("react/")) return "react";
        }
      }
    }
  }
});
