import type { FastifyInstance } from "fastify";
import {
  analyzePhotoSchema,
  analyzeTextSchema,
  createMealSchema,
  dayStringSchema,
  idParamSchema,
  type MealDay,
} from "@apex/shared";
import { prisma } from "../db";
import { aiConfigured } from "../lib/ai";
import {
  estimateFromPhoto,
  estimateFromText,
  lookupBarcode,
} from "../lib/food";
import { parseOr400 } from "../lib/http";
import { toMeal } from "../lib/serializers";
import { dayBefore, dayString, rangeForDayString } from "../lib/time";

export default async function mealRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  // ---- AI / barcode macro estimation (returns an estimate to confirm) -----
  app.post("/analyze/text", async (request, reply) => {
    if (!aiConfigured()) {
      reply.code(503).send({ error: "AI is not configured" });
      return;
    }
    const body = parseOr400(analyzeTextSchema, request.body, reply);
    if (!body) return;
    try {
      return await estimateFromText(body.text);
    } catch (err) {
      reply.code(502).send({
        error: err instanceof Error ? err.message : "AI request failed",
      });
    }
  });

  app.post(
    "/analyze/photo",
    { bodyLimit: 8 * 1024 * 1024 },
    async (request, reply) => {
      if (!aiConfigured()) {
        reply.code(503).send({ error: "AI is not configured" });
        return;
      }
      const body = parseOr400(analyzePhotoSchema, request.body, reply);
      if (!body) return;
      try {
        return await estimateFromPhoto(
          body.imageBase64,
          body.mediaType,
          body.hint,
        );
      } catch (err) {
        reply.code(502).send({
          error: err instanceof Error ? err.message : "AI request failed",
        });
      }
    },
  );

  app.get("/barcode/:code", async (request, reply) => {
    const code = (request.params as { code: string }).code;
    if (!/^\d{6,14}$/.test(code)) {
      reply.code(400).send({ error: "Invalid barcode" });
      return;
    }
    try {
      const est = await lookupBarcode(code);
      if (!est) {
        reply.code(404).send({ error: "Product not found" });
        return;
      }
      return est;
    } catch {
      reply.code(502).send({ error: "Barcode lookup failed" });
    }
  });

  // GET /api/meals/history?days=N — recent days grouped, newest first, each
  // with its meals + rolled-up totals. Always includes today + the prior 2 days.
  app.get("/history", async (request) => {
    const raw = Number(
      (request.query as Record<string, unknown> | undefined)?.days,
    );
    const days = Math.min(Math.max(Number.isFinite(raw) ? raw : 7, 1), 186);
    const now = new Date();
    const since = rangeForDayString(dayString(dayBefore(days - 1, now))).start;
    const meals = await prisma.meal.findMany({
      where: { userId: request.userId, eatenAt: { gte: since } },
      orderBy: { eatenAt: "desc" },
    });

    const out: MealDay[] = [];
    for (let i = 0; i < days; i++) {
      const ds = dayString(dayBefore(i, now));
      const { start, end } = rangeForDayString(ds);
      const dayMeals = meals.filter((m) => m.eatenAt >= start && m.eatenAt < end);
      if (dayMeals.length === 0 && i > 2) continue; // keep today + prior 2 days
      const totals = dayMeals.reduce(
        (t, m) => ({
          calories: t.calories + m.calories,
          protein: Math.round((t.protein + m.protein) * 10) / 10,
          carbs: Math.round((t.carbs + m.carbs) * 10) / 10,
          fat: Math.round((t.fat + m.fat) * 10) / 10,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
      out.push({ day: ds, totals, meals: dayMeals.map(toMeal) });
    }
    return out;
  });

  // GET /api/meals/recent — most recent distinct meals, for one-tap re-logging.
  app.get("/recent", async (request) => {
    const meals = await prisma.meal.findMany({
      where: { userId: request.userId },
      orderBy: { eatenAt: "desc" },
      take: 120,
    });
    const seen = new Set<string>();
    const out = [];
    for (const m of meals) {
      const key = m.description.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(toMeal(m));
      if (out.length >= 8) break;
    }
    return out;
  });

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
