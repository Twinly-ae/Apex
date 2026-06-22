export function pct(consumed: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((consumed / target) * 100)));
}

export function round(n: number): number {
  return Math.round(n);
}

export function kg(n: number | null | undefined): string {
  return n == null ? "—" : `${n.toFixed(1)} kg`;
}

export function liters(ml: number): string {
  return `${(ml / 1000).toFixed(1)} L`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
