import {
  ArrowUp,
  Dumbbell,
  History,
  type LucideIcon,
  PiggyBank,
  Sparkles,
  SquarePen,
  Sun,
  Target,
  Trash2,
} from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  useAiChat,
  useConversations,
  useDeleteConversation,
  useNewConversation,
  useSendChat,
} from "../lib/queries";
import { Sheet } from "../components/ui/Sheet";

const SUGGESTIONS: { icon: LucideIcon; label: string; prompt: string }[] = [
  { icon: Sun, label: "Plan my day", prompt: "Plan my day to maximize my time" },
  {
    icon: Dumbbell,
    label: "Recomp check-in",
    prompt: "How am I tracking on my recomp this week?",
  },
  {
    icon: Target,
    label: "Twinly focus",
    prompt: "What should I focus on for Twinly?",
  },
  {
    icon: PiggyBank,
    label: "Cut spending",
    prompt: "Where can I cut spending to hit my savings goal?",
  },
];

function when(iso: string): string {
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function CoachAvatar({ size = "h-8 w-8" }: { size?: string }) {
  return (
    <span
      className={`grid ${size} shrink-0 place-items-center rounded-full border border-white/10 bg-gradient-to-br from-accent to-accent-strong text-white shadow-glow`}
    >
      <Sparkles className="h-[55%] w-[55%]" strokeWidth={2.2} />
    </span>
  );
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
      {/* Sticky header — New chat & History always reachable */}
      <header
        className="sticky z-20 -mx-4 mb-2 flex items-center justify-between gap-2 bg-bg/90 px-4 py-2.5 backdrop-blur-lg"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <CoachAvatar />
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold leading-tight tracking-tight text-text">
              Coach
            </h1>
            <p className="truncate text-[11px] text-muted">
              Sees your day, training, food &amp; money
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
            aria-label="New chat"
            className="pressable grid h-9 w-9 place-items-center rounded-full border border-accent/40 bg-accent/10 text-accent disabled:opacity-50"
          >
            <SquarePen className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>
      </header>

      {data && !data.configured && (
        <p className="mb-3 rounded-xl border border-line bg-surface p-3 text-sm text-muted">
          Set <code className="text-text">ANTHROPIC_API_KEY</code> on the API to
          enable your AI coach.
        </p>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {/* Empty state — hero + suggestion cards */}
        {messages.length === 0 && !pending && (
          <div className="pt-10 text-center">
            <div className="mx-auto w-fit">
              <CoachAvatar size="h-16 w-16" />
            </div>
            <h2 className="mt-4 font-display text-xl font-bold tracking-tight text-text">
              What's on your mind?
            </h2>
            <p className="mx-auto mt-1 max-w-[260px] text-sm text-muted">
              Your coach knows today's numbers — ask anything or start with one
              of these.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2.5 text-left">
              {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
                <button
                  key={label}
                  onClick={() => submit(prompt)}
                  className="pressable rounded-2xl border border-line bg-surface p-3.5"
                >
                  <Icon className="h-5 w-5 text-accent" strokeWidth={2} />
                  <div className="mt-2 text-sm font-semibold text-text">
                    {label}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-muted">
                    {prompt}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-accent to-accent-strong px-4 py-2.5 text-sm leading-relaxed text-white">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex items-end gap-2">
              <CoachAvatar size="h-6 w-6" />
              <div className="max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-2.5 text-sm leading-relaxed text-text">
                {m.content}
              </div>
            </div>
          ),
        )}

        {pending && (
          <>
            <div className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-accent to-accent-strong px-4 py-2.5 text-sm leading-relaxed text-white opacity-80">
                {pending}
              </div>
            </div>
            <div className="flex items-end gap-2">
              <CoachAvatar size="h-6 w-6" />
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:0.12s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:0.24s]" />
              </div>
            </div>
          </>
        )}
        {error && <p className="text-sm text-bad">{error}</p>}
        <div ref={endRef} />
      </div>

      {/* Composer — floating pill above the nav */}
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void submit(text);
        }}
        className="sticky bottom-24 py-1"
      >
        <div className="flex items-center gap-1.5 rounded-full border border-line bg-surface/95 p-1.5 pl-4 shadow-float backdrop-blur-xl">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask your coach…"
            disabled={data ? !data.configured : false}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-text placeholder:text-muted/70 outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!text.trim() || send.isPending}
            className="pressable grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-white shadow-glow disabled:opacity-40 disabled:shadow-none"
          >
            <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </button>
        </div>
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
            <p className="py-3 text-center text-sm text-muted">No chats yet.</p>
          ) : (
            (convos ?? []).map((c) => {
              const active = c.id === (activeId ?? data?.conversationId);
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 rounded-2xl border p-1.5 pl-3.5 ${
                    active
                      ? "border-accent/40 bg-accent/10"
                      : "border-line bg-surface-2"
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
                    <div className="text-[11px] text-muted">
                      {when(c.updatedAt)}
                    </div>
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
