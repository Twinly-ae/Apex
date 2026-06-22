import type { FastifyInstance } from "fastify";
import { createBodyweightSchema, idParamSchema } from "@apex/shared";
import { prisma } from "../db";
import { parseOr400 } from "../lib/http";
import { toBodyweight } from "../lib/serializers";

export default async function bodyweightRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  // Most-recent-first history; `?limit=` caps it (default 90).
  app.get("/", async (request) => {
    const raw = (request.query as Record<string, unknown> | undefined)?.limit;
    const limit = Math.min(Math.max(Number(raw) || 90, 1), 365);
    const entries = await prisma.bodyweightEntry.findMany({
      where: { userId: request.userId },
      orderBy: { measuredAt: "desc" },
      take: limit,
    });
    return entries.map(toBodyweight);
  });

  app.post("/", async (request, reply) => {
    const body = parseOr400(createBodyweightSchema, request.body, reply);
    if (!body) return;
    const entry = await prisma.bodyweightEntry.create({
      data: {
        userId: request.userId,
        weightKg: body.weightKg,
        source: body.source,
        measuredAt: body.measuredAt ? new Date(body.measuredAt) : undefined,
      },
    });
    reply.code(201);
    return toBodyweight(entry);
  });

  app.delete("/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const result = await prisma.bodyweightEntry.deleteMany({
      where: { id: params.id, userId: request.userId },
    });
    if (result.count === 0) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    return { ok: true };
  });
}
