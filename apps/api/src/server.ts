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
import aiRoutes from "./routes/ai";
import billRoutes from "./routes/bills";
import bodyweightRoutes from "./routes/bodyweight";
import goalRoutes from "./routes/goals";
import habitRoutes from "./routes/habits";
import ingestRoutes from "./routes/ingest";
import mealRoutes from "./routes/meals";
import metricsRoutes from "./routes/metrics";
import moneyRoutes from "./routes/money";
import settingsRoutes from "./routes/settings";
import statementRoutes from "./routes/statements";
import taskRoutes from "./routes/tasks";
import todayRoutes from "./routes/today";
import trainingPlanRoutes from "./routes/training-plan";
import trendsRoutes from "./routes/trends";
import twinlyRoutes from "./routes/twinly";
import waterRoutes from "./routes/water";
import workoutRoutes from "./routes/workouts";

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
  await app.register(goalRoutes, { prefix: "/api/goals" });
  await app.register(habitRoutes, { prefix: "/api/habits" });
  await app.register(workoutRoutes, { prefix: "/api/workouts" });
  await app.register(trainingPlanRoutes, { prefix: "/api/training-plan" });
  await app.register(trendsRoutes, { prefix: "/api/trends" });
  await app.register(moneyRoutes, { prefix: "/api/money" });
  await app.register(billRoutes, { prefix: "/api/bills" });
  await app.register(metricsRoutes, { prefix: "/api/metrics" });
  await app.register(twinlyRoutes, { prefix: "/api/twinly" });
  await app.register(aiRoutes, { prefix: "/api/ai" });
  await app.register(statementRoutes, { prefix: "/api/statements" });
  await app.register(settingsRoutes, { prefix: "/api/settings" });
  await app.register(todayRoutes, { prefix: "/api/today" });

  // Apple Health ingest — token-protected, NOT behind the session.
  await app.register(ingestRoutes, { prefix: "/api/ingest" });

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
