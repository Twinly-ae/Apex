/**
 * Day-boundary helpers.
 *
 * The user is in Abu Dhabi (Asia/Dubai), which is a fixed UTC+4 with no DST,
 * so we can treat "today" as a fixed-offset window without a TZ library.
 * If Apex ever goes multi-timezone this is the single place to change.
 */
const TZ_OFFSET_MINUTES = 4 * 60; // Asia/Dubai

/** Start (inclusive) and end (exclusive) of the local day containing `date`. */
export function dayRange(date: Date = new Date()): { start: Date; end: Date } {
  const shifted = new Date(date.getTime() + TZ_OFFSET_MINUTES * 60_000);
  shifted.setUTCHours(0, 0, 0, 0);
  const start = new Date(shifted.getTime() - TZ_OFFSET_MINUTES * 60_000);
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  return { start, end };
}

/** Local calendar day as YYYY-MM-DD. */
export function dayString(date: Date = new Date()): string {
  const shifted = new Date(date.getTime() + TZ_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** Local hour (0–23), used to pick a greeting. */
export function localHour(date: Date = new Date()): number {
  const shifted = new Date(date.getTime() + TZ_OFFSET_MINUTES * 60_000);
  return shifted.getUTCHours();
}

/**
 * Fraction (0–1) of the current local day that has already elapsed. Used to
 * accrue resting/maintenance energy as the day passes instead of crediting a
 * full day's burn at midnight.
 */
export function localDayFraction(date: Date = new Date()): number {
  const { start, end } = dayRange(date);
  const f = (date.getTime() - start.getTime()) / (end.getTime() - start.getTime());
  return Math.max(0, Math.min(1, f));
}

/** Local weekday with Monday = 0 … Sunday = 6 (matches the training split). */
export function localWeekdayMon0(date: Date = new Date()): number {
  const shifted = new Date(date.getTime() + TZ_OFFSET_MINUTES * 60_000);
  return (shifted.getUTCDay() + 6) % 7;
}

/** The local day `n` days before `from` (n=0 → today). */
export function dayBefore(n: number, from: Date = new Date()): Date {
  return new Date(from.getTime() - n * 24 * 60 * 60_000);
}

/** Monday (local) of the week containing `date`, as a YYYY-MM-DD string. */
export function weekStartString(date: Date = new Date()): string {
  return dayString(dayBefore(localWeekdayMon0(date), date));
}

/** Parse a YYYY-MM-DD string into the local-day range, or today if absent. */
export function rangeForDayString(day?: string): { start: Date; end: Date } {
  if (!day) return dayRange();
  // Midnight local on that calendar day.
  const localMidnightUtc = new Date(`${day}T00:00:00.000Z`).getTime();
  const start = new Date(localMidnightUtc - TZ_OFFSET_MINUTES * 60_000);
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  return { start, end };
}
