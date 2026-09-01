// Anthropic (Claude) wrapper — the ONLY place that talks to the AI, always
// server-side. Defaults to Opus 5 with adaptive thinking; effort is what we
// turn down for cheap extraction rather than switching thinking off (a
// thinking-disabled Opus 5 can write tool calls into visible text).
// Every feature checks aiConfigured() first and degrades gracefully.
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";

const MODEL = env.ANTHROPIC_MODEL || "claude-opus-5";

/** How hard Claude works on a call — see runText/runAgent for the mapping. */
type Effort = "low" | "medium" | "high" | "xhigh" | "max";

const THINKING = { type: "adaptive" } as const;

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
    max_tokens: 1024,
    output_config: { effort: "low" },
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
  /** true = a reasoning task (plans, reviews); false = cheap extraction. */
  thinking?: boolean;
  /** Overrides the effort `thinking` would pick. */
  effort?: Effort;
}

/** Reasoning tasks think hard; extraction stays cheap but never thinking-off. */
function effortFor(opts: RunOpts): Effort {
  if (opts.effort) return opts.effort;
  return opts.thinking === false ? "low" : "high";
}

export async function runText(opts: RunOpts): Promise<string> {
  const params = {
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    messages: opts.messages,
    thinking: THINKING,
    output_config: { effort: effortFor(opts) },
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
 * Text written in earlier rounds (e.g. a plan announced before adding its
 * tasks) is kept and joined into the final answer, not dropped.
 */
export async function runAgent(opts: {
  system: string;
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
  execute: (name: string, input: unknown) => Promise<string>;
  maxTokens?: number;
  effort?: Effort;
}): Promise<AgentResult> {
  const msgs: Anthropic.MessageParam[] = [...opts.messages];
  const actions: string[] = [];
  const texts: string[] = [];

  const collectText = (res: Anthropic.Message) => {
    const t = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (t) texts.push(t);
  };

  for (let round = 0; round < 10; round++) {
    const res = await getClient().messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 8192,
      system: opts.system,
      messages: msgs,
      tools: opts.tools,
      // Thinking blocks come back inside res.content and are pushed onto msgs
      // unchanged below, which is what the API requires across tool rounds.
      thinking: THINKING,
      output_config: { effort: opts.effort ?? "high" },
    });

    if (res.stop_reason === "tool_use") {
      collectText(res);
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

    collectText(res);
    return { text: texts.join("\n\n"), actions };
  }
  texts.push("(I hit my action limit for one message — some steps may not have completed.)");
  return { text: texts.join("\n\n"), actions };
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
