// Minimal production static server for the built PWA. Zero dependencies (Node
// built-ins only) so it runs in a production install with devDependencies
// omitted. Serves apps/web/dist on $PORT with SPA history fallback.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = fileURLToPath(new URL("./dist", import.meta.url));
const port = Number(process.env.PORT) || 4173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function sendFile(res, status, filePath) {
  res.writeHead(status, {
    "Content-Type": MIME[extname(filePath)] || "application/octet-stream",
  });
  createReadStream(filePath).pipe(res);
}

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);

  // The API is a separate service. If an /api request lands here, VITE_API_URL
  // is misconfigured — fail loudly with JSON instead of serving the HTML shell.
  if (urlPath === "/api" || urlPath.startsWith("/api/")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(
      '{"error":"This is the web service. Point VITE_API_URL at the API origin."}',
    );
    return;
  }

  // Block path traversal, then resolve within dist.
  const safePath = normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(distDir, safePath);

  if (
    filePath.startsWith(distDir) &&
    existsSync(filePath) &&
    statSync(filePath).isFile()
  ) {
    return sendFile(res, 200, filePath);
  }
  // SPA fallback: let the client router handle the route.
  return sendFile(res, 200, join(distDir, "index.html"));
});

server.listen(port, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`Apex web serving on :${port}`);
});
