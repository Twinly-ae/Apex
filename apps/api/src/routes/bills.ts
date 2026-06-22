import type { Bill as DbBill } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import {
  type Bill,
  type BillCadence,
  createBillSchema,
  idParamSchema,
  updateBillSchema,
} from "@apex/shared";
import { prisma } from "../db";
import { parseOr400 } from "../lib/http";

function toBill(b: DbBill): Bill {
  const days = Math.ceil(
    (b.nextDueDate.getTime() - Date.now()) / (24 * 60 * 60_000),
  );
  return {
    id: b.id,
    name: b.name,
    amountAed: b.amountAed,
    cadence: b.cadence as BillCadence,
    nextDueDate: b.nextDueDate.toISOString(),
    category: b.category,
    daysUntilDue: days,
  };
}

export default async function billRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const bills = await prisma.bill.findMany({
      where: { userId: request.userId },
      orderBy: { nextDueDate: "asc" },
    });
    return bills.map(toBill);
  });

  app.post("/", async (request, reply) => {
    const body = parseOr400(createBillSchema, request.body, reply);
    if (!body) return;
    const bill = await prisma.bill.create({
      data: {
        userId: request.userId,
        name: body.name,
        amountAed: body.amountAed,
        cadence: body.cadence,
        nextDueDate: new Date(body.nextDueDate),
        category: body.category ?? null,
      },
    });
    reply.code(201);
    return toBill(bill);
  });

  app.patch("/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOr400(updateBillSchema, request.body, reply);
    if (!body) return;
    const existing = await prisma.bill.findFirst({
      where: { id: params.id, userId: request.userId },
    });
    if (!existing) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    const bill = await prisma.bill.update({
      where: { id: existing.id },
      data: {
        name: body.name ?? undefined,
        amountAed: body.amountAed ?? undefined,
        cadence: body.cadence ?? undefined,
        nextDueDate: body.nextDueDate ? new Date(body.nextDueDate) : undefined,
        category: body.category === undefined ? undefined : body.category,
      },
    });
    return toBill(bill);
  });

  app.delete("/:id", async (request, reply) => {
    const params = parseOr400(idParamSchema, request.params, reply);
    if (!params) return;
    const result = await prisma.bill.deleteMany({
      where: { id: params.id, userId: request.userId },
    });
    if (result.count === 0) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    return { ok: true };
  });
}
