import type { FastifyInstance, FastifyReply } from "fastify";
import {
  type AiChatMessage,
  type AiText,
  chatInputSchema,
  reviewTypeSchema,
} from "@apex/shared";
import { prisma } from "../db";
import {
  type AiMessageParam,
  aiConfigured,
  aiErrorMessage,
  runAgent,
} from "../lib/ai";
import { COACH_TOOLS, executeCoachTool } from "../lib/coachTools";
import {
  generateBriefing,
  generateHealthTips,
  generatePaymentsReview,
  generatePlan,
  generateReview,
  getArtifact,
  personaFor,
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

/** Run an AI generation, surfacing the real reason (credits/key/etc.) on failure. */
async function runAi<T>(
  reply: FastifyReply,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    reply.log.error({ err }, "AI generation failed");
    reply.code(502).send({ error: aiErrorMessage(err) });
    return undefined;
  }
}

export default async function aiRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  /* ----- Chat (threaded) ----- */

  // List conversations, most recent first.
  app.get("/chat/conversations", async (request) => {
    const rows = await prisma.aiConversation.findMany({
      where: { userId: request.userId },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    return rows.map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt.toISOString(),
    }));
  });

  // Start a fresh thread.
  app.post("/chat/conversations", async (request, reply) => {
    const c = await prisma.aiConversation.create({
      data: { userId: request.userId },
    });
    reply.code(201);
    return { id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString() };
  });

  app.delete("/chat/conversations/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const result = await prisma.aiConversation.deleteMany({
      where: { id, userId: request.userId },
    });
    if (result.count === 0) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    return { ok: true };
  });

  // Messages of a thread (defaults to the most recent thread).
  app.get("/chat", async (request) => {
    const q = (request.query as Record<string, unknown> | undefined)
      ?.conversationId;
    const conversation =
      typeof q === "string" && q
        ? await prisma.aiConversation.findFirst({
            where: { id: q, userId: request.userId },
          })
        : await prisma.aiConversation.findFirst({
            where: { userId: request.userId },
            orderBy: { updatedAt: "desc" },
          });
    const msgs = conversation
      ? await prisma.aiMessage.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: "asc" },
          take: 200,
        })
      : [];
    return {
      configured: aiConfigured(),
      conversationId: conversation?.id ?? null,
      messages: msgs.map(toChat),
    };
  });

  app.post("/chat", async (request, reply) => {
    const body = parseOr400(chatInputSchema, request.body, reply);
    if (!body) return;
    if (!aiConfigured()) {
      reply.code(503).send({ error: "AI is not configured (set ANTHROPIC_API_KEY)" });
      return;
    }

    // Resolve (or create) the thread this message belongs to.
    let conversation = body.conversationId
      ? await prisma.aiConversation.findFirst({
          where: { id: body.conversationId, userId: request.userId },
        })
      : null;
    if (!conversation) {
      conversation = await prisma.aiConversation.create({
        data: { userId: request.userId },
      });
    }

    await prisma.aiMessage.create({
      data: {
        userId: request.userId,
        conversationId: conversation.id,
        role: "user",
        content: body.message,
      },
    });

    const history = await prisma.aiMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const messages: AiMessageParam[] = history.reverse().map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    const result = await runAi(reply, async () => {
      const [ctx, persona] = await Promise.all([
        buildUserContext(request.userId),
        personaFor(request.userId),
      ]);
      return runAgent({
        system:
          `${persona}\n\nCoach him using his real numbers below.\n\n` +
          "How to reply:\n" +
          "- Before answering, check: do you know enough for the answer to actually help him? " +
          "If his request is vague or missing one detail that changes the answer (which goal, " +
          "how much time, how he feels, what budget), ask ONE short question instead of guessing. " +
          "Never stack questions — one at a time.\n" +
          "- If his data below already answers it, just answer. Don't ask what you already know.\n" +
          "- Keep it SHORT: 1–4 plain sentences, or up to 4 tight bullets. Simple everyday words, " +
          "no jargon, no filler, no lectures.\n" +
          "- Every reply must end with something he can act on — a number, a step, or the one question.\n" +
          "- Go longer only when he explicitly asks for a full plan or details.\n\n" +
          "You can ACT for him with your tools — when he asks to add, log, or track something " +
          "(a task, meal, water, weight, his status, a Notion expense), call the matching tool " +
          "instead of giving instructions, then confirm what you did in one short line. " +
          "If a required detail is missing (like an amount), ask for it in one short question " +
          "instead of inventing it. If a tool errors, tell him honestly what failed.\n\n" +
          `=== His current data ===\n${ctx}`,
        messages,
        tools: COACH_TOOLS,
        execute: (name, input) => executeCoachTool(request.userId, name, input),
        maxTokens: 1024,
      });
    });
    if (result === undefined) return;
    const answer = result.text || result.actions.join("\n") || "Done.";

    const saved = await prisma.aiMessage.create({
      data: {
        userId: request.userId,
        conversationId: conversation.id,
        role: "assistant",
        content: answer,
      },
    });
    // Title new threads from their first message; bump recency either way.
    await prisma.aiConversation.update({
      where: { id: conversation.id },
      data: {
        updatedAt: new Date(),
        ...(conversation.title === "New chat"
          ? {
              title:
                body.message.length > 42
                  ? `${body.message.slice(0, 42)}…`
                  : body.message,
            }
          : {}),
      },
    });
    return { ...toChat(saved), conversationId: conversation.id };
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
    const r = await runAi(reply, () => generateBriefing(request.userId));
    if (!r) return;
    return { configured: true, text: r.text, generatedAt: r.generatedAt.toISOString() };
  });

  /* ----- Health tips (recovery / sleep / stress) ----- */
  app.get("/health-tips", async (request): Promise<AiText> => {
    const a = await getArtifact(request.userId, "health-tips", dayString());
    return {
      configured: aiConfigured(),
      text: a?.content ?? "",
      generatedAt: a ? a.updatedAt.toISOString() : null,
    };
  });

  app.post("/health-tips", async (request, reply): Promise<AiText | undefined> => {
    if (!aiConfigured()) {
      reply.code(503).send({ error: "AI is not configured" });
      return;
    }
    const r = await runAi(reply, () => generateHealthTips(request.userId));
    if (!r) return;
    return { configured: true, text: r.text, generatedAt: r.generatedAt.toISOString() };
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
    const r = await runAi(reply, () => generatePlan(request.userId, commitments));
    if (!r) return;
    return { configured: true, text: r.text, generatedAt: r.generatedAt.toISOString() };
  });

  /* ----- Monthly payments review ----- */
  app.get("/payments-review", async (request): Promise<AiText> => {
    const a = await getArtifact(
      request.userId,
      "payments-review",
      dayString().slice(0, 7),
    );
    return {
      configured: aiConfigured(),
      text: a?.content ?? "",
      generatedAt: a ? a.updatedAt.toISOString() : null,
    };
  });

  app.post("/payments-review", async (request, reply): Promise<AiText | undefined> => {
    if (!aiConfigured()) {
      reply.code(503).send({ error: "AI is not configured" });
      return;
    }
    const r = await runAi(reply, () => generatePaymentsReview(request.userId));
    if (!r) return;
    return { configured: true, text: r.text, generatedAt: r.generatedAt.toISOString() };
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
    const r = await runAi(reply, () => generateReview(request.userId, type.data));
    if (!r) return;
    return { configured: true, text: r.text, generatedAt: r.generatedAt.toISOString() };
  });
}
