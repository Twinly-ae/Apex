import crypto from "node:crypto";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import secureSession from "@fastify/secure-session";
import Fastify, {
  type FastifyError,
  type FastifyInstance,
} from "fastify";
import { registerAuth } from "./auth";
import { env, isProd } from "./env";
import bodyweightRoutes from "./routes/bodyweight";
import mealRoutes from "./routes/meals";
import settingsRoutes from "./routes/settings";
import taskRoutes from "./routes/tasks";
import todayRoutes from "./routes/today";
import waterRoutes from "./routes/water";

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: isProd ? "info" : "debug" },
    // Behind Cloudflare + Railway: trust the proxy for client IP + protocol
    // (so rate-limiting and `secure` cookie detection work correctly).
    trustProxy: true,
    bodyLimit: 1 * 1024 * 1024, // 1 MB; raised later for photo/statement uploads
  });

  // ---- Security middleware -------------------------------------------------
  await app.register(helmet, {
    // This service only returns JSON; a CSP belongs on the web app instead.
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: env.APP_ORIGIN, // only our own PWA may call the API
    credentials: true, // allow the session cookie
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  });

  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
  });

  // Encrypted, signed session cookie (no server-side store needed for one user).
  // 32-byte key derived deterministically from SESSION_SECRET.
  const key = crypto.createHash("sha256").update(env.SESSION_SECRET).digest();
  await app.register(secureSession, {
    key,
    cookieName: "apex_session",
    cookie: {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    },
  });

  // ---- Health check (unauthenticated) -------------------------------------
  app.get("/api/health", async () => ({ ok: true, ts: new Date().toISOString() }));

  // ---- Auth (decorators + /api/auth) --------------------------------------
  await registerAuth(app);

  // ---- Feature routes (all require a session) ------------------------------
  await app.register(mealRoutes, { prefix: "/api/meals" });
  await app.register(bodyweightRoutes, { prefix: "/api/bodyweight" });
  await app.register(waterRoutes, { prefix: "/api/water" });
  await app.register(taskRoutes, { prefix: "/api/tasks" });
  await app.register(settingsRoutes, { prefix: "/api/settings" });
  await app.register(todayRoutes, { prefix: "/api/today" });

  // ---- Uniform error shape; never leak internals in production -------------
  app.setErrorHandler((err: FastifyError, request, reply) => {
    const status =
      typeof err.statusCode === "number" && err.statusCode >= 400
        ? err.statusCode
        : 500;
    if (status >= 500) request.log.error(err);
    reply.code(status).send({
      error:
        status === 500
          ? "Internal Server Error"
          : err.message || "Request failed",
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: "Not found" });
  });

  return app;
}
