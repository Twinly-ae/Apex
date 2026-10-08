import type { FastifyInstance } from "fastify";
import {
  createCourseSchema,
  createUniItemSchema,
  idParamSchema,
  setUniItemDoneSchema,
  type Course,
  type UniItem,
} from "@apex/shared";
import { prisma } from "../db";
import { parseOr400 } from "../lib/http";

function serializeItem(item: {
  id: string; courseId: string; kind: string; title: string;
  dueAt: Date | null; weekday: number | null; startTime: string | null;
  endTime: string | null; location: string | null; notes: string | null; done: boolean;
}): UniItem {
  return {
    id: item.id, courseId: item.courseId, kind: item.kind as UniItem["kind"],
    title: item.title, dueAt: item.dueAt?.toISOString() ?? null,
    weekday: item.weekday, startTime: item.startTime, endTime: item.endTime,
    location: item.location, notes: item.notes, done: item.done,
  };
}

export default async function uniRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/courses", async (request): Promise<Course[]> => {
    const courses = await prisma.course.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: "asc" },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    return courses.map((course) => ({
      id: course.id,
      name: course.name,
      code: course.code,
      items: course.items.map(serializeItem),
    }));
  });

  app.post("/courses", async (request, reply) => {
    const body = parseOr400(createCourseSchema, request.body, reply);
    if (!body) return;
    const course = await prisma.course.create({
      data: { userId: request.userId, name: body.name, code: body.code ?? null },
    });
    reply.code(201);
    return { id: course.id, name: course.name, code: course.code, items: [] };
  });

  app.delete("/courses/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const result = await prisma.course.deleteMany({
      where: { id: params.id, userId: request.userId },
    });
    if (!result.count) return reply.code(404).send({ error: "Course not found" });
    return { ok: true };
  });

  app.post("/items", async (request, reply) => {
    const body = parseOr400(createUniItemSchema, request.body, reply);
    if (!body) return;
    const course = await prisma.course.findFirst({
      where: { id: body.courseId, userId: request.userId },
      select: { id: true },
    });
    if (!course) return reply.code(404).send({ error: "Course not found" });
    const item = await prisma.uniItem.create({
      data: {
        courseId: course.id, kind: body.kind, title: body.title,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        weekday: body.weekday ?? null, startTime: body.startTime ?? null,
        endTime: body.endTime ?? null, location: body.location ?? null,
        notes: body.notes ?? null,
      },
    });
    reply.code(201);
    return serializeItem(item);
  });

  app.patch("/items/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(setUniItemDoneSchema, request.body, reply);
    if (!body) return;
    const item = await prisma.uniItem.findFirst({
      where: { id: params.id, course: { userId: request.userId } },
    });
    if (!item) return reply.code(404).send({ error: "Item not found" });
    if (item.kind === "class") return reply.code(400).send({ error: "Classes cannot be completed" });
    const updated = await prisma.uniItem.update({
      where: { id: item.id }, data: { done: body.done },
    });
    return serializeItem(updated);
  });

  app.delete("/items/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const item = await prisma.uniItem.findFirst({
      where: { id: params.id, course: { userId: request.userId } },
      select: { id: true },
    });
    if (!item) return reply.code(404).send({ error: "Item not found" });
    await prisma.uniItem.delete({ where: { id: item.id } });
    return { ok: true };
  });
}
