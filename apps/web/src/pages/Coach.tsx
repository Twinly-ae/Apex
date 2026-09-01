import {
  ArrowUp,
  BookmarkPlus,
  Brain,
  Dumbbell,
  History,
  type LucideIcon,
  PiggyBank,
  Plus,
  Sparkles,
  SquarePen,
  Sun,
  Target,
  Trash2,
} from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  useAddMemory,
  useAiChat,
  useConversations,
  useDeleteConversation,
  useDeleteMemory,
  useMemories,
  useMemorizeConversation,
  useNewConversation,
  useSendChat,
  useSettings,
  useUpdateSettings,
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

/** Editor for the agent's long-term memory + standing instructions. */
function MemorySheet({
  open,
  onClose,
  conversationId,
}: {
  open: boolean;
  onClose: () => void;
  conversationId: string | null;
}) {
  const { data: memories } = useMemories();
  const addMemory = useAddMemory();
  const delMemory = useDeleteMemory();
  const memorize = useMemorizeConversation();
  const { data: settings } = useSettings();
  const update = useUpdateSettings();

  const [draft, setDraft] = useState("");
  const [instructions, setInstructions] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [memorized, setMemorized] = useState<string | null>(null);
  const value = instructions ?? settings?.aiInstructions ?? "";

  async function memorizeChat() {
    if (!conversationId || memorize.isPending) return;
    setMemorized(null);
    try {
      const r = await memorize.mutateAsync(conversationId);
      setMemorized(
        r.saved.length === 0
          ? "Nothing new worth keeping — memory already covers this chat."
          : `Saved ${r.saved.length} fact${r.saved.length === 1 ? "" : "s"} from this chat ✓`,
      );
    } catch (err) {
      setMemorized(err instanceof Error ? err.message : "Couldn't save this chat.");
    }
  }

  async function addDraft() {
    const content = draft.trim();
    if (!content || addMemory.isPending) return;
    await addMemory.mutateAsync(content);
    setDraft("");
  }

  async function saveInstructions() {
    if (!settings) return;
    await update.mutateAsync({
      ...settings,
      aiInstructions: value.trim() || null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Sheet open={open} onClose={onClose} title="Memory & instructions">
      <div className="space-y-6">
        <section>
          <h3 className="text-sm font-semibold text-text">Instructions</h3>
          <p className="mb-2 mt-0.5 text-xs leading-relaxed text-muted">
            Standing rules Apex follows in every chat, briefing, plan and
            review.
          </p>
          <textarea
            value={value}
            onChange={(e) => {
              setInstructions(e.target.value);
              setSaved(false);
            }}
            rows={4}
            maxLength={2000}
            placeholder={
              "e.g.\n· Reply in Arabic\n· Be blunt, no fluff\n· Prioritise Twinly over everything"
            }
            className="w-full resize-none rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed text-text placeholder:text-muted/60 outline-none transition-colors focus:border-accent"
          />
          <button
            onClick={saveInstructions}
            disabled={update.isPending || !settings}
            className="mt-2 w-full rounded-xl bg-surface-2 px-4 py-2.5 text-sm font-medium text-text active:opacity-80 disabled:opacity-50"
          >
            {update.isPending ? "Saving…" : saved ? "Saved ✓" : "Save instructions"}
          </button>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-text">Memory</h3>
          <p className="mb-2 mt-0.5 text-xs leading-relaxed text-muted">
            Facts Apex keeps across every conversation. It saves things you tell
            it to remember — or add your own here.
          </p>
          <button
            onClick={() => void memorizeChat()}
            disabled={!conversationId || memorize.isPending}
            className="pressable mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm font-semibold text-accent disabled:opacity-50"
          >
            <BookmarkPlus className="h-4 w-4" strokeWidth={2} />
            {memorize.isPending
              ? "Reading the chat…"
              : "Save this chat to memory"}
          </button>
          {memorized && (
            <p className="mb-2 text-xs leading-relaxed text-muted">{memorized}</p>
          )}
          <div className="flex items-center gap-1.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addDraft();
                }
              }}
              maxLength={500}
              placeholder="Add a fact to remember…"
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-text placeholder:text-muted/60 outline-none transition-colors focus:border-accent"
            />
            <button
              onClick={() => void addDraft()}
              disabled={!draft.trim() || addMemory.isPending}
              aria-label="Add memory"
              className="pressable grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent/40 bg-accent/10 text-accent disabled:opacity-50"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
          <div className="mt-2.5 space-y-1.5">
            {(memories ?? []).length === 0 ? (
              <p className="py-2 text-center text-sm text-muted">
                Nothing remembered yet.
              </p>
            ) : (
              (memories ?? []).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 p-1.5 pl-3.5"
                >
                  <p className="min-w-0 flex-1 break-words py-1 text-sm leading-snug text-text">
                    {m.content}
                  </p>
                  <button
                    onClick={() => delMemory.mutate(m.id)}
                    aria-label="Forget"
                    className="pressable grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted active:text-bad"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </Sheet>
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
  const [memoryOpen, setMemoryOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messages = data?.messages ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, pending]);

  // Grow the composer with its content (up to ~5 lines, then scroll inside).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text]);

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
      setError(err instanceof Error ? err.message : "Apex is unavailable.");
    } finally {
      setPending(null);
    }
  }

  function onComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit(text);
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
      {/* Sticky header — Memory, History & New chat always reachable */}
      <header
        className="sticky z-20 -mx-4 mb-2 flex items-center justify-between gap-2 bg-bg/90 px-4 py-2.5 backdrop-blur-lg"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <CoachAvatar />
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold leading-tight tracking-tight text-text">
              Apex
            </h1>
            <p className="truncate text-[11px] text-muted">
              Your agent — sees &amp; acts on your whole day
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setMemoryOpen(true)}
            aria-label="Memory & instructions"
            className="pressable grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-muted"
          >
            <Brain className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
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
          enable Apex.
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
              What should I do for you?
            </h2>
            <p className="mx-auto mt-1 max-w-[260px] text-sm text-muted">
              Apex knows today's numbers and can act — add tasks, log food, plan
              your day. Ask, or tell it what to do.
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
              <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-gradient-to-br from-accent to-accent-strong px-4 py-2.5 text-sm leading-relaxed text-white">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex items-end gap-2">
              <CoachAvatar size="h-6 w-6" />
              <div className="max-w-[82%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-2.5 text-sm leading-relaxed text-text">
                {m.content}
              </div>
            </div>
          ),
        )}

        {pending && (
          <>
            <div className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-gradient-to-br from-accent to-accent-strong px-4 py-2.5 text-sm leading-relaxed text-white opacity-80">
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

      {/* Composer — floating pill that grows with the message */}
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void submit(text);
        }}
        className="sticky bottom-24 py-1"
      >
        <div className="flex items-end gap-1.5 rounded-[26px] border border-line bg-surface/95 p-1.5 pl-4 shadow-float backdrop-blur-xl">
          <textarea
            ref={inputRef}
            value={text}
            rows={1}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder="Ask Apex, or tell it what to do…"
            disabled={data ? !data.configured : false}
            className="max-h-[132px] min-w-0 flex-1 resize-none overflow-y-auto bg-transparent py-2 text-[15px] leading-snug text-text placeholder:text-muted/70 outline-none disabled:opacity-50"
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

      {/* Memory & instructions */}
      <MemorySheet
        open={memoryOpen}
        onClose={() => setMemoryOpen(false)}
        conversationId={activeId ?? data?.conversationId ?? null}
      />
    </div>
  );
}
