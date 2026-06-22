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
