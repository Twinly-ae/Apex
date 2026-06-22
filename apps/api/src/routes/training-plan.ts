import type { FastifyInstance } from "fastify";
import { DEFAULT_SPLIT, trainingPlanSchema, type TrainingPlan } from "@apex/shared";
import { prisma } from "../db";
import { parseOr400 } from "../lib/http";

export async function ensureTrainingPlan(userId: string) {
  const existing = await prisma.trainingPlan.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.trainingPlan.create({ data: { userId, days: DEFAULT_SPLIT } });
}

export default async function trainingPlanRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request): Promise<TrainingPlan> => {
    const plan = await ensureTrainingPlan(request.userId);
    return { days: plan.days, updatedAt: plan.updatedAt.toISOString() };
  });

  app.put("/", async (request, reply) => {
    const body = parseOr400(trainingPlanSchema, request.body, reply);
    if (!body) return;
    await ensureTrainingPlan(request.userId);
    const plan = await prisma.trainingPlan.update({
      where: { userId: request.userId },
      data: { days: body.days },
    });
    return { days: plan.days, updatedAt: plan.updatedAt.toISOString() };
  });
}
