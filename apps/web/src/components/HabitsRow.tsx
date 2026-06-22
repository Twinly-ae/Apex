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
            <span>{h.emoji ?? (h.doneToday ? "✓" : "○")}</span>
            <span>{h.name}</span>
            {h.streak > 0 && (
              <span className="text-xs text-muted">🔥{h.streak}</span>
            )}
          </button>
          {editable && (
            <button
              onClick={() => del.mutate(h.id)}
              aria-label="Delete habit"
              className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-bad/80 text-[9px] text-white"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
