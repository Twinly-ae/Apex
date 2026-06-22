import type { FastifyInstance } from "fastify";
import {
  createGoalSchema,
  createMilestoneSchema,
  idParamSchema,
  updateGoalSchema,
  updateMilestoneSchema,
} from "@apex/shared";
import { prisma } from "../db";
import { loadGoals, serializeGoal } from "../lib/goals";
import { parseOr400 } from "../lib/http";

export default async function goalRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => loadGoals(request.userId));

  app.post("/", async (request, reply) => {
    const body = parseOr400(createGoalSchema, request.body, reply);
    if (!body) return;
    const goal = await prisma.goal.create({
      data: {
        userId: request.userId,
        title: body.title,
        description: body.description ?? null,
        category: body.category,
        targetDate: new Date(body.targetDate),
        metricUnit: body.metricUnit ?? null,
        startValue: body.startValue ?? null,
        targetValue: body.targetValue ?? null,
        currentValue: body.currentValue ?? null,
      },
      include: { milestones: true },
    });
    reply.code(201);
    return serializeGoal(goal);
  });

  app.patch("/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(updateGoalSchema, request.body, reply);
    if (!body) return;
    const existing = await prisma.goal.findFirst({
      where: { id: params.id, userId: request.userId },
    });
    if (!existing) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    const goal = await prisma.goal.update({
      where: { id: existing.id },
      data: {
        title: body.title ?? undefined,
        description:
          body.description === undefined ? undefined : body.description,
        category: body.category ?? undefined,
        status: body.status ?? undefined,
        targetDate: body.targetDate ? new Date(body.targetDate) : undefined,
        metricUnit: body.metricUnit === undefined ? undefined : body.metricUnit,
        startValue: body.startValue === undefined ? undefined : body.startValue,
        targetValue:
          body.targetValue === undefined ? undefined : body.targetValue,
        currentValue:
          body.currentValue === undefined ? undefined : body.currentValue,
      },
      include: { milestones: true },
    });
    return serializeGoal(goal);
  });

  app.delete("/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const result = await prisma.goal.deleteMany({
      where: { id: params.id, userId: request.userId },
    });
    if (result.count === 0) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    return { ok: true };
  });

  // ---- Milestones (return the parent goal so the UI re-renders pace) -------
  app.post("/:id/milestones", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(createMilestoneSchema, request.body, reply);
    if (!body) return;
    const goal = await prisma.goal.findFirst({
      where: { id: params.id, userId: request.userId },
    });
    if (!goal) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    const order = await prisma.goalMilestone.count({ where: { goalId: goal.id } });
    await prisma.goalMilestone.create({
      data: {
        goalId: goal.id,
        title: body.title,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        order,
      },
    });
    const full = await prisma.goal.findUniqueOrThrow({
      where: { id: goal.id },
      include: { milestones: true },
    });
    reply.code(201);
    return serializeGoal(full);
  });

  app.patch("/milestones/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(updateMilestoneSchema, request.body, reply);
    if (!body) return;
    const milestone = await prisma.goalMilestone.findUnique({
      where: { id: params.id },
      include: { goal: { select: { userId: true } } },
    });
    if (!milestone || milestone.goal.userId !== request.userId) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    await prisma.goalMilestone.update({
      where: { id: milestone.id },
      data: {
        title: body.title ?? undefined,
        dueDate:
          body.dueDate === undefined
            ? undefined
            : body.dueDate
              ? new Date(body.dueDate)
              : null,
        order: body.order ?? undefined,
        done: body.done ?? undefined,
        doneAt:
          body.done === undefined ? undefined : body.done ? new Date() : null,
      },
    });
    const full = await prisma.goal.findUniqueOrThrow({
      where: { id: milestone.goalId },
      include: { milestones: true },
    });
    return serializeGoal(full);
  });

  app.delete("/milestones/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const milestone = await prisma.goalMilestone.findUnique({
      where: { id: params.id },
      include: { goal: { select: { userId: true } } },
    });
    if (!milestone || milestone.goal.userId !== request.userId) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    await prisma.goalMilestone.delete({ where: { id: milestone.id } });
    const full = await prisma.goal.findUniqueOrThrow({
      where: { id: milestone.goalId },
      include: { milestones: true },
    });
    return serializeGoal(full);
  });
}
