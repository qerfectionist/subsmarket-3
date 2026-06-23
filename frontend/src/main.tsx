import { StrictMode, useEffect, useState } from "react";
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

type Appearance = "light" | "dark";

function detectAppearance(): Appearance {
  const tg = window.Telegram?.WebApp;
  if (tg?.colorScheme === "dark") return "dark";
  if (tg?.colorScheme === "light") return "light";
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function detectPlatform(): "ios" | "base" {
  const tg = window.Telegram?.WebApp;
  const platform = tg?.platform ?? "";
  if (platform === "ios") return "ios";
  return "base";
}

function Root() {
  const [appearance, setAppearance] = useState<Appearance>(detectAppearance);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const handler = () => setAppearance(detectAppearance());
    tg?.onEvent?.("themeChanged", handler);
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    mq?.addEventListener?.("change", handler);
    return () => {
      tg?.offEvent?.("themeChanged", handler);
      mq?.removeEventListener?.("change", handler);
    };
  }, []);

  return (
    <AppRoot appearance={appearance} platform={detectPlatform()}>
      <App />
    </AppRoot>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  </StrictMode>
);
