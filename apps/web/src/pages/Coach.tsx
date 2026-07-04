import { History, SquarePen, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  useAiChat,
  useConversations,
  useDeleteConversation,
  useNewConversation,
  useSendChat,
} from "../lib/queries";
import { Sheet } from "../components/ui/Sheet";

const SUGGESTIONS = [
  "Plan my day to maximize my time",
  "How am I tracking on my recomp this week?",
  "What should I focus on for Twinly?",
  "Where can I cut spending to hit my savings goal?",
];

function when(iso: string): string {
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function Coach() {
  // null = the most recent thread (server default)
  const [activeId, setActiveId] = useState<string | null>(null);
  const { data } = useAiChat(activeId);
  const { data: convos } = useConversations();
  const send = useSendChat();
  const newConvo = useNewConversation();
  const delConvo = useDeleteConversation();

  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const messages = data?.messages ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, pending]);

  async function submit(message: string) {
    const m = message.trim();
    if (!m || send.isPending) return;
    setText("");
    setError(null);
    setPending(m);
    try {
      const res = await send.mutateAsync({
        message: m,
        conversationId: activeId ?? data?.conversationId ?? undefined,
      });
      // Pin the thread the server used so follow-ups stay in it.
      setActiveId(res.conversationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coach is unavailable.");
    } finally {
      setPending(null);
    }
  }

  async function startNewChat() {
    setError(null);
    const c = await newConvo.mutateAsync();
    setActiveId(c.id);
    setHistoryOpen(false);
  }

  return (
    <div className="flex min-h-[calc(100vh-11rem)] flex-col">
      <header className="sticky top-0 z-20 -mx-4 mb-3 flex items-center justify-between gap-2 bg-bg/90 px-4 py-2 backdrop-blur-lg">
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-text">
          Coach
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHistoryOpen(true)}
            aria-label="Chat history"
            className="pressable grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-muted"
          >
            <History className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
          <button
            onClick={startNewChat}
            disabled={newConvo.isPending}
            className="pressable flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent disabled:opacity-50"
          >
            <SquarePen className="h-4 w-4" strokeWidth={2} />
            New chat
          </button>
        </div>
      </header>

      {data && !data.configured && (
        <p className="mb-3 rounded-xl border border-line bg-surface p-3 text-sm text-muted">
          Set <code className="text-text">ANTHROPIC_API_KEY</code> on the API to
          enable your AI coach — it can see all your data and answer questions or
          coach you.
        </p>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {messages.length === 0 && !pending && (
          <div className="space-y-3 pt-4">
            <p className="text-sm text-muted">
              Ask me anything — I can see your day, goals, training, and money.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="pressable rounded-full border border-line bg-surface px-3 py-2 text-left text-sm text-text"
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

        {pending && (
          <>
            <div className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-accent px-4 py-2.5 text-sm leading-relaxed text-white opacity-80">
                {pending}
              </div>
            </div>
            <div className="flex justify-start">
              <div className="rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm text-muted">
                Thinking…
              </div>
            </div>
          </>
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
          className="pressable rounded-xl bg-accent px-4 font-semibold text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>

      {/* Chat history */}
      <Sheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="Chats">
        <div className="space-y-2">
          <button
            onClick={startNewChat}
            disabled={newConvo.isPending}
            className="pressable flex w-full items-center gap-2.5 rounded-2xl border border-accent/40 bg-accent/10 p-3.5 text-sm font-semibold text-accent disabled:opacity-50"
          >
            <SquarePen className="h-4 w-4" strokeWidth={2} />
            New chat
          </button>
          {(convos ?? []).length === 0 ? (
            <p className="py-3 text-center text-sm text-muted">
              No chats yet.
            </p>
          ) : (
            (convos ?? []).map((c) => {
              const active = c.id === (activeId ?? data?.conversationId);
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 rounded-2xl border p-1.5 pl-3.5 ${
                    active ? "border-accent/40 bg-accent/10" : "border-line bg-surface-2"
                  }`}
                >
                  <button
                    onClick={() => {
                      setActiveId(c.id);
                      setHistoryOpen(false);
                    }}
                    className="min-w-0 flex-1 py-2 text-left"
                  >
                    <div
                      className={`truncate text-sm font-medium ${
                        active ? "text-accent" : "text-text"
                      }`}
                    >
                      {c.title}
                    </div>
                    <div className="text-[11px] text-muted">{when(c.updatedAt)}</div>
                  </button>
                  <button
                    onClick={() => {
                      delConvo.mutate(c.id);
                      if (active) setActiveId(null);
                    }}
                    aria-label="Delete chat"
                    className="pressable grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted active:text-bad"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </Sheet>
    </div>
  );
}
