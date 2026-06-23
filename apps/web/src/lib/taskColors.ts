import type { TaskColor } from "@apex/shared";

export const TASK_COLORS: TaskColor[] = [
  "violet",
  "blue",
  "emerald",
  "amber",
  "rose",
  "slate",
];

export const TASK_COLOR_HEX: Record<TaskColor, string> = {
  violet: "#7c6bff",
  blue: "#4f8cff",
  emerald: "#34d399",
  amber: "#fbbf24",
  rose: "#fb7185",
  slate: "#64748b",
};

/** A task's accent colour, falling back to the neutral line colour. */
export function colorHex(c: TaskColor | null | undefined): string {
  return c ? TASK_COLOR_HEX[c] : "#2a2a3a";
}

export function estLabel(minutes: number | null | undefined): string | null {
  if (minutes == null || minutes <= 0) return null;
  if (minutes < 60) return `est. ${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `est. ${h}h${m ? ` ${m}m` : ""}`;
}
