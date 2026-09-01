import { useState } from "react";
import { useAddHabit } from "../../lib/queries";
import { Sheet, inputClass, primaryButtonClass } from "../ui/Sheet";

export function HabitSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const add = useAddHabit();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");

  async function submit() {
    if (!name.trim()) return;
    await add.mutateAsync({ name: name.trim(), emoji: emoji.trim() || null });
    setName("");
    setEmoji("");
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="New habit">
      <div className="space-y-3">
        <div className="flex gap-2">
          {/* Plain classes, not inputClass: its w-full would beat w-16 and
              stretch this field across the row. */}
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="🏃"
            aria-label="Habit emoji"
            className="w-16 shrink-0 rounded-xl border border-line bg-surface-2 px-2 py-3 text-center text-text placeholder:text-muted/70 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
            maxLength={2}
          />
          <div className="min-w-0 flex-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Read 20 min"
              className={inputClass}
            />
          </div>
        </div>
        <button
          onClick={submit}
          disabled={add.isPending || !name.trim()}
          className={primaryButtonClass}
        >
          {add.isPending ? "Adding…" : "Add habit"}
        </button>
      </div>
    </Sheet>
  );
}
