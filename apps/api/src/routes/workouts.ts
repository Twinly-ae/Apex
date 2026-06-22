import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import {
  createWorkoutSchema,
  idParamSchema,
  type SyncResult,
  type Workout,
} from "@apex/shared";
import { prisma } from "../db";
import { fetchRecentWorkouts, hevyConfigured } from "../integrations/hevy";
import { parseOr400 } from "../lib/http";

type WorkoutWithSets = Prisma.WorkoutGetPayload<{ include: { sets: true } }>;

function serialize(w: WorkoutWithSets): Workout {
  return {
    id: w.id,
    title: w.title,
    performedAt: w.performedAt.toISOString(),
    notes: w.notes,
    source: w.source,
    sets: [...w.sets]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        id: s.id,
        exercise: s.exercise,
        order: s.order,
        weightKg: s.weightKg,
        reps: s.reps,
      })),
  };
}

export default async function workoutRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  // Pull recent workouts from Hevy (read-only), deduped by their workout id.
  app.post("/sync-hevy", async (request): Promise<SyncResult> => {
    if (!hevyConfigured()) {
      return {
        connected: false,
        imported: 0,
        total: 0,
        message: "Set HEVY_API_KEY (Hevy Pro) to auto-import workouts.",
      };
    }
    let workouts;
    try {
      workouts = await fetchRecentWorkouts();
    } catch (err) {
      return {
        connected: true,
        imported: 0,
        total: 0,
        message: err instanceof Error ? err.message : "Hevy sync failed",
      };
    }

    let imported = 0;
    for (const w of workouts) {
      if (!w.id) continue;
      const existing = await prisma.workout.findFirst({
        where: { userId: request.userId, externalId: w.id },
      });
      if (existing) continue;
      const performedAt = w.start_time
        ? new Date(w.start_time)
        : w.created_at
          ? new Date(w.created_at)
          : undefined;
      await prisma.workout.create({
        data: {
          userId: request.userId,
          title: w.title || "Hevy workout",
          source: "hevy",
          externalId: w.id,
          performedAt,
          sets: {
            create: (w.exercises ?? []).flatMap((ex, exIdx) =>
              (ex.sets ?? []).map((s, setIdx) => ({
                exercise: ex.title || "Exercise",
                order: exIdx * 100 + setIdx,
                weightKg: s.weight_kg ?? null,
                reps: s.reps ?? null,
              })),
            ),
          },
        },
      });
      imported++;
    }
    return { connected: true, imported, total: workouts.length };
  });

  app.get("/", async (request) => {
    const raw = (request.query as Record<string, unknown> | undefined)?.limit;
    const limit = Math.min(Math.max(Number(raw) || 30, 1), 200);
    const workouts = await prisma.workout.findMany({
      where: { userId: request.userId },
      include: { sets: true },
      orderBy: { performedAt: "desc" },
      take: limit,
    });
    return workouts.map(serialize);
  });

  app.post("/", async (request, reply) => {
    const body = parseOr400(createWorkoutSchema, request.body, reply);
    if (!body) return;
    const workout = await prisma.workout.create({
      data: {
        userId: request.userId,
        title: body.title,
        notes: body.notes ?? null,
        performedAt: body.performedAt ? new Date(body.performedAt) : undefined,
        sets: {
          create: (body.sets ?? []).map((s, i) => ({
            exercise: s.exercise,
            order: i,
            weightKg: s.weightKg ?? null,
            reps: s.reps ?? null,
          })),
        },
      },
      include: { sets: true },
    });
    reply.code(201);
    return serialize(workout);
  });

  app.delete("/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const result = await prisma.workout.deleteMany({
      where: { id: params.id, userId: request.userId },
    });
    if (result.count === 0) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    return { ok: true };
  });
}
