import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { Toaster, ToastProvider } from "./components/ui";
import "@heroui/styles";
import "./styles/tokens.css";
import "./styles.css";
import "./styles/ui.css";
import "./styles/screens.css";
import "./styles/market.css";
import "./styles/ios27-layout.css";
import "./styles/ios27-category-menu.css";
import "./styles/hig-review.css";

const ios27LayoutEnabled = new URLSearchParams(window.location.search).get("ios27") !== "off";
document.documentElement.dataset.ios27Layout = ios27LayoutEnabled ? "on" : "off";
document.documentElement.dataset.higReview = new URLSearchParams(window.location.search).get("hig") === "off" ? "off" : "on";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000
    }
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
        <Toaster duration={3000} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>
);
