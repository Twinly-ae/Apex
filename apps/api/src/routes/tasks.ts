import type { FastifyInstance } from "fastify";
import {
  createTaskSchema,
  createTaskStepSchema,
  idParamSchema,
  updateTaskSchema,
  updateTaskStepSchema,
} from "@apex/shared";
import { prisma } from "../db";
import { parseOr400 } from "../lib/http";
import { toTask } from "../lib/serializers";
import { localWeekdayMon0 } from "../lib/time";

/**
 * Next due date for a repeating task, always in the future. Keeps the
 * time-of-day; "weekdays" skips Sat/Sun (local Dubai weekdays).
 */
function nextOccurrence(from: Date, repeat: string, now = new Date()): Date {
  const d = new Date(from.getTime());
  const step = () => {
    if (repeat === "weekly") {
      d.setUTCDate(d.getUTCDate() + 7);
    } else {
      d.setUTCDate(d.getUTCDate() + 1);
      if (repeat === "weekdays") {
        while (localWeekdayMon0(d) >= 5) d.setUTCDate(d.getUTCDate() + 1);
      }
    }
  };
  step();
  while (d.getTime() <= now.getTime()) step();
  return d;
}

/**
 * Minutes to bank for a focus stretch. Honest rounding: ignore accidental
 * taps (<10s), count short-but-real stretches as 1m, else round normally.
 */
function bankedMinutes(startedAt: Date): number {
  const sec = (Date.now() - startedAt.getTime()) / 1000;
  if (sec < 10) return 0;
  if (sec < 60) return 1;
  return Math.round(sec / 60);
}

export default async function taskRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  // Open tasks first, then recently completed; matches the UI ordering.
  app.get("/", async (request) => {
    const tasks = await prisma.task.findMany({
      where: { userId: request.userId },
      orderBy: [
        { done: "asc" },
        { priority: "asc" },
        { dueDate: { sort: "asc", nulls: "last" } },
        { createdAt: "asc" },
      ],
      include: { steps: { orderBy: { order: "asc" } } },
      take: 500,
    });
    return tasks.map(toTask);
  });

  app.post("/", async (request, reply) => {
    const body = parseOr400(createTaskSchema, request.body, reply);
    if (!body) return;
    const task = await prisma.task.create({
      data: {
        userId: request.userId,
        title: body.title,
        notes: body.notes ?? null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        priority: body.priority,
        color: body.color ?? null,
        estMinutes: body.estMinutes ?? null,
        reminderLead: body.reminderLead ?? null,
        repeat: body.repeat ?? null,
      },
      include: { steps: true },
    });
    reply.code(201);
    return toTask(task);
  });

  app.patch("/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(updateTaskSchema, request.body, reply);
    if (!body) return;

    const existing = await prisma.task.findFirst({
      where: { id: params.id, userId: request.userId },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    if (!existing) {
      reply.code(404).send({ error: "Not found" });
      return;
    }

    const task = await prisma.task.update({
      where: { id: existing.id },
      data: {
        title: body.title ?? undefined,
        notes: body.notes === undefined ? undefined : body.notes,
        dueDate:
          body.dueDate === undefined
            ? undefined
            : body.dueDate
              ? new Date(body.dueDate)
              : null,
        priority: body.priority ?? undefined,
        color: body.color === undefined ? undefined : body.color,
        estMinutes: body.estMinutes === undefined ? undefined : body.estMinutes,
        reminderLead:
          body.reminderLead === undefined ? undefined : body.reminderLead,
        repeat: body.repeat === undefined ? undefined : body.repeat,
        done: body.done ?? undefined,
        doneAt:
          body.done === undefined ? undefined : body.done ? new Date() : null,
        // Completing a task with a running focus timer banks the elapsed time.
        ...(body.done === true && existing.timerStartedAt
          ? {
              actualMinutes:
                (existing.actualMinutes ?? 0) +
                bankedMinutes(existing.timerStartedAt),
              timerStartedAt: null,
            }
          : {}),
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });

    // Completing a repeating task spawns its next occurrence (steps reset).
    if (body.done === true && !existing.done && existing.repeat) {
      await prisma.task.create({
        data: {
          userId: request.userId,
          title: existing.title,
          notes: existing.notes,
          dueDate: nextOccurrence(existing.dueDate ?? new Date(), existing.repeat),
          priority: existing.priority,
          color: existing.color,
          estMinutes: existing.estMinutes,
          reminderLead: existing.reminderLead,
          repeat: existing.repeat,
          steps: {
            create: existing.steps.map((s) => ({
              title: s.title,
              estMinutes: s.estMinutes,
              order: s.order,
            })),
          },
        },
      });
    }
    return toTask(task);
  });

  app.delete("/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const result = await prisma.task.deleteMany({
      where: { id: params.id, userId: request.userId },
    });
    if (result.count === 0) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    return { ok: true };
  });

  /* ----- Sub-steps ----- */

  // Returns the updated parent task (with its steps) so the UI stays in sync.
  async function taskWithSteps(taskId: string) {
    const t = await prisma.task.findUnique({
      where: { id: taskId },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    return t ? toTask(t) : null;
  }

  // ---- Focus timer ---------------------------------------------------------

  app.post("/:id/timer/start", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const task = await prisma.task.findFirst({
      where: { id: params.id, userId: request.userId, done: false },
    });
    if (!task) {
      reply.code(404).send({ error: "Task not found" });
      return;
    }
    // Only one timer at a time: stop any other running task first.
    const running = await prisma.task.findMany({
      where: {
        userId: request.userId,
        timerStartedAt: { not: null },
        id: { not: task.id },
      },
    });
    for (const r of running) {
      await prisma.task.update({
        where: { id: r.id },
        data: {
          actualMinutes:
            (r.actualMinutes ?? 0) + bankedMinutes(r.timerStartedAt as Date),
          timerStartedAt: null,
        },
      });
    }
    if (!task.timerStartedAt) {
      await prisma.task.update({
        where: { id: task.id },
        data: { timerStartedAt: new Date() },
      });
    }
    return taskWithSteps(task.id);
  });

  app.post("/:id/timer/stop", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const task = await prisma.task.findFirst({
      where: { id: params.id, userId: request.userId },
    });
    if (!task) {
      reply.code(404).send({ error: "Task not found" });
      return;
    }
    if (task.timerStartedAt) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          actualMinutes:
            (task.actualMinutes ?? 0) + bankedMinutes(task.timerStartedAt),
          timerStartedAt: null,
        },
      });
    }
    return taskWithSteps(task.id);
  });

  app.post("/:id/steps", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(createTaskStepSchema, request.body, reply);
    if (!body) return;
    const task = await prisma.task.findFirst({
      where: { id: params.id, userId: request.userId },
    });
    if (!task) {
      reply.code(404).send({ error: "Task not found" });
      return;
    }
    const count = await prisma.taskStep.count({ where: { taskId: task.id } });
    await prisma.taskStep.create({
      data: {
        taskId: task.id,
        title: body.title,
        estMinutes: body.estMinutes ?? null,
        order: count,
      },
    });
    reply.code(201);
    return taskWithSteps(task.id);
  });

  app.patch("/steps/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(updateTaskStepSchema, request.body, reply);
    if (!body) return;
    const step = await prisma.taskStep.findFirst({
      where: { id: params.id, task: { userId: request.userId } },
    });
    if (!step) {
      reply.code(404).send({ error: "Step not found" });
      return;
    }
    await prisma.taskStep.update({
      where: { id: step.id },
      data: {
        title: body.title ?? undefined,
        estMinutes: body.estMinutes === undefined ? undefined : body.estMinutes,
        done: body.done ?? undefined,
        doneAt:
          body.done === undefined ? undefined : body.done ? new Date() : null,
      },
    });
    return taskWithSteps(step.taskId);
  });

  app.delete("/steps/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const step = await prisma.taskStep.findFirst({
      where: { id: params.id, task: { userId: request.userId } },
    });
    if (!step) {
      reply.code(404).send({ error: "Step not found" });
      return;
    }
    await prisma.taskStep.delete({ where: { id: step.id } });
    return taskWithSteps(step.taskId);
  });
}
