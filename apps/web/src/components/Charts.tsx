import type {
  AdherencePoint,
  BodyweightPoint,
  NetWorthPoint,
  TrainingWeekPoint,
} from "@apex/shared";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

function Empty({ msg }: { msg: string }) {
  return (
    <div className="grid h-[180px] place-items-center text-center text-sm text-muted">
      {msg}
    </div>
  );
}
