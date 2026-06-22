import { Check, Circle, Flame, X } from "lucide-react";
import type { Habit } from "@apex/shared";
import { useDeleteHabit, useToggleHabit } from "../lib/queries";

export function HabitsRow({
  habits,
  editable = false,
}: {
  habits: Habit[];
  editable?: boolean;
}) {
  const toggle = useToggleHabit();
  const del = useDeleteHabit();

  if (habits.length === 0) {
    return (
      <p className="text-sm text-muted">No habits yet — add one to build a streak.</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {habits.map((h) => (
        <div key={h.id} className="relative">
          <button
            onClick={() => toggle.mutate(h.id)}
            className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors ${
              h.doneToday
                ? "border-good bg-good/15 text-good"
                : "border-line bg-surface text-text"
            }`}
          >
            {h.emoji ? (
              <span>{h.emoji}</span>
            ) : h.doneToday ? (
              <Check className="h-4 w-4" strokeWidth={2.5} />
            ) : (
              <Circle className="h-4 w-4" strokeWidth={2} />
            )}
            <span>{h.name}</span>
            {h.streak > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-muted">
                <Flame className="h-3.5 w-3.5 text-warn" strokeWidth={2} />
                {h.streak}
              </span>
            )}
          </button>
          {editable && (
            <button
              onClick={() => del.mutate(h.id)}
              aria-label="Delete habit"
              className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-bad/80 text-white"
            >
              <X className="h-2.5 w-2.5" strokeWidth={3} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
