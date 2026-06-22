import type { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { env } from "../env";
import { dayString } from "../lib/time";

// Map Health Auto Export metric names → our normalized types.
const NAME_MAP: Record<string, string> = {
  step_count: "steps",
  steps: "steps",
  active_energy: "active_energy",
  resting_heart_rate: "resting_hr",
  heart_rate: "heart_rate",
  weight_body_mass: "bodyweight",
  body_mass: "bodyweight",
  sleep_analysis: "sleep_hours",
};

interface HaePoint {
  date?: string;
  qty?: number;
  asleep?: number; // some HAE versions report sleep seconds here
  value?: number;
}
interface HaeMetric {
  name?: string;
  units?: string;
  data?: HaePoint[];
}

/** HAE dates look like "2026-06-22 00:00:00 +0400" — coax into a parseable form. */
function parseHaeDate(s: string | undefined): Date | null {
  if (!s) return null;
  const direct = new Date(s);
  if (!Number.isNaN(direct.getTime())) return direct;
  const normalized = s.replace(" ", "T").replace(" ", "");
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pointValue(type: string, p: HaePoint): number | null {
  if (typeof p.qty === "number") return p.qty;
  if (typeof p.value === "number") return p.value;
  if (type === "sleep_hours" && typeof p.asleep === "number") {
    return p.asleep / 3600;
  }
  return null;
}

export default async function ingestRoutes(
  app: FastifyInstance,
): Promise<void> {
  // Token-protected, unauthenticated (the phone's bridge app posts here).
  // Larger body limit + its own rate limit; never uses the session.
  app.post(
    "/health",
    {
      bodyLimit: 5 * 1024 * 1024,
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      if (!env.HEALTH_INGEST_TOKEN) {
        reply.code(503).send({ error: "Health ingest is not configured" });
        return;
      }
      const header = request.headers["x-ingest-token"];
      const query = (request.query as Record<string, unknown> | undefined)
        ?.token;
      const token = (Array.isArray(header) ? header[0] : header) ?? query;
      if (token !== env.HEALTH_INGEST_TOKEN) {
        reply.code(401).send({ error: "Invalid ingest token" });
        return;
      }

      // Single user: attribute ingested data to the one account.
      const user = await prisma.user.findFirst({ select: { id: true } });
      if (!user) {
        reply.code(409).send({ error: "No user to attribute data to" });
        return;
      }

      const body = request.body as { data?: { metrics?: HaeMetric[] } };
      const metrics = body?.data?.metrics ?? [];
      let written = 0;

      for (const metric of metrics) {
        const type = metric.name ? NAME_MAP[metric.name] : undefined;
        if (!type || !Array.isArray(metric.data)) continue;

        for (const point of metric.data) {
          const at = parseHaeDate(point.date);
          const value = pointValue(type, point);
          if (!at || value == null) continue;
          const day = dayString(at);

          await prisma.healthMetric.upsert({
            where: { userId_type_startAt: { userId: user.id, type, startAt: at } },
            create: {
              userId: user.id,
              type,
              value,
              unit: metric.units ?? null,
              day,
              startAt: at,
            },
            update: { value, unit: metric.units ?? null, day },
          });
          written++;

          // Bodyweight also flows into the weight log (deduped by timestamp).
          if (type === "bodyweight") {
            const exists = await prisma.bodyweightEntry.findFirst({
              where: { userId: user.id, measuredAt: at, source: "watch" },
            });
            if (!exists) {
              await prisma.bodyweightEntry.create({
                data: {
                  userId: user.id,
                  weightKg: value,
                  measuredAt: at,
                  source: "watch",
                },
              });
            }
          }
        }
      }

      return { ok: true, written };
    },
  );
}
