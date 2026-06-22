import type { FastifyInstance } from "fastify";
import { createHabitSchema, idParamSchema } from "@apex/shared";
import { prisma } from "../db";
import { loadHabits } from "../lib/habits";
import { parseOr400 } from "../lib/http";
import { dayString } from "../lib/time";

export default async function habitRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => loadHabits(request.userId));

  app.post("/", async (request, reply) => {
    const body = parseOr400(createHabitSchema, request.body, reply);
    if (!body) return;
    await prisma.habit.create({
      data: {
        userId: request.userId,
        name: body.name,
        emoji: body.emoji ?? null,
      },
    });
    reply.code(201);
    return loadHabits(request.userId);
  });

  // Toggle today's completion; returns the refreshed habit list.
  app.post("/:id/toggle", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const habit = await prisma.habit.findFirst({
      where: { id: params.id, userId: request.userId },
    });
    if (!habit) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    const today = dayString();
    const existing = await prisma.habitLog.findUnique({
      where: { habitId_day: { habitId: habit.id, day: today } },
    });
    if (existing) {
      await prisma.habitLog.delete({ where: { id: existing.id } });
    } else {
      await prisma.habitLog.create({ data: { habitId: habit.id, day: today } });
    }
    return loadHabits(request.userId);
  });

  app.delete("/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const result = await prisma.habit.deleteMany({
      where: { id: params.id, userId: request.userId },
    });
    if (result.count === 0) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    return { ok: true };
  });
}
