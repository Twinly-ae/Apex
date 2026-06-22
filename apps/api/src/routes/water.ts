import type { FastifyInstance } from "fastify";
import { createWaterSchema, dayStringSchema, idParamSchema } from "@apex/shared";
import { prisma } from "../db";
import { parseOr400 } from "../lib/http";
import { toWater } from "../lib/serializers";
import { rangeForDayString } from "../lib/time";

export default async function waterRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  // GET /api/water?date=YYYY-MM-DD -> { totalMl, logs[] } for that day.
  app.get("/", async (request) => {
    const day = dayStringSchema.optional().safeParse(
      (request.query as Record<string, unknown> | undefined)?.date,
    );
    const { start, end } = rangeForDayString(day.success ? day.data : undefined);
    const logs = await prisma.waterLog.findMany({
      where: { userId: request.userId, loggedAt: { gte: start, lt: end } },
      orderBy: { loggedAt: "desc" },
    });
    const totalMl = logs.reduce((sum, l) => sum + l.amountMl, 0);
    return { totalMl, logs: logs.map(toWater) };
  });

  app.post("/", async (request, reply) => {
    const body = parseOr400(createWaterSchema, request.body, reply);
    if (!body) return;
    const log = await prisma.waterLog.create({
      data: {
        userId: request.userId,
        amountMl: body.amountMl,
        loggedAt: body.loggedAt ? new Date(body.loggedAt) : undefined,
      },
    });
    reply.code(201);
    return toWater(log);
  });

  app.delete("/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const result = await prisma.waterLog.deleteMany({
      where: { id: params.id, userId: request.userId },
    });
    if (result.count === 0) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    return { ok: true };
  });
}
