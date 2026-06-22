import type { FastifyInstance } from "fastify";
import { createMealSchema, dayStringSchema, idParamSchema } from "@apex/shared";
import { prisma } from "../db";
import { parseOr400 } from "../lib/http";
import { toMeal } from "../lib/serializers";
import { rangeForDayString } from "../lib/time";

export default async function mealRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  // GET /api/meals?date=YYYY-MM-DD  (defaults to today)
  app.get("/", async (request) => {
    const day = dayStringSchema.optional().safeParse(
      (request.query as Record<string, unknown> | undefined)?.date,
    );
    const { start, end } = rangeForDayString(day.success ? day.data : undefined);
    const meals = await prisma.meal.findMany({
      where: { userId: request.userId, eatenAt: { gte: start, lt: end } },
      orderBy: { eatenAt: "desc" },
    });
    return meals.map(toMeal);
  });

  app.post("/", async (request, reply) => {
    const body = parseOr400(createMealSchema, request.body, reply);
    if (!body) return;
    const meal = await prisma.meal.create({
      data: {
        userId: request.userId,
        description: body.description,
        calories: body.calories,
        protein: body.protein,
        carbs: body.carbs,
        fat: body.fat,
        source: body.source,
        eatenAt: body.eatenAt ? new Date(body.eatenAt) : undefined,
      },
    });
    reply.code(201);
    return toMeal(meal);
  });

  app.delete("/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const result = await prisma.meal.deleteMany({
      where: { id: params.id, userId: request.userId },
    });
    if (result.count === 0) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    return { ok: true };
  });
}
