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
  qty?: number | string;
  value?: number | string;
  Avg?: number | string; // HAE heart-rate points use Avg/Min/Max
  asleep?: number | string;
  totalSleep?: number | string;
  inBed?: number | string;
  sleepStart?: string;
  sleepEnd?: string;
  core?: number | string; // detailed-sleep stage hours
  deep?: number | string;
  rem?: number | string;
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

function num(x: unknown): number | null {
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  if (typeof x === "string" && x.trim() !== "") {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Coerce a raw sleep figure to hours (HAE reports hours, minutes, or seconds). */
function toHours(raw: number): number {
  if (raw > 1000) return raw / 3600; // seconds
  if (raw > 24) return raw / 60; // minutes
  return raw; // already hours
}

/** Robustly pull a night's asleep hours from the many HAE sleep shapes. */
function sleepHoursFromPoint(p: HaePoint): number | null {
  const direct = num(p.totalSleep) ?? num(p.asleep);
  if (direct != null && direct > 0) return toHours(direct);

  const stages = [num(p.core), num(p.deep), num(p.rem)].filter(
    (n): n is number => n != null,
  );
  if (stages.length) return toHours(stages.reduce((s, n) => s + n, 0));

  const q = num(p.qty) ?? num(p.value);
  if (q != null && q > 0) return toHours(q);

  const start = parseHaeDate(p.sleepStart);
  const end = parseHaeDate(p.sleepEnd);
  if (start && end && end > start) {
    return (end.getTime() - start.getTime()) / 3_600_000;
  }
  return null;
}

function pointValue(type: string, p: HaePoint): number | null {
  if (type === "sleep_hours") return sleepHoursFromPoint(p);
  return num(p.qty) ?? num(p.value) ?? num(p.Avg);
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
