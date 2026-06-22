import { useEffect, useState } from "react";
import { useTrainingPlan, useUpdateTrainingPlan } from "../lib/queries";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function TrainingPlanEditor() {
  const { data: plan } = useTrainingPlan();
  const update = useUpdateTrainingPlan();
  const [days, setDays] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (plan && !days) setDays(plan.days);
  }, [plan, days]);

  if (!days) {
    return <div className="h-24 animate-pulse rounded-xl bg-surface-2" />;
  }

  async function save() {
    if (!days) return;
    await update.mutateAsync({ days });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-1">
        {DAY_LABELS.map((label, i) => (
          <div key={label} className="text-center">
            <div className="mb-1 text-[10px] uppercase text-muted">{label}</div>
            <input
              value={days[i]}
              onChange={(e) =>
                setDays((d) =>
                  d ? d.map((v, idx) => (idx === i ? e.target.value : v)) : d,
                )
              }
              className="w-full rounded-lg border border-line bg-surface-2 px-1 py-2 text-center text-xs text-text outline-none focus:border-accent"
            />
          </div>
        ))}
      </div>
      <button
        onClick={save}
        disabled={update.isPending}
        className="mt-3 w-full rounded-xl bg-surface-2 px-4 py-2.5 text-sm font-medium text-text active:opacity-80"
      >
        {update.isPending ? "Saving…" : saved ? "Saved" : "Save plan"}
      </button>
    </div>
  );
}
