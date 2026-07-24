import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import {
  createWorkoutSchema,
  idParamSchema,
  type SyncResult,
  type Workout,
} from "@apex/shared";
import { prisma } from "../db";
import { parseOr400 } from "../lib/http";
import { syncHevyForUser } from "../lib/hevySync";
import { computePrs, detectNewPrs, exerciseProgression } from "../lib/prs";

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
  app.post("/sync-hevy", async (request): Promise<SyncResult> =>
    syncHevyForUser(request.userId));

  // All-time best set per exercise, ranked by estimated 1RM.
  app.get("/prs", async (request) => {
    return computePrs(request.userId);
  });

  // Best set per day for one exercise (last ~6 months) — strength history.
  app.get("/progression", async (request, reply) => {
    const exercise = (request.query as Record<string, unknown> | undefined)
      ?.exercise;
    if (typeof exercise !== "string" || !exercise.trim()) {
      reply.code(400).send({ error: "exercise is required" });
      return;
    }
    return exerciseProgression(request.userId, exercise.trim());
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
    detectNewPrs(request.userId, workout.id).catch(() => {});
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
