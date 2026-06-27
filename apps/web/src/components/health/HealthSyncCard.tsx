import { AlertTriangle, Check, X } from "lucide-react";
import { useHealthSync } from "../../lib/queries";

const NAMES: Record<string, string> = {
  sleep_hours: "Sleep",
  resting_hr: "Resting HR",
  hrv: "HRV",
  steps: "Steps",
  active_energy: "Active energy",
};

function ago(iso: string | null): string {
  if (!iso) return "never";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Tells the user, from inside the app, exactly where the Apple Health bridge
 *  is breaking: token off, nothing arriving, or a specific metric missing. */
export function HealthSyncCard() {
  const { data } = useHealthSync();
  if (!data) return null;

  // #1 cause: the token isn't set, so the API 503s every sync.
  if (!data.configured) {
    return (
      <section className="rounded-2xl border border-bad/40 bg-bad/10 p-4">
        <div className="flex items-center gap-2 text-bad">
          <AlertTriangle className="h-4 w-4" strokeWidth={2.5} />
          <h2 className="text-sm font-semibold">Apple Health isn’t connected</h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-text">
          The API rejects every sync because{" "}
          <code className="text-muted">HEALTH_INGEST_TOKEN</code> isn’t set. Add
          it on the <span className="font-medium">API</span> service (Railway →
          Variables), then put the same token in your phone’s Health Auto Export
          automation.
        </p>
      </section>
    );
  }

  const anyData = data.lastSyncAt != null;
  const allToday = data.metrics.every((m) => m.today);
  const noneToday = data.metrics.every((m) => !m.today);
  const sleepMissing = data.metrics.find(
    (m) => m.type === "sleep_hours" && !m.today,
  );

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Apple Health sync
        </h2>
        <span
          className={`flex items-center gap-1.5 text-xs ${
            allToday ? "text-good" : anyData ? "text-warn" : "text-bad"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              allToday ? "bg-good" : anyData ? "bg-warn" : "bg-bad"
            }`}
          />
          {allToday ? "Up to date" : anyData ? "Partial" : "No data yet"}
        </span>
      </div>

      {!anyData ? (
        <p className="text-sm leading-relaxed text-text">
          Token is set, but no data has arrived. On your phone open Health Auto
          Export and check the automation’s URL (
          <code className="text-muted">…/api/ingest/health</code>) and token,
          then run it once.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {data.metrics.map((m) => (
              <div
                key={m.type}
                className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2"
              >
                {m.today ? (
                  <Check className="h-4 w-4 shrink-0 text-good" strokeWidth={2.5} />
                ) : (
                  <X className="h-4 w-4 shrink-0 text-muted" strokeWidth={2.5} />
                )}
                <span className="flex-1 text-sm text-text">
                  {NAMES[m.type] ?? m.type}
                </span>
                <span className="text-xs text-muted">
                  {m.today ? "today" : ago(m.lastAt)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            Last sync {ago(data.lastSyncAt)} · {data.total.toLocaleString()}{" "}
            readings stored.
            {noneToday &&
              " Nothing today yet — your automation may only run on a schedule."}
          </p>
          {sleepMissing && (
            <p className="mt-1 text-xs text-warn">
              No sleep today — enable “Sleep Analysis” in the export and confirm
              your watch tracked last night.
            </p>
          )}
        </>
      )}
    </section>
  );
}
