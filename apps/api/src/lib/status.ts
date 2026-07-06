import type { ActivityStatus } from "@apex/shared";

export const STATUS_LABEL: Record<ActivityStatus, string> = {
  active: "active",
  sick: "sick — resting from illness",
  injured: "injured — recovering from an injury",
  break: "on a break from training",
};

/** Resolve the stored status, auto-expiring back to active after statusUntil. */
export function effectiveStatus(s: {
  activityStatus: string;
  statusUntil: Date | null;
}): { status: ActivityStatus; until: Date | null } {
  const status = (s.activityStatus as ActivityStatus) || "active";
  if (status !== "active" && s.statusUntil && s.statusUntil.getTime() < Date.now()) {
    return { status: "active", until: null };
  }
  return { status, until: status === "active" ? null : s.statusUntil };
}
