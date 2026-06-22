import type { FastifyInstance } from "fastify";
import {
  type AiChatMessage,
  type AiText,
  chatInputSchema,
  reviewTypeSchema,
} from "@apex/shared";
import { prisma } from "../db";
import { type AiMessageParam, aiConfigured, runText } from "../lib/ai";
import {
  generateBriefing,
  generatePlan,
  generateReview,
  getArtifact,
} from "../lib/coach";
import { buildUserContext } from "../lib/context";
import { parseOr400 } from "../lib/http";
import { dayString, weekStartString } from "../lib/time";

function toChat(m: { id: string; role: string; content: string; createdAt: Date }): AiChatMessage {
  return {
    id: m.id,
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  };
}

export default async function aiRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  /* ----- Chat ----- */
  app.get("/chat", async (request) => {
    const msgs = await prisma.aiMessage.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    return { configured: aiConfigured(), messages: msgs.map(toChat) };
  });

  app.post("/chat", async (request, reply) => {
    const body = parseOr400(chatInputSchema, request.body, reply);
    if (!body) return;
    if (!aiConfigured()) {
      reply.code(503).send({ error: "AI is not configured (set ANTHROPIC_API_KEY)" });
      return;
    }
    await prisma.aiMessage.create({
      data: { userId: request.userId, role: "user", content: body.message },
    });

    const history = await prisma.aiMessage.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    const messages: AiMessageParam[] = history.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    const ctx = await buildUserContext(request.userId);
    let answer: string;
    try {
      answer = await runText({
        system:
          "You are Apex, the user's private life coach with full view of his data. " +
          "Answer his question or coach him using his real numbers below. Be concise, " +
          "practical, and specific. If he asks for a plan or advice, make it actionable.\n\n" +
          `=== His current data ===\n${ctx}`,
        messages,
        maxTokens: 1024,
        thinking: true,
      });
    } catch (err) {
      reply.code(502).send({
        error: err instanceof Error ? err.message : "AI request failed",
      });
      return;
    }

    const saved = await prisma.aiMessage.create({
      data: { userId: request.userId, role: "assistant", content: answer },
    });
    return toChat(saved);
  });

  /* ----- Briefing ----- */
  app.get("/briefing", async (request): Promise<AiText> => {
    const a = await getArtifact(request.userId, "briefing", dayString());
    return {
      configured: aiConfigured(),
      text: a?.content ?? "",
      generatedAt: a ? a.updatedAt.toISOString() : null,
    };
  });

  app.post("/briefing", async (request, reply): Promise<AiText | undefined> => {
    if (!aiConfigured()) {
      reply.code(503).send({ error: "AI is not configured" });
      return;
    }
    const { text, generatedAt } = await generateBriefing(request.userId);
    return { configured: true, text, generatedAt: generatedAt.toISOString() };
  });

  /* ----- Day plan (time-blocking) ----- */
  app.get("/plan", async (request): Promise<AiText> => {
    const a = await getArtifact(request.userId, "plan", dayString());
    return {
      configured: aiConfigured(),
      text: a?.content ?? "",
      generatedAt: a ? a.updatedAt.toISOString() : null,
    };
  });

  app.post("/plan", async (request, reply): Promise<AiText | undefined> => {
    if (!aiConfigured()) {
      reply.code(503).send({ error: "AI is not configured" });
      return;
    }
    const commitments = (request.body as { commitments?: string } | undefined)
      ?.commitments;
    const { text, generatedAt } = await generatePlan(request.userId, commitments);
    return { configured: true, text, generatedAt: generatedAt.toISOString() };
  });

  /* ----- Weekly reviews ----- */
  app.get("/review", async (request, reply): Promise<AiText | undefined> => {
    const type = reviewTypeSchema.safeParse(
      (request.query as Record<string, unknown> | undefined)?.type,
    );
    if (!type.success) {
      reply.code(400).send({ error: "type must be twinly|fitness|money" });
      return;
    }
    const a = await getArtifact(
      request.userId,
      `review:${type.data}`,
      weekStartString(),
    );
    return {
      configured: aiConfigured(),
      text: a?.content ?? "",
      generatedAt: a ? a.updatedAt.toISOString() : null,
    };
  });

  app.post("/review", async (request, reply): Promise<AiText | undefined> => {
    const type = reviewTypeSchema.safeParse(
      (request.query as Record<string, unknown> | undefined)?.type,
    );
    if (!type.success) {
      reply.code(400).send({ error: "type must be twinly|fitness|money" });
      return;
    }
    if (!aiConfigured()) {
      reply.code(503).send({ error: "AI is not configured" });
      return;
    }
    const { text, generatedAt } = await generateReview(request.userId, type.data);
    return { configured: true, text, generatedAt: generatedAt.toISOString() };
  });
}
