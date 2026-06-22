import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// In dev we proxy /api -> the local API so the browser stays same-origin
// (simplest cookies). In production set VITE_API_URL to the API's origin.
const DEV_API_TARGET = process.env.VITE_DEV_API_TARGET || "http://localhost:8080";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Apex",
        short_name: "Apex",
        description: "Your private personal command center.",
        theme_color: "#0b0f14",
        background_color: "#0b0f14",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache the app shell only. We intentionally do NOT cache /api
        // responses to disk — health & money data stays in memory (TanStack
        // Query) and is refetched on open.
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: DEV_API_TARGET, changeOrigin: true, secure: false },
    },
  },
  build: {
    sourcemap: false,
  },
});
