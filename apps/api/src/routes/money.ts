import type { FastifyInstance } from "fastify";
import {
  createAccountSchema,
  createPositionSchema,
  idParamSchema,
  type NetWorthResponse,
  updateAccountSchema,
  updatePositionSchema,
} from "@apex/shared";
import { prisma } from "../db";
import { parseOr400 } from "../lib/http";
import { loadAccounts, netWorthTotal, recordSnapshot } from "../lib/money";

export default async function moneyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  // GET /api/money -> net worth total + accounts + history
  app.get("/", async (request): Promise<NetWorthResponse> => {
    const userId = request.userId;
    const [accounts, snapshots] = await Promise.all([
      loadAccounts(userId),
      prisma.netWorthSnapshot.findMany({
        where: { userId },
        orderBy: { day: "asc" },
        take: 180,
      }),
    ]);
    return {
      totalAed: netWorthTotal(accounts),
      accounts,
      history: snapshots.map((s) => ({ day: s.day, totalAed: s.totalAed })),
    };
  });

  app.post("/accounts", async (request, reply) => {
    const body = parseOr400(createAccountSchema, request.body, reply);
    if (!body) return;
    const count = await prisma.account.count({ where: { userId: request.userId } });
    await prisma.account.create({
      data: {
        userId: request.userId,
        name: body.name,
        type: body.type,
        provider: body.provider ?? null,
        balanceAed: body.balanceAed,
        sortOrder: count,
      },
    });
    await recordSnapshot(request.userId);
    reply.code(201);
    return loadAccounts(request.userId);
  });

  app.patch("/accounts/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(updateAccountSchema, request.body, reply);
    if (!body) return;
    const existing = await prisma.account.findFirst({
      where: { id: params.id, userId: request.userId },
    });
    if (!existing) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    await prisma.account.update({
      where: { id: existing.id },
      data: {
        name: body.name ?? undefined,
        type: body.type ?? undefined,
        provider: body.provider === undefined ? undefined : body.provider,
        balanceAed: body.balanceAed ?? undefined,
        sortOrder: body.sortOrder ?? undefined,
      },
    });
    await recordSnapshot(request.userId);
    return loadAccounts(request.userId);
  });

  app.delete("/accounts/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const result = await prisma.account.deleteMany({
      where: { id: params.id, userId: request.userId },
    });
    if (result.count === 0) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    await recordSnapshot(request.userId);
    return loadAccounts(request.userId);
  });

  // ---- Positions (ownership verified through the parent account) ----------
  app.post("/accounts/:id/positions", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(createPositionSchema, request.body, reply);
    if (!body) return;
    const account = await prisma.account.findFirst({
      where: { id: params.id, userId: request.userId },
    });
    if (!account) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    await prisma.position.create({
      data: { accountId: account.id, name: body.name, valueAed: body.valueAed },
    });
    await recordSnapshot(request.userId);
    reply.code(201);
    return loadAccounts(request.userId);
  });

  app.patch("/positions/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(updatePositionSchema, request.body, reply);
    if (!body) return;
    const position = await prisma.position.findUnique({
      where: { id: params.id },
      include: { account: { select: { userId: true } } },
    });
    if (!position || position.account.userId !== request.userId) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    await prisma.position.update({
      where: { id: position.id },
      data: {
        name: body.name ?? undefined,
        valueAed: body.valueAed ?? undefined,
      },
    });
    await recordSnapshot(request.userId);
    return loadAccounts(request.userId);
  });

  app.delete("/positions/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const position = await prisma.position.findUnique({
      where: { id: params.id },
      include: { account: { select: { userId: true } } },
    });
    if (!position || position.account.userId !== request.userId) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    await prisma.position.delete({ where: { id: position.id } });
    await recordSnapshot(request.userId);
    return loadAccounts(request.userId);
  });
}
