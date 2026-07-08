// Anthropic (Claude) wrapper — the ONLY place that talks to the AI, always
// server-side. Defaults to claude-opus-4-8; adaptive thinking for reasoning
// tasks. Every feature checks aiConfigured() first and degrades gracefully.
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";

const MODEL = env.ANTHROPIC_MODEL || "claude-opus-4-8";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

export function aiConfigured(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

/** Validate the API key, model AND credit balance with a 1-token generation
 *  (a plain models.retrieve would miss a "credit balance too low" error). */
export async function pingAi(): Promise<void> {
  await getClient().messages.create({
    model: MODEL,
    max_tokens: 1,
    messages: [{ role: "user", content: "ping" }],
  });
}

/** Turn an Anthropic/SDK error into a short, user-actionable message. */
export function aiErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/credit balance is too low/i.test(raw))
    return "Anthropic credit balance is too low — add credits at console.anthropic.com, then try again.";
  if (/invalid x-api-key|authentication_error|\b401\b/i.test(raw))
    return "The ANTHROPIC_API_KEY on the API is invalid.";
  if (/rate.?limit|overloaded|\b429\b|\b529\b/i.test(raw))
    return "Claude is rate-limited or overloaded right now — try again in a moment.";
  if (/not_found_error|model/i.test(raw) && /model|not_found/i.test(raw))
    return `The configured model (${MODEL}) isn't available on this Anthropic account.`;
  return raw.slice(0, 240);
}

export type AiMessageParam = Anthropic.MessageParam;

interface RunOpts {
  system?: string;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
  /** Adaptive thinking for briefings/reviews/chat; off for fast extraction. */
  thinking?: boolean;
}

export async function runText(opts: RunOpts): Promise<string> {
  // NOTE: adaptive thinking would suit reasoning tasks, but the installed SDK
  // types only allow enabled/disabled; on Opus 4.8 omitting `thinking` runs
  // without extended thinking, which is fine here. (`opts.thinking` reserved
  // for when the SDK exposes adaptive.)
  const params = {
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    messages: opts.messages,
    ...(opts.system ? { system: opts.system } : {}),
  } satisfies Anthropic.MessageCreateParamsNonStreaming;

  const res = await getClient().messages.create(params);
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export interface AgentResult {
  text: string;
  /** Human-readable results of every tool action taken this turn. */
  actions: string[];
}

/**
 * Tool-use loop: lets Claude call app tools (log a meal, add a task, write a
 * Notion expense…) and keeps going until it produces a final text answer.
 */
export async function runAgent(opts: {
  system: string;
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
  execute: (name: string, input: unknown) => Promise<string>;
  maxTokens?: number;
}): Promise<AgentResult> {
  const msgs: Anthropic.MessageParam[] = [...opts.messages];
  const actions: string[] = [];

  for (let round = 0; round < 6; round++) {
    const res = await getClient().messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 1024,
      system: opts.system,
      messages: msgs,
      tools: opts.tools,
    });

    if (res.stop_reason === "tool_use") {
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type !== "tool_use") continue;
        let out: string;
        try {
          out = await opts.execute(block.name, block.input);
          actions.push(out);
        } catch (err) {
          out = `Error: ${err instanceof Error ? err.message : String(err)}`;
        }
        results.push({ type: "tool_result", tool_use_id: block.id, content: out });
      }
      msgs.push({ role: "assistant", content: res.content });
      msgs.push({ role: "user", content: results });
      continue;
    }

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { text, actions };
  }
  return {
    text: "I hit my action limit for one message — some steps may not have completed.",
    actions,
  };
}

/** Ask for JSON and parse it defensively (handles code fences / stray prose). */
export async function runJSON<T>(opts: RunOpts): Promise<T> {
  const text = await runText({ ...opts, thinking: false });
  return parseJsonLoose<T>(text);
}

function parseJsonLoose<T>(text: string): T {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const obj = cleaned.indexOf("{");
  const arr = cleaned.indexOf("[");
  let slice = cleaned;
  if (obj >= 0 && (arr < 0 || obj < arr)) {
    const end = cleaned.lastIndexOf("}");
    if (end > obj) slice = cleaned.slice(obj, end + 1);
  } else if (arr >= 0) {
    const end = cleaned.lastIndexOf("]");
    if (end > arr) slice = cleaned.slice(arr, end + 1);
  }
  return JSON.parse(slice) as T;
}

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export function imageMessage(
  text: string,
  dataBase64: string,
  mediaType: string,
): Anthropic.MessageParam {
  return {
    role: "user",
    content: [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: (mediaType as ImageMediaType) || "image/jpeg",
          data: dataBase64,
        },
      },
      { type: "text", text },
    ],
  };
}

export function pdfMessage(
  text: string,
  dataBase64: string,
): Anthropic.MessageParam {
  return {
    role: "user",
    content: [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: dataBase64 },
      },
      { type: "text", text },
    ],
  };
}
