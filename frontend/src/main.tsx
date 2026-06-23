import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppRoot } from "@telegram-apps/telegram-ui";
import "@telegram-apps/telegram-ui/dist/styles.css";
import { App } from "./App";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000
    }
  }
});

function detectAppearance(): "light" | "dark" {
  const tg = window.Telegram?.WebApp;
  if (tg?.colorScheme === "dark") return "dark";
  return "light";
}

function detectPlatform(): "ios" | "base" {
  const tg = window.Telegram?.WebApp;
  const platform = tg?.platform ?? "";
  if (platform === "ios") return "ios";
  return "base";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppRoot appearance={detectAppearance()} platform={detectPlatform()}>
        <App />
      </AppRoot>
    </QueryClientProvider>
  </StrictMode>
);
