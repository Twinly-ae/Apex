import { type FormEvent, useEffect, useRef, useState } from "react";
import { useAiChat, useSendChat } from "../lib/queries";

const SUGGESTIONS = [
  "Plan my day to maximize my time",
  "How am I tracking on my recomp this week?",
  "What should I focus on for Twinly?",
  "Where can I cut spending to hit my savings goal?",
];

export function Coach() {
  const { data } = useAiChat();
  const send = useSendChat();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const messages = data?.messages ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, send.isPending]);

  async function submit(message: string) {
    const m = message.trim();
    if (!m || send.isPending) return;
    setText("");
    setError(null);
    try {
      await send.mutateAsync(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coach is unavailable.");
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col">
      <h1 className="mb-3 font-display text-[26px] font-bold leading-tight tracking-tight text-text">Coach</h1>

      {data && !data.configured && (
        <p className="mb-3 rounded-xl border border-line bg-surface p-3 text-sm text-muted">
          Set <code className="text-text">ANTHROPIC_API_KEY</code> on the API to
          enable your AI coach — it can see all your data and answer questions or
          coach you.
        </p>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <div className="space-y-3 pt-4">
            <p className="text-sm text-muted">
              Ask me anything — I can see your day, goals, training, and money.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-full border border-line bg-surface px-3 py-2 text-left text-sm text-text active:bg-surface-2"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-accent text-white"
                  : "border border-line bg-surface text-text"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {send.isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm text-muted">
              Thinking…
            </div>
          </div>
        )}
        {error && <p className="text-sm text-bad">{error}</p>}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void submit(text);
        }}
        className="sticky bottom-24 flex gap-2 rounded-2xl bg-bg/95 py-2 backdrop-blur"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message your coach…"
          disabled={data ? !data.configured : false}
          className="flex-1 rounded-xl border border-line bg-surface-2 px-4 py-3 text-text outline-none focus:border-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!text.trim() || send.isPending}
          className="rounded-xl bg-accent px-4 font-semibold text-white active:opacity-80 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
