import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/manrope";
import "@fontsource-variable/space-grotesk";
import App from "./App";
import { applyTheme } from "./lib/theme";
import "./index.css";

applyTheme();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // "Live" = refetch on app open / focus, with a short freshness window.
      refetchOnWindowFocus: true,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
