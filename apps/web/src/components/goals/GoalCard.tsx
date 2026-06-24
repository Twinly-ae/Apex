import { Check, ChevronDown, X } from "lucide-react";
import { useState } from "react";
import type { Goal, GoalPaceStatus } from "@apex/shared";
import {
  useAddMilestone,
  useDeleteGoal,
  useDeleteMilestone,
  useUpdateGoal,
  useUpdateMilestone,
} from "../../lib/queries";

const STATUS: Record<GoalPaceStatus, { label: string; cls: string }> = {
  ahead: { label: "Ahead", cls: "bg-good/15 text-good" },
  on_track: { label: "On track", cls: "bg-accent/15 text-accent" },
  behind: { label: "Behind", cls: "bg-warn/15 text-warn" },
  overdue: { label: "Overdue", cls: "bg-bad/15 text-bad" },
  done: { label: "Done", cls: "bg-good/15 text-good" },
};

export function GoalCard({ goal }: { goal: Goal }) {
  const addMilestone = useAddMilestone();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const [newMilestone, setNewMilestone] = useState("");
  const [open, setOpen] = useState(false);

  const status = STATUS[goal.pace.status];
  const days = goal.pace.daysRemaining;
  const ms = goal.milestones;
  const msDone = ms.filter((m) => m.done).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <button onClick={() => setOpen((o) => !o)} className="block w-full p-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-text">{goal.title}</h3>
            <p className="mt-0.5 text-xs text-muted">
              {goal.category} ·{" "}
              {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
              {ms.length > 0 && ` · ${msDone}/${ms.length} milestones`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${status.cls}`}>
              {status.label}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
          </div>
        </div>

        {/* Pace bar: fill = actual, marker = where you should be by now */}
        <div className="relative mt-3 h-2 rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${goal.pace.progressPct}%` }}
          />
          <div
            className="absolute top-[-2px] h-3 w-0.5 bg-muted"
            style={{ left: `${goal.pace.expectedPct}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted">
          {goal.pace.progressPct}% done · target pace {goal.pace.expectedPct}%
        </p>

        {goal.pace.nextStep && goal.status === "active" && (
          <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-sm text-text">
            <span className="text-muted">Next: </span>
            {goal.pace.nextStep}
          </p>
        )}
      </button>

      {/* Details — milestones, add, actions */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-line px-4 pb-4 pt-3">
            {ms.length > 0 && (
              <ul className="space-y-1.5">
                {ms.map((m) => (
                  <li key={m.id} className="flex items-center gap-2.5 text-sm">
                    <button
                      aria-label="Toggle milestone"
                      onClick={() =>
                        updateMilestone.mutate({
                          id: m.id,
                          input: { done: !m.done },
                        })
                      }
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 active:scale-90 ${
                        m.done ? "border-good bg-good/20 text-good" : "border-line"
                      }`}
                    >
                      {m.done && <Check className="h-3 w-3" strokeWidth={3} />}
                    </button>
                    <span
                      className={m.done ? "flex-1 text-muted line-through" : "flex-1 text-text"}
                    >
                      {m.title}
                    </span>
                    <button
                      onClick={() => deleteMilestone.mutate(m.id)}
                      className="text-muted hover:text-bad"
                      aria-label="Delete milestone"
                    >
                      <X className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newMilestone.trim()) return;
                addMilestone.mutate({
                  goalId: goal.id,
                  input: { title: newMilestone.trim() },
                });
                setNewMilestone("");
              }}
              className="mt-2 flex gap-2"
            >
              <input
                value={newMilestone}
                onChange={(e) => setNewMilestone(e.target.value)}
                placeholder="Add a milestone…"
                className="flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="rounded-lg bg-surface-2 px-3 text-sm text-accent active:opacity-80"
              >
                Add
              </button>
            </form>

            <div className="mt-3 flex gap-4 text-xs">
              {goal.status === "active" ? (
                <button
                  onClick={() =>
                    updateGoal.mutate({ id: goal.id, input: { status: "done" } })
                  }
                  className="text-good"
                >
                  Mark done
                </button>
              ) : (
                <button
                  onClick={() =>
                    updateGoal.mutate({ id: goal.id, input: { status: "active" } })
                  }
                  className="text-accent"
                >
                  Reopen
                </button>
              )}
              <button
                onClick={() => deleteGoal.mutate(goal.id)}
                className="ml-auto text-muted hover:text-bad"
              >
                Delete goal
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
