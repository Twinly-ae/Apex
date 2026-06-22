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
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="🏃"
            className={`${inputClass} w-16 text-center`}
            maxLength={2}
          />
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Read 20 min"
            className={inputClass}
          />
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
