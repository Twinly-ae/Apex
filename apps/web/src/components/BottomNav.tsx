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
import { PAGES, getNavSlots, pageById, useLayoutVersion } from "../lib/layout";
import { QuickAddSheet } from "./QuickAddSheet";
import { Sheet } from "./ui/Sheet";

export const PAGE_ICONS: Record<string, LucideIcon> = {
  today: Home,
  tasks: ListChecks,
  health: HeartPulse,
  goals: Target,
  money: Wallet,
  businesses: Briefcase,
  coach: Sparkles,
  meals: UtensilsCrossed,
  day: CalendarDays,
  settings: SettingsIcon,
};

function Tab({ id }: { id: string }) {
  const page = pageById(id);
  const Icon = PAGE_ICONS[page.id] ?? Home;
  return (
    <NavLink
      to={page.route}
      end={page.route === "/"}
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
            {page.label}
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
  useLayoutVersion();

  const slots = getNavSlots();
  const more = PAGES.filter((p) => !slots.includes(p.id));
  const moreActive = more.some((m) =>
    m.route === "/" ? location.pathname === "/" : location.pathname.startsWith(m.route),
  );

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 safe-bottom">
        <div className="mx-auto max-w-md px-4 pb-3">
          <div className="flex items-center rounded-full border border-line/70 bg-surface/85 shadow-float backdrop-blur-xl">
            <Tab id={slots[0]} />
            <Tab id={slots[1]} />

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

            <Tab id={slots[2]} />

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
          {more.map((p) => {
            const Icon = PAGE_ICONS[p.id] ?? Home;
            const active =
              p.route === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(p.route);
            return (
              <button
                key={p.id}
                onClick={() => {
                  setMoreOpen(false);
                  navigate(p.route);
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
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          Customize the tab bar in Settings → Home &amp; navigation.
        </p>
      </Sheet>
    </>
  );
}
