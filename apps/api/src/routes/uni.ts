import type { FastifyInstance } from "fastify";
import {
  createCourseSchema,
  createUniItemSchema,
  idParamSchema,
  updateCourseSchema,
  updateUniItemSchema,
  type Course,
  type UniItem,
} from "@apex/shared";
import { prisma } from "../db";
import { parseOr400 } from "../lib/http";

function serializeItem(item: {
  id: string; courseId: string; kind: string; title: string;
  dueAt: Date | null; weekday: number | null; startTime: string | null;
  endTime: string | null; location: string | null; notes: string | null;
  reminderLead: number | null; done: boolean;
}): UniItem {
  return {
    id: item.id, courseId: item.courseId, kind: item.kind as UniItem["kind"],
    title: item.title, dueAt: item.dueAt?.toISOString() ?? null,
    weekday: item.weekday, startTime: item.startTime, endTime: item.endTime,
    location: item.location, notes: item.notes,
    reminderLead: item.reminderLead, done: item.done,
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

  app.patch("/courses/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(updateCourseSchema, request.body, reply);
    if (!body) return;
    const result = await prisma.course.updateMany({
      where: { id: params.id, userId: request.userId },
      data: body,
    });
    if (!result.count) return reply.code(404).send({ error: "Course not found" });
    const course = await prisma.course.findUniqueOrThrow({
      where: { id: params.id },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    return {
      id: course.id, name: course.name, code: course.code,
      items: course.items.map(serializeItem),
    };
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
        reminderLead: body.reminderLead ?? null,
      },
    });
    reply.code(201);
    return serializeItem(item);
  });

  app.patch("/items/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(updateUniItemSchema, request.body, reply);
    if (!body) return;
    const item = await prisma.uniItem.findFirst({
      where: { id: params.id, course: { userId: request.userId } },
    });
    if (!item) return reply.code(404).send({ error: "Item not found" });
    if (item.kind === "class" && body.done !== undefined) {
      return reply.code(400).send({ error: "Classes cannot be completed" });
    }
    if (body.courseId && body.courseId !== item.courseId) {
      const course = await prisma.course.findFirst({
        where: { id: body.courseId, userId: request.userId }, select: { id: true },
      });
      if (!course) return reply.code(404).send({ error: "Course not found" });
    }
    const validated = createUniItemSchema.safeParse({
      courseId: body.courseId ?? item.courseId,
      kind: item.kind,
      title: body.title ?? item.title,
      dueAt: body.dueAt ?? item.dueAt?.toISOString() ?? undefined,
      weekday: body.weekday ?? item.weekday ?? undefined,
      startTime: body.startTime ?? item.startTime ?? undefined,
      endTime: body.endTime ?? item.endTime ?? undefined,
      location: body.location === undefined ? item.location : body.location,
      notes: body.notes === undefined ? item.notes : body.notes,
      reminderLead: body.reminderLead === undefined ? item.reminderLead : body.reminderLead,
    });
    if (!validated.success) {
      return reply.code(400).send({ error: validated.error.issues[0]?.message ?? "Invalid item" });
    }
    const change = validated.data;
    const updated = await prisma.uniItem.update({
      where: { id: item.id },
      data: {
        courseId: change.courseId,
        title: change.title,
        dueAt: change.dueAt ? new Date(change.dueAt) : null,
        weekday: change.weekday ?? null,
        startTime: change.startTime ?? null,
        endTime: change.endTime ?? null,
        location: change.location ?? null,
        notes: change.notes ?? null,
        reminderLead: change.reminderLead ?? null,
        ...(body.done === undefined ? {} : { done: body.done }),
      },
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
