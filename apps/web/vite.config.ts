import { execSync } from "node:child_process";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// In dev we proxy /api -> the local API so the browser stays same-origin
// (simplest cookies). In production set VITE_API_URL to the API's origin.
const DEV_API_TARGET = process.env.VITE_DEV_API_TARGET || "http://localhost:8080";

// Stamp the build so the live deploy is verifiable in-app (Settings footer).
function buildId(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(buildId()),
    __BUILD_TIME__: JSON.stringify(
      new Date().toISOString().slice(0, 16).replace("T", " "),
    ),
  },
  plugins: [
    react(),
    VitePWA({
      // Auto-update so you always run the latest deploy (important while we're
      // still wiring things up and shipping phases). The brief reload only
      // happens when a new build is published.
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Apex",
        short_name: "Apex",
        description: "Your private personal command center.",
        theme_color: "#0a0a0f",
        background_color: "#0a0a0f",
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
        // Don't let the SPA fallback swallow the API or our extra SW script.
        navigateFallbackDenylist: [/^\/api/, /sw-push\.js$/],
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // Phase 5: add our push + notificationclick handlers to the generated SW.
        importScripts: ["/sw-push.js"],
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
