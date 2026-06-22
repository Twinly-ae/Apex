import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import type { SettingsInput } from "@apex/shared";
import { ApiError } from "../lib/api";
import {
  useChangePassword,
  useLogout,
  useMe,
  useSettings,
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

export function Settings() {
  const { data: me } = useMe();
  const logout = useLogout();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-text">Settings</h1>

      <TargetsCard />
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

      <Card title="Data">
        <button
          disabled
          className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3 font-medium text-muted opacity-60"
        >
          Export all my data (Phase 5)
        </button>
      </Card>
    </div>
  );
}
