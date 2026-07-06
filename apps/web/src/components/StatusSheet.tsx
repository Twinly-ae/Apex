import {
  Activity,
  Bandage,
  BedDouble,
  type LucideIcon,
  TreePalm,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { ActivityStatus } from "@apex/shared";
import { useSetActivityStatus } from "../lib/queries";
import { Sheet, primaryButtonClass, selectClass } from "./ui/Sheet";

export const STATUS_META: Record<
  ActivityStatus,
  { label: string; desc: string; icon: LucideIcon; color: string }
> = {
  active: {
    label: "Active",
    desc: "Training as planned",
    icon: Activity,
    color: "#34d399",
  },
  sick: {
    label: "Sick",
    desc: "Resting from illness",
    icon: BedDouble,
    color: "#fbbf24",
  },
  injured: {
    label: "Injured",
    desc: "Recovering from an injury",
    icon: Bandage,
    color: "#fb7185",
  },
  break: {
    label: "On a break",
    desc: "Taking time off from training",
    icon: TreePalm,
    color: "#4f8cff",
  },
};

const KEEP: { value: number | null; label: string }[] = [
  { value: 1, label: "Today only" },
  { value: 3, label: "3 days" },
  { value: 7, label: "1 week" },
  { value: null, label: "Until changed" },
];

/** Set the activity status — pauses training pressure and retunes the AI. */
export function StatusSheet({
  open,
  onClose,
  current,
}: {
  open: boolean;
  onClose: () => void;
  current: ActivityStatus;
}) {
  const setStatus = useSetActivityStatus();
  const [choice, setChoice] = useState<ActivityStatus>(current);
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setChoice(current);
      setDays(null);
    }
  }, [open, current]);

  async function update() {
    await setStatus.mutateAsync({ status: choice, days });
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Activity status">
      <div className="space-y-2.5">
        {(Object.keys(STATUS_META) as ActivityStatus[]).map((id) => {
          const m = STATUS_META[id];
          const Icon = m.icon;
          const selected = choice === id;
          return (
            <button
              key={id}
              onClick={() => setChoice(id)}
              className={`pressable flex w-full items-center gap-3.5 rounded-2xl border p-3.5 text-left ${
                selected ? "border-accent/50 bg-accent/10" : "border-line bg-surface-2"
              }`}
            >
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white"
                style={{
                  background: `linear-gradient(135deg, ${m.color}, ${m.color}cc)`,
                  boxShadow: `0 4px 16px -4px ${m.color}88`,
                }}
              >
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-text">{m.label}</span>
                <span className="block text-xs text-muted">{m.desc}</span>
              </span>
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                  selected ? "border-accent" : "border-line"
                }`}
              >
                {selected && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
              </span>
            </button>
          );
        })}

        {choice !== "active" && (
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 p-3.5">
            <span className="text-sm text-text">Keep status</span>
            <select
              value={days ?? ""}
              onChange={(e) =>
                setDays(e.target.value === "" ? null : Number(e.target.value))
              }
              className={`${selectClass} !w-40 !py-2 text-sm`}
            >
              {KEEP.map((k) => (
                <option key={k.label} value={k.value ?? ""}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          onClick={update}
          disabled={setStatus.isPending}
          className={primaryButtonClass}
        >
          {setStatus.isPending ? "Updating…" : "Update"}
        </button>
        {choice !== "active" && (
          <p className="text-center text-xs leading-relaxed text-muted">
            Training pressure pauses: no streak nudges, and the coach plans
            rest &amp; recovery instead of a gym session.
          </p>
        )}
      </div>
    </Sheet>
  );
}
