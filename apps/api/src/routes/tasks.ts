import type { FastifyInstance } from "fastify";
import {
  createTaskSchema,
  idParamSchema,
  updateTaskSchema,
} from "@apex/shared";
import { prisma } from "../db";
import { parseOr400 } from "../lib/http";
import { toTask } from "../lib/serializers";

export default async function taskRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  // Open tasks first, then recently completed. Ordering matches the UI:
  // not-done first, then by priority, then soonest due date.
  app.get("/", async (request) => {
    const tasks = await prisma.task.findMany({
      where: { userId: request.userId },
      orderBy: [
        { done: "asc" },
        { priority: "asc" },
        { dueDate: { sort: "asc", nulls: "last" } },
        { createdAt: "asc" },
      ],
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
      },
    });
    reply.code(201);
    return toTask(task);
  });

  app.patch("/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(updateTaskSchema, request.body, reply);
    if (!body) return;

    // Scope the update to this user so an unknown id can't touch other rows.
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
        done: body.done ?? undefined,
        doneAt:
          body.done === undefined
            ? undefined
            : body.done
              ? new Date()
              : null,
      },
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
}
