import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@worldcoin/mini-apps-ui-kit-react";
import { App } from "./App";
import "./styles/tokens.css";
import "./styles.css";
import "./styles/market.css";

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
      <App />
      <Toaster duration={3000} />
    </QueryClientProvider>
  </StrictMode>
);
