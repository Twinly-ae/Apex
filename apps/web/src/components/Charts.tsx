import type {
  AdherencePoint,
  BodyweightPoint,
  EnergyPoint,
  HealthPoint,
  NetWorthPoint,
  SleepStagePoint,
  TrainingWeekPoint,
} from "@apex/shared";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = { fill: "#9393a6", fontSize: 11 } as const;
const GRID = "#2a2a3a";
const TOOLTIP = {
  contentStyle: {
    background: "#14141d",
    border: "1px solid #2a2a3a",
    borderRadius: 12,
    color: "#ececf1",
  },
  labelStyle: { color: "#9393a6" },
} as const;

const md = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function BodyweightChart({ data }: { data: BodyweightPoint[] }) {
  if (data.length < 2) {
    return <Empty msg="Log your weight a few times to see the trend." />;
  }
  const points = data.map((d) => ({ label: md(d.date), kg: d.kg }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={points} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          minTickGap={28}
        />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={42}
          domain={["dataMin - 1", "dataMax + 1"]}
        />
        <Tooltip {...TOOLTIP} />
        <Line
          type="monotone"
          dataKey="kg"
          stroke="#7c6bff"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AdherenceChart({ data }: { data: AdherencePoint[] }) {
  const target = data[0]?.calorieTarget ?? 2200;
  const points = data.map((d) => ({
    label: d.date.slice(5),
    calories: d.calories,
    over: d.calories > d.calorieTarget,
  }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={points} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          minTickGap={12}
        />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={42} />
        <Tooltip {...TOOLTIP} />
        <ReferenceLine y={target} stroke="#34d399" strokeDasharray="4 4" />
        <Bar dataKey="calories" radius={[4, 4, 0, 0]}>
          {points.map((p, i) => (
            <Cell key={i} fill={p.over ? "#fbbf24" : "#7c6bff"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrainingChart({ data }: { data: TrainingWeekPoint[] }) {
  const points = data.map((d) => ({
    label: d.weekStart.slice(5),
    volume: d.volumeKg,
  }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={points} margin={{ top: 5, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: GRID }}
        />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} />
        <Tooltip {...TOOLTIP} />
        <Bar dataKey="volume" fill="#7c6bff" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function NetWorthChart({ data }: { data: NetWorthPoint[] }) {
  if (data.length < 2) {
    return <Empty msg="Update your balances over a few days to see the trend." />;
  }
  const points = data.map((d) => ({ label: d.day.slice(5), aed: d.totalAed }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={points} margin={{ top: 5, right: 8, bottom: 0, left: -2 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          minTickGap={28}
        />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
        />
        <Tooltip {...TOOLTIP} />
        <Line
          type="monotone"
          dataKey="aed"
          stroke="#34d399"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SleepChart({ data }: { data: HealthPoint[] }) {
  if (data.length < 2) {
    return <Empty msg="A few nights of sleep data will show your trend." />;
  }
  const points = data.map((d) => ({ label: d.date.slice(5), hours: d.value }));
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={points} margin={{ top: 5, right: 8, bottom: 0, left: -22 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          minTickGap={12}
        />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={36} domain={[0, 10]} />
        <Tooltip {...TOOLTIP} />
        <ReferenceLine y={8} stroke="#34d399" strokeDasharray="4 4" />
        <Bar dataKey="hours" fill="#7c6bff" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RestingHrChart({ data }: { data: HealthPoint[] }) {
  if (data.length < 2) {
    return <Empty msg="Resting-HR trend appears after a few days of data." />;
  }
  const points = data.map((d) => ({ label: d.date.slice(5), bpm: d.value }));
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={points} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          minTickGap={20}
        />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={40}
          domain={["dataMin - 3", "dataMax + 3"]}
        />
        <Tooltip {...TOOLTIP} />
        <Line type="monotone" dataKey="bpm" stroke="#fb7185" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function HrvChart({
  data,
  baseline,
}: {
  data: HealthPoint[];
  baseline: number | null;
}) {
  if (data.length < 2) {
    return <Empty msg="HRV trend appears after a few days of data." />;
  }
  const points = data.map((d) => ({ label: d.date.slice(5), ms: d.value }));
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={points} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          minTickGap={20}
        />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={40}
          domain={["dataMin - 5", "dataMax + 5"]}
        />
        <Tooltip {...TOOLTIP} />
        {baseline != null && (
          <ReferenceLine y={baseline} stroke="#9393a6" strokeDasharray="4 4" />
        )}
        <Line type="monotone" dataKey="ms" stroke="#34d399" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Stage colors validated for the dark surface (CVD-safe, in-band, ≥3:1).
const STAGE_COLORS = {
  deep: "#7c6bff",
  core: "#0284c7",
  rem: "#0d9488",
  awake: "#f43f5e",
} as const;

export function SleepStagesChart({ data }: { data: SleepStagePoint[] }) {
  if (data.length < 2) {
    return <Empty msg="Sleep stages appear after a few nights of watch data." />;
  }
  const points = data.map((d) => ({
    label: d.date.slice(5),
    Deep: d.deep,
    Core: d.core,
    REM: d.rem,
    Awake: d.awake,
  }));
  const gap = { stroke: "#14141d", strokeWidth: 1.5 };
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={points} margin={{ top: 5, right: 8, bottom: 0, left: -22 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          minTickGap={12}
        />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={36} />
        <Tooltip {...TOOLTIP} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Deep" stackId="sleep" fill={STAGE_COLORS.deep} {...gap} />
        <Bar dataKey="Core" stackId="sleep" fill={STAGE_COLORS.core} {...gap} />
        <Bar dataKey="REM" stackId="sleep" fill={STAGE_COLORS.rem} {...gap} />
        <Bar
          dataKey="Awake"
          stackId="sleep"
          fill={STAGE_COLORS.awake}
          radius={[3, 3, 0, 0]}
          {...gap}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function EnergyChart({ data }: { data: EnergyPoint[] }) {
  if (data.length < 2) {
    return <Empty msg="Log a few days of food to see calories in vs out." />;
  }
  const points = data.map((d) => ({
    label: d.date.slice(5),
    In: d.kcalIn,
    Out: d.kcalOut,
  }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={points} margin={{ top: 5, right: 8, bottom: 0, left: -6 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          minTickGap={12}
        />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
        <Tooltip {...TOOLTIP} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="In" fill="#7c6bff" radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Line type="monotone" dataKey="Out" stroke="#fbbf24" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="grid h-[180px] place-items-center text-center text-sm text-muted">
      {msg}
    </div>
  );
}
