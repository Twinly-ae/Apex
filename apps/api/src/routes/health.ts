import type { FastifyInstance } from "fastify";
import { dayStringSchema } from "@apex/shared";
import { computeHealth } from "../lib/health";

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
}
