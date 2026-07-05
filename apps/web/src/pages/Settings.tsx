import { Check, LayoutGrid, Plus } from "lucide-react";
import { PAGE_ICONS } from "../components/BottomNav";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import type { NotificationPrefs, SettingsInput } from "@apex/shared";
import { ApiError, api } from "../lib/api";
import { selectClass } from "../components/ui/Sheet";
import {
  HOME_SECTIONS,
  PAGES,
  getHiddenSections,
  getHomeId,
  getNavSlots,
  pageById,
  setHomeId,
  setNavSlot,
  setSectionHidden,
  useLayoutVersion,
} from "../lib/layout";
import {
  ACCENTS,
  TEXT_SIZES,
  THEMES,
  getAccentId,
  getAurora,
  getTextSizeId,
  getThemeId,
  setAccent,
  setAurora,
  setTextSize,
  setTheme,
} from "../lib/theme";
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
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-accent" : "bg-surface-2 ring-1 ring-inset ring-line"
      }`}
    >
      <span
        className={`absolute left-1 top-1 h-5 w-5 rounded-full shadow-sm transition-all duration-200 ${
          checked ? "translate-x-5 bg-white" : "translate-x-0 bg-muted/50"
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

function HomeNavCard() {
  useLayoutVersion();
  const home = getHomeId();
  const slots = getNavSlots();
  const hidden = getHiddenSections();
  const [activeSlot, setActiveSlot] = useState(0);

  return (
    <Card title="Home & navigation">
      <label className="block">
        <span className="mb-1.5 block text-sm text-text">Home page</span>
        <select
          value={home}
          onChange={(e) => setHomeId(e.target.value)}
          className={selectClass}
        >
          {PAGES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-1.5 text-xs text-muted">
        The app opens on{" "}
        <span className="font-medium text-text">{pageById(home).label}</span>{" "}
        when launched or reopened after a break.
      </p>

      {/* Tab bar — live preview; tap a slot, then tap the page to put there */}
      <div className="mt-5 text-sm text-text">Tab bar</div>
      <p className="mb-2 mt-0.5 text-xs text-muted">
        1. Tap a slot below · 2. Tap the page to place there
      </p>
      <div className="flex items-center rounded-full border border-line bg-surface-2 px-1 py-1.5">
        {[0, 1].map((i) => (
          <SlotPreview
            key={i}
            id={slots[i]}
            active={activeSlot === i}
            onClick={() => setActiveSlot(i)}
          />
        ))}
        <div className="flex flex-1 justify-center">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-white">
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </span>
        </div>
        <SlotPreview
          id={slots[2]}
          active={activeSlot === 2}
          onClick={() => setActiveSlot(2)}
        />
        <div className="flex flex-1 flex-col items-center gap-0.5 opacity-50">
          <LayoutGrid className="h-[18px] w-[18px] text-muted" strokeWidth={2} />
          <span className="text-[9px] font-semibold text-muted">More</span>
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {PAGES.map((p) => {
          const Icon = PAGE_ICONS[p.id];
          const slotIdx = slots.indexOf(p.id);
          const inBar = slotIdx >= 0;
          return (
            <button
              key={p.id}
              onClick={() => {
                setNavSlot(activeSlot, p.id);
                setActiveSlot((activeSlot + 1) % 3);
              }}
              className={`pressable flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm ${
                inBar
                  ? "border-accent/40 bg-accent/10 font-semibold text-accent"
                  : "border-line bg-surface-2 text-text"
              }`}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />}
              <span className="min-w-0 flex-1 truncate">{p.label}</span>
              {inBar && (
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-bold text-white">
                  {slotIdx + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-line pt-2">
        <div className="mb-1 text-sm text-text">Today page sections</div>
        {HOME_SECTIONS.map((s) => (
          <ToggleRow
            key={s.id}
            label={s.label}
            checked={!hidden.has(s.id)}
            onChange={(v) => setSectionHidden(s.id, !v)}
          />
        ))}
      </div>
    </Card>
  );
}

function SlotPreview({
  id,
  active,
  onClick,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
}) {
  const page = pageById(id);
  const Icon = PAGE_ICONS[page.id];
  return (
    <button
      onClick={onClick}
      className={`pressable flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 ${
        active ? "bg-accent/15 ring-1 ring-accent" : ""
      }`}
    >
      {Icon && (
        <Icon
          className={`h-[18px] w-[18px] ${active ? "text-accent" : "text-muted"}`}
          strokeWidth={2}
        />
      )}
      <span
        className={`max-w-full truncate px-1 text-[9px] font-semibold ${
          active ? "text-accent" : "text-muted"
        }`}
      >
        {page.label}
      </span>
    </button>
  );
}

function AiCoachCard() {
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const [text, setText] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const value = text ?? settings?.aiInstructions ?? "";

  async function save() {
    if (!settings) return;
    await update.mutateAsync({ ...settings, aiInstructions: value.trim() || null });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card title="AI coach">
      <label className="block">
        <span className="mb-1.5 block text-sm text-text">
          Custom instructions
        </span>
        <textarea
          value={value}
          onChange={(e) => {
            setText(e.target.value);
            setSaved(false);
          }}
          rows={4}
          maxLength={2000}
          placeholder={
            "Tell your coach how to behave. e.g.\n· Reply in Arabic\n· Be blunt, no fluff\n· Prioritise Twinly over everything\n· Suggest halal food only"
          }
          className="w-full resize-none rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed text-text placeholder:text-muted/60 outline-none transition-colors focus:border-accent"
        />
      </label>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Applied to everything the AI writes — chat, briefing, day plan, tips,
        and reviews.
      </p>
      <button
        onClick={save}
        disabled={update.isPending || !settings}
        className="mt-3 w-full rounded-xl bg-surface-2 px-4 py-2.5 text-sm font-medium text-text active:opacity-80 disabled:opacity-50"
      >
        {update.isPending ? "Saving…" : saved ? "Saved ✓" : "Save instructions"}
      </button>
    </Card>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; name: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      className="grid w-full gap-1 rounded-xl bg-surface-2 p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
            value === o.id ? "bg-accent text-white" : "text-muted"
          }`}
        >
          {o.name}
        </button>
      ))}
    </div>
  );
}

function AppearanceCard() {
  const [accentId, setAccentId] = useState(getAccentId());
  const [themeId, setThemeId] = useState(getThemeId());
  const [textSize, setTextSizeState] = useState(getTextSizeId());
  const [aurora, setAuroraState] = useState(getAurora());

  return (
    <Card title="Appearance">
      <div className="mb-2 text-sm text-text">Accent color</div>
      <div className="grid grid-cols-5 gap-3">
        {ACCENTS.map((a) => (
          <button
            key={a.id}
            aria-label={a.name}
            onClick={() => {
              setAccent(a.id);
              setAccentId(a.id);
            }}
            className={`pressable mx-auto grid h-10 w-10 place-items-center rounded-full transition-transform ${
              accentId === a.id
                ? "ring-2 ring-white/80 ring-offset-2 ring-offset-surface"
                : ""
            }`}
            style={{ backgroundColor: a.hex }}
          >
            {accentId === a.id && (
              <Check className="h-4 w-4 text-white" strokeWidth={3} />
            )}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-1.5">
        <div className="text-sm text-text">Theme</div>
        <SegmentedControl
          options={THEMES}
          value={themeId}
          onChange={(id) => {
            setTheme(id);
            setThemeId(id);
          }}
        />
      </div>

      <div className="mt-4 space-y-1.5">
        <div className="flex items-baseline justify-between">
          <div className="text-sm text-text">Text size</div>
          <span className="text-xs text-muted">applies everywhere</span>
        </div>
        <SegmentedControl
          options={TEXT_SIZES}
          value={textSize}
          onChange={(id) => {
            setTextSize(id);
            setTextSizeState(id);
          }}
        />
      </div>

      <div className="mt-4 border-t border-line pt-1">
        <ToggleRow
          label="Aurora backdrop"
          desc="Soft accent glow behind the app"
          checked={aurora}
          onChange={(v) => {
            setAurora(v);
            setAuroraState(v);
          }}
        />
      </div>
    </Card>
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
                  className={`max-w-[55%] break-words text-right text-xs leading-snug ${
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
      <AppearanceCard />
      <HomeNavCard />
      <AiCoachCard />
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
