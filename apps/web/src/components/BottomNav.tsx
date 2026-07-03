import {
  Briefcase,
  CalendarDays,
  HeartPulse,
  Home,
  LayoutGrid,
  ListChecks,
  type LucideIcon,
  Plus,
  Settings as SettingsIcon,
  Sparkles,
  Target,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { QuickAddSheet } from "./QuickAddSheet";
import { Sheet } from "./ui/Sheet";

const TABS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: "/", label: "Today", icon: Home, end: true },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
];
const TABS_RIGHT: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/health", label: "Health", icon: HeartPulse },
];

const MORE: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/money", label: "Money", icon: Wallet },
  { to: "/businesses", label: "Business", icon: Briefcase },
  { to: "/coach", label: "Coach", icon: Sparkles },
  { to: "/meals", label: "Food log", icon: UtensilsCrossed },
  { to: "/day", label: "History", icon: CalendarDays },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

function Tab({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className="pressable flex flex-1 flex-col items-center gap-0.5 py-2"
    >
      {({ isActive }) => (
        <>
          <Icon
            className={`h-[22px] w-[22px] ${isActive ? "text-accent" : "text-muted"}`}
            strokeWidth={isActive ? 2.4 : 2}
          />
          <span
            className={`text-[10px] font-semibold ${
              isActive ? "text-accent" : "text-muted"
            }`}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function BottomNav() {
  const [addOpen, setAddOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const moreActive = MORE.some((m) => location.pathname.startsWith(m.to));

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 safe-bottom">
        <div className="mx-auto max-w-md px-4 pb-3">
          <div className="flex items-center rounded-full border border-line/70 bg-surface/85 shadow-float backdrop-blur-xl">
            {TABS.map((t) => (
              <Tab key={t.to} {...t} />
            ))}

            {/* Center quick-log action */}
            <div className="flex flex-1 justify-center">
              <button
                onClick={() => setAddOpen(true)}
                aria-label="Quick log"
                className="pressable -mt-7 grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-gradient-to-br from-accent to-accent-strong text-white shadow-glow"
              >
                <Plus className="h-6 w-6" strokeWidth={2.5} />
              </button>
            </div>

            {TABS_RIGHT.map((t) => (
              <Tab key={t.to} {...t} />
            ))}

            <button
              onClick={() => setMoreOpen(true)}
              className="pressable flex flex-1 flex-col items-center gap-0.5 py-2"
              aria-label="More"
            >
              <LayoutGrid
                className={`h-[22px] w-[22px] ${moreActive ? "text-accent" : "text-muted"}`}
                strokeWidth={moreActive ? 2.4 : 2}
              />
              <span
                className={`text-[10px] font-semibold ${
                  moreActive ? "text-accent" : "text-muted"
                }`}
              >
                More
              </span>
            </button>
          </div>
        </div>
      </nav>

      <QuickAddSheet open={addOpen} onClose={() => setAddOpen(false)} />

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <div className="grid grid-cols-2 gap-2.5">
          {MORE.map(({ to, label, icon: Icon }) => {
            const active = location.pathname.startsWith(to);
            return (
              <button
                key={to}
                onClick={() => {
                  setMoreOpen(false);
                  navigate(to);
                }}
                className={`pressable flex items-center gap-3 rounded-2xl border p-3.5 text-left ${
                  active
                    ? "border-accent/40 bg-accent/10"
                    : "border-line bg-surface-2"
                }`}
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                    active ? "bg-accent/20 text-accent" : "bg-surface text-muted"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                </span>
                <span
                  className={`text-sm font-semibold ${active ? "text-accent" : "text-text"}`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}
