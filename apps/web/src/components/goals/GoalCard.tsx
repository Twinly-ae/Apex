import { Check, X } from "lucide-react";
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

  const status = STATUS[goal.pace.status];
  const days = goal.pace.daysRemaining;

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-text">{goal.title}</h3>
          <p className="mt-0.5 text-xs text-muted">
            {goal.category} ·{" "}
            {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${status.cls}`}
        >
          {status.label}
        </span>
      </div>

      {/* Pace bar: fill = actual progress, marker = where you should be by now */}
      <div className="relative mt-3 h-2 rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${goal.pace.progressPct}%` }}
        />
        <div
          className="absolute top-[-2px] h-3 w-0.5 bg-muted"
          style={{ left: `${goal.pace.expectedPct}%` }}
          title="Where you should be"
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

      {/* Milestones */}
      {goal.milestones.length > 0 && (
        <ul className="mt-3 space-y-1">
          {goal.milestones.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <button
                aria-label="Toggle milestone"
                onClick={() =>
                  updateMilestone.mutate({ id: m.id, input: { done: !m.done } })
                }
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                  m.done
                    ? "border-good bg-good/20 text-good"
                    : "border-line"
                }`}
              >
                {m.done && <Check className="h-3 w-3" strokeWidth={3} />}
              </button>
              <span className={m.done ? "text-muted line-through" : "text-text"}>
                {m.title}
              </span>
              <button
                onClick={() => deleteMilestone.mutate(m.id)}
                className="ml-auto text-muted hover:text-bad"
                aria-label="Delete milestone"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add milestone */}
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
          className="rounded-lg bg-surface-2 px-3 text-sm text-muted active:text-text"
        >
          +
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
  );
}
