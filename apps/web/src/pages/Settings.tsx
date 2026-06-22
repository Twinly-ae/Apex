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
  useInvalidatePushConfig,
  useLogout,
  useMe,
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
          {update.isPending ? "Saving…" : saved ? "Saved ✓" : "Save targets"}
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
      <h1 className="text-2xl font-semibold text-text">Settings</h1>

      <TargetsCard />
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
    </div>
  );
}
