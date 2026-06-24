import type { FastifyInstance } from "fastify";
import { type HealthSyncStatus, dayStringSchema } from "@apex/shared";
import { prisma } from "../db";
import { env } from "../env";
import { computeHealth } from "../lib/health";
import { dayString } from "../lib/time";

// The metrics that actually drive the sleep / recovery / stress scores.
const TRACKED = ["sleep_hours", "resting_hr", "steps", "active_energy"];

export default async function healthRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  // GET /api/health/scores?date=YYYY-MM-DD (defaults to today) — scores + series.
  // (Note: GET /api/health itself is the unauthenticated container health check.)
  app.get("/scores", async (request) => {
    const parsed = dayStringSchema
      .optional()
      .safeParse((request.query as Record<string, unknown> | undefined)?.date);
    return computeHealth(request.userId, parsed.success ? parsed.data : undefined);
  });

  // GET /api/health/sync — is the Apple Health bridge configured and is data
  // actually arriving? Lets the user tell "token off" from "phone not posting"
  // from "sleep didn't parse" without reading server logs.
  app.get("/sync", async (request): Promise<HealthSyncStatus> => {
    const userId = request.userId;
    const today = dayString();
    const [latest, total, metrics] = await Promise.all([
      prisma.healthMetric.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.healthMetric.count({ where: { userId } }),
      Promise.all(
        TRACKED.map(async (type) => {
          const row = await prisma.healthMetric.findFirst({
            where: { userId, type },
            orderBy: { startAt: "desc" },
            select: { startAt: true, day: true },
          });
          return {
            type,
            lastAt: row ? row.startAt.toISOString() : null,
            today: row?.day === today,
          };
        }),
      ),
    ]);

    return {
      configured: Boolean(env.HEALTH_INGEST_TOKEN),
      lastSyncAt: latest ? latest.createdAt.toISOString() : null,
      total,
      metrics,
    };
  });
}
