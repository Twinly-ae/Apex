import type { FastifyInstance } from "fastify";
import { dayStringSchema } from "@apex/shared";
import { healthSummary } from "../lib/health";

export default async function metricsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  // GET /api/metrics/summary?date=YYYY-MM-DD (defaults to today)
  app.get("/summary", async (request) => {
    const parsed = dayStringSchema
      .optional()
      .safeParse((request.query as Record<string, unknown> | undefined)?.date);
    return healthSummary(
      request.userId,
      parsed.success ? parsed.data : undefined,
    );
  });
}
