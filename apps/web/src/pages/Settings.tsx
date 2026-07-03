import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import type { NotificationPrefs, SettingsInput } from "@apex/shared";
import { ApiError, api } from "../lib/api";
import {
  currentSubscription,
  disablePush,
  enablePush,
  pushSupported,
} from "../lib/push";
import {
  useChangePassword,
  useCheckIntegrations,
  useIntegrationStatus,
  useInvalidatePushConfig,
  useLogout,
  useMe,
  useMetricsSummary,
  usePushConfig,
  useSendTestPush,
  useSettings,
  useUpdatePushPrefs,
  useUpdateSettings,
} from "../lib/queries";
import { inputClass, primaryButtonClass } from "../components/ui/Sheet";

const TARGET_FIELDS: {
  key: keyof Pick<
    SettingsInput,
    | "calorieTarget"
    | "proteinTarget"
    | "carbTarget"
    | "fatTarget"
    | "waterTargetMl"
    | "maintenanceCalories"
  >;
  label: string;
  suffix: string;
}[] = [
  { key: "calorieTarget", label: "Calories", suffix: "kcal" },
  { key: "proteinTarget", label: "Protein", suffix: "g" },
  { key: "carbTarget", label: "Carbs", suffix: "g" },
  { key: "fatTarget", label: "Fat", suffix: "g" },
  { key: "waterTargetMl", label: "Water", suffix: "ml" },
  { key: "maintenanceCalories", label: "Maintenance", suffix: "kcal" },
];

function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TargetsCard() {
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const [form, setForm] = useState<SettingsInput | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings && !form) {
      setForm({
        calorieTarget: settings.calorieTarget,
        proteinTarget: settings.proteinTarget,
        carbTarget: settings.carbTarget,
        fatTarget: settings.fatTarget,
        waterTargetMl: settings.waterTargetMl,
        maintenanceCalories: settings.maintenanceCalories,
        heightCm: settings.heightCm,
        weightUnit: settings.weightUnit,
      });
    }
  }, [settings, form]);

  if (!form) {
    return (
      <Card title="Daily targets">
        <div className="h-24 animate-pulse rounded-xl bg-surface-2" />
      </Card>
    );
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    await update.mutateAsync(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <Card title="Daily targets">
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {TARGET_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-xs text-muted">
                {f.label} ({f.suffix})
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={form[f.key]}
                onChange={(e) =>
                  setForm({ ...form, [f.key]: Number(e.target.value) })
                }
                className={inputClass}
              />
            </label>
          ))}
        </div>
        <button
          type="submit"
          disabled={update.isPending}
          className={primaryButtonClass}
        >
          {update.isPending ? "Saving…" : saved ? "Saved" : "Save targets"}
        </button>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next });
      setMsg({ ok: true, text: "Password updated." });
      setCurrent("");
      setNext("");
    } catch (err) {
      setMsg({
        ok: false,
        text: err instanceof ApiError ? err.message : "Could not update.",
      });
    }
  }

  return (
    <Card title="Change password">
      <form onSubmit={save} className="space-y-3">
        <input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="Current password"
          className={inputClass}
          required
        />
        <input
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="New password (min 10 chars)"
          className={inputClass}
          required
        />
        {msg && (
          <p className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>
            {msg.text}
          </p>
        )}
        <button
          type="submit"
          disabled={change.isPending}
          className={primaryButtonClass}
        >
          {change.isPending ? "Updating…" : "Update password"}
        </button>
      </form>
    </Card>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-accent" : "border border-line bg-surface-2"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-text">{label}</div>
        {desc && <div className="text-xs text-muted">{desc}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

type CheckName = "ai" | "notion" | "hevy";

function IntegrationsCard() {
  const { data } = useIntegrationStatus();
  const check = useCheckIntegrations();

  // Live results keyed by provider, populated after "Test connections".
  const live: Partial<Record<CheckName, { ok: boolean; detail: string }>> = {};
  for (const c of check.data?.checks ?? []) {
    if (c.configured) live[c.name] = { ok: c.ok, detail: c.detail };
  }

  const rows: { label: string; on: boolean; name?: CheckName }[] = data
    ? [
        { label: "AI coach (Claude)", on: data.ai, name: "ai" },
        { label: "Notion (Twinly)", on: data.notion, name: "notion" },
        { label: "Hevy workouts", on: data.hevy, name: "hevy" },
        { label: "Statement encryption", on: data.encryption },
        { label: "Apple Health ingest", on: data.healthIngest },
        { label: "Push notifications", on: data.push },
      ]
    : [];

  return (
    <Card title="Integrations">
      {!data ? (
        <div className="h-28 animate-pulse rounded-xl bg-surface-2" />
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => {
            const result = r.name ? live[r.name] : undefined;
            const failed = result ? !result.ok : false;
            const ok = result ? result.ok : r.on;
            const status = result
              ? result.ok
                ? "working"
                : result.detail
              : r.on
                ? "connected"
                : "not set";
            return (
              <li
                key={r.label}
                className="flex items-start justify-between gap-3"
              >
                <span className="flex items-center gap-2.5 text-sm text-text">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      failed
                        ? "bg-bad shadow-[0_0_8px] shadow-bad/60"
                        : ok
                          ? "bg-good shadow-[0_0_8px] shadow-good/60"
                          : "bg-muted/40"
                    }`}
                  />
                  {r.label}
                </span>
                <code
                  title={status}
                  className={`max-w-[55%] truncate text-right text-xs ${
                    failed ? "text-bad" : ok ? "text-good" : "text-muted"
                  }`}
                >
                  {status}
                </code>
              </li>
            );
          })}
        </ul>
      )}

      <button
        onClick={() => check.mutate()}
        disabled={check.isPending || !data}
        className="mt-3 w-full rounded-xl bg-surface-2 px-4 py-2.5 text-sm font-medium text-text active:opacity-80 disabled:opacity-50"
      >
        {check.isPending ? "Testing…" : "Test connections"}
      </button>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        Keys go on the <span className="text-text">API</span> service in Railway —
        not the web service. “not set” means the API isn’t seeing that key; “Test
        connections” actually calls Claude, Notion, and Hevy so a bad token shows
        up as a real error.
      </p>
      {data && (
        <p className="mt-1 text-xs text-muted">
          AI model: <span className="text-text">{data.model}</span>
        </p>
      )}
    </Card>
  );
}

function AppleHealthCard() {
  const { data: status } = useIntegrationStatus();
  const { data: metrics } = useMetricsSummary();
  const [copied, setCopied] = useState(false);
  const apiBase = import.meta.env.VITE_API_URL || window.location.origin;
  const url = `${apiBase}/api/ingest/health`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — the URL is visible to copy by hand
    }
  }

  return (
    <Card title="Apple Health (steps & watch)">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 text-text">
          <span
            className={`h-2 w-2 rounded-full ${
              status?.healthIngest
                ? "bg-good shadow-[0_0_8px] shadow-good/60"
                : "bg-muted/40"
            }`}
          />
          {status?.healthIngest ? "Endpoint ready" : "Not set up"}
        </span>
        <span className="text-xs text-muted">
          {metrics?.updatedAt
            ? `Last data ${new Date(metrics.updatedAt).toLocaleString()}`
            : "No data yet"}
        </span>
      </div>

      {metrics?.steps != null && (
        <p className="mt-2 text-sm text-text">
          {metrics.steps.toLocaleString()} steps today
        </p>
      )}

      <p className="mt-3 text-xs leading-relaxed text-muted">
        A web app can't read Apple Health directly. Your Watch syncs to Apple
        Health, and the <span className="text-text">Health Auto Export</span> app
        posts that data here:
      </p>

      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg bg-surface-2 px-3 py-2 text-xs text-text">
          {url}
        </code>
        <button
          onClick={copy}
          className="shrink-0 rounded-lg bg-surface-2 px-3 py-2 text-xs font-medium text-accent active:opacity-80"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-muted">
        <li>
          Set <code className="text-text">HEALTH_INGEST_TOKEN</code> on the API
          (Railway), then redeploy.
        </li>
        <li>
          Install <span className="text-text">Health Auto Export – JSON+CSV</span>{" "}
          from the App Store.
        </li>
        <li>
          Add a <span className="text-text">REST API</span> automation → POST the
          URL above, format JSON.
        </li>
        <li>
          Add header <code className="text-text">x-ingest-token</code> set to your
          token.
        </li>
        <li>
          Choose Steps, Active Energy, Heart Rate, Sleep, Body Mass → run on a
          schedule (e.g. hourly).
        </li>
      </ol>
    </Card>
  );
}

function NotificationsCard() {
  const { data: cfg } = usePushConfig();
  const updatePrefs = useUpdatePushPrefs();
  const test = useSendTestPush();
  const invalidate = useInvalidatePushConfig();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    void currentSubscription().then((s) => {
      if (active) setSubscribed(Boolean(s));
    });
    return () => {
      active = false;
    };
  }, []);

  if (!pushSupported()) {
    return (
      <Card title="Notifications">
        <p className="text-sm text-muted">
          This browser doesn't support push notifications. On iPhone, add Apex to
          your Home Screen first, then enable them here.
        </p>
      </Card>
    );
  }

  if (cfg && !cfg.configured) {
    return (
      <Card title="Notifications">
        <p className="text-sm text-muted">
          Set <code className="text-text">VAPID_PUBLIC_KEY</code> and{" "}
          <code className="text-text">VAPID_PRIVATE_KEY</code> on the API to turn
          on reminders. Generate a pair with{" "}
          <code className="text-text">npx web-push generate-vapid-keys</code>.
        </p>
      </Card>
    );
  }

  async function toggleDevice() {
    if (!cfg?.publicKey) return;
    setBusy(true);
    setMsg(null);
    try {
      if (subscribed) {
        await disablePush();
        setSubscribed(false);
      } else {
        await enablePush(cfg.publicKey);
        setSubscribed(true);
      }
      invalidate();
    } catch (err) {
      setMsg({
        ok: false,
        text: err instanceof Error ? err.message : "Couldn't update.",
      });
    } finally {
      setBusy(false);
    }
  }

  function setPref(key: keyof NotificationPrefs, value: boolean) {
    if (!cfg) return;
    updatePrefs.mutate({ ...cfg.prefs, [key]: value });
  }

  async function sendTest() {
    setMsg(null);
    try {
      await test.mutateAsync();
      setMsg({ ok: true, text: "Test notification sent." });
    } catch (err) {
      setMsg({
        ok: false,
        text: err instanceof ApiError ? err.message : "Couldn't send test.",
      });
    }
  }

  return (
    <Card title="Notifications">
      <ToggleRow
        label="This device"
        desc={
          subscribed
            ? "Receiving reminders here."
            : "Turn on to get reminders on this device."
        }
        checked={Boolean(subscribed)}
        onChange={toggleDevice}
        disabled={busy || subscribed === null}
      />

      {cfg && (
        <div className="mt-1 border-t border-line pt-1">
          <ToggleRow
            label="Bills due"
            desc="A heads-up a few days before a bill is due."
            checked={cfg.prefs.notifyBills}
            onChange={(v) => setPref("notifyBills", v)}
            disabled={updatePrefs.isPending}
          />
          <ToggleRow
            label="Gym streak"
            desc="An evening nudge if today's session isn't logged."
            checked={cfg.prefs.notifyStreak}
            onChange={(v) => setPref("notifyStreak", v)}
            disabled={updatePrefs.isPending}
          />
          <ToggleRow
            label="Logging reminder"
            desc="A late nudge if you haven't logged anything."
            checked={cfg.prefs.notifyLogging}
            onChange={(v) => setPref("notifyLogging", v)}
            disabled={updatePrefs.isPending}
          />
        </div>
      )}

      {subscribed && (
        <button
          onClick={sendTest}
          disabled={test.isPending}
          className="mt-3 w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm font-medium text-text active:opacity-80 disabled:opacity-50"
        >
          {test.isPending ? "Sending…" : "Send a test notification"}
        </button>
      )}
      {msg && (
        <p className={`mt-2 text-sm ${msg.ok ? "text-good" : "text-bad"}`}>
          {msg.text}
        </p>
      )}
    </Card>
  );
}

function DataCard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportAll() {
    setBusy(true);
    setError(null);
    try {
      const data = await api.get<unknown>("/api/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `apex-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Data">
      <button
        onClick={exportAll}
        disabled={busy}
        className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3 font-medium text-text active:opacity-80 disabled:opacity-50"
      >
        {busy ? "Preparing…" : "Export all my data (JSON)"}
      </button>
      <p className="mt-2 text-xs text-muted">
        Everything you've logged, as one file. Excludes your password and the
        encrypted bank-statement data.
      </p>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
    </Card>
  );
}

export function Settings() {
  const { data: me } = useMe();
  const logout = useLogout();

  return (
    <div className="space-y-5">
      <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-text">Settings</h1>

      <TargetsCard />
      <IntegrationsCard />
      <AppleHealthCard />
      <NotificationsCard />
      <PasswordCard />

      <Card title="Account">
        <p className="mb-3 text-sm text-muted">{me?.email}</p>
        <button
          onClick={() => logout.mutate()}
          className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3 font-medium text-text active:opacity-80"
        >
          Sign out
        </button>
      </Card>

      <DataCard />

      <p className="pb-2 text-center text-xs text-muted">
        Apex · build {__BUILD_ID__} · {__BUILD_TIME__}
      </p>
    </div>
  );
}
