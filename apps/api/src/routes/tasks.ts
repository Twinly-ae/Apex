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
        done: body.done ?? undefined,
        doneAt:
          body.done === undefined ? undefined : body.done ? new Date() : null,
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });
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
      data: { taskId: task.id, title: body.title, order: count },
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
