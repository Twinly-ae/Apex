import type { FastifyInstance } from "fastify";
import {
  type NotesResponse,
  createNoteSchema,
  idParamSchema,
  noteFolderSchema,
  updateNoteSchema,
} from "@apex/shared";
import { prisma } from "../db";
import { parseOr400 } from "../lib/http";

async function loadNotes(userId: string): Promise<NotesResponse> {
  const [folders, notes] = await Promise.all([
    prisma.noteFolder.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.note.findMany({
      where: { userId },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    }),
  ]);
  return {
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      emoji: f.emoji,
      sortOrder: f.sortOrder,
    })),
    notes: notes.map((n) => ({
      id: n.id,
      folderId: n.folderId,
      title: n.title,
      content: n.content,
      pinned: n.pinned,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    })),
  };
}

/** Resolve a folderId from the request body to one the user actually owns. */
async function ownFolderId(
  userId: string,
  folderId: string | null | undefined,
): Promise<string | null> {
  if (!folderId) return null;
  const f = await prisma.noteFolder.findFirst({ where: { id: folderId, userId } });
  return f ? f.id : null;
}

export default async function noteRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => loadNotes(request.userId));

  app.post("/", async (request, reply) => {
    const body = parseOr400(createNoteSchema, request.body, reply);
    if (!body) return;
    await prisma.note.create({
      data: {
        userId: request.userId,
        title: body.title.trim(),
        content: body.content ?? "",
        pinned: body.pinned ?? false,
        folderId: await ownFolderId(request.userId, body.folderId),
      },
    });
    reply.code(201);
    return loadNotes(request.userId);
  });

  app.patch("/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(updateNoteSchema, request.body, reply);
    if (!body) return;
    const note = await prisma.note.findFirst({
      where: { id: params.id, userId: request.userId },
    });
    if (!note) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    await prisma.note.update({
      where: { id: note.id },
      data: {
        ...(body.title !== undefined ? { title: body.title.trim() } : {}),
        ...(body.content !== undefined ? { content: body.content } : {}),
        ...(body.pinned !== undefined ? { pinned: body.pinned } : {}),
        ...(body.folderId !== undefined
          ? { folderId: await ownFolderId(request.userId, body.folderId) }
          : {}),
      },
    });
    return loadNotes(request.userId);
  });

  app.delete("/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const result = await prisma.note.deleteMany({
      where: { id: params.id, userId: request.userId },
    });
    if (result.count === 0) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    return loadNotes(request.userId);
  });

  /* ----- Sections ----- */

  app.post("/folders", async (request, reply) => {
    const body = parseOr400(noteFolderSchema, request.body, reply);
    if (!body) return;
    const last = await prisma.noteFolder.findFirst({
      where: { userId: request.userId },
      orderBy: { sortOrder: "desc" },
    });
    await prisma.noteFolder.create({
      data: {
        userId: request.userId,
        name: body.name.trim(),
        emoji: body.emoji?.trim() || null,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });
    reply.code(201);
    return loadNotes(request.userId);
  });

  app.patch("/folders/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(noteFolderSchema.partial(), request.body, reply);
    if (!body) return;
    const folder = await prisma.noteFolder.findFirst({
      where: { id: params.id, userId: request.userId },
    });
    if (!folder) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    await prisma.noteFolder.update({
      where: { id: folder.id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.emoji !== undefined ? { emoji: body.emoji?.trim() || null } : {}),
      },
    });
    return loadNotes(request.userId);
  });

  // Deleting a section keeps its notes (they fall back to "All").
  app.delete("/folders/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const result = await prisma.noteFolder.deleteMany({
      where: { id: params.id, userId: request.userId },
    });
    if (result.count === 0) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    return loadNotes(request.userId);
  });
}
