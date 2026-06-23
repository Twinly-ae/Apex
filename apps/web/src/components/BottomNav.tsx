import {
  Briefcase,
  HeartPulse,
  Home,
  type LucideIcon,
  ListChecks,
  Settings as SettingsIcon,
  Target,
  Wallet,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const tabs: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: "/", label: "Today", icon: Home, end: true },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/health", label: "Health", icon: HeartPulse },
  { to: "/money", label: "Money", icon: Wallet },
  { to: "/businesses", label: "Business", icon: Briefcase },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/80 backdrop-blur-lg safe-bottom">
      <div className="mx-auto flex max-w-md px-1">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="flex flex-1 flex-col items-center gap-1 py-2.5"
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-7 w-10 items-center justify-center rounded-full transition-colors ${
                    isActive ? "bg-accent/15 text-accent" : "text-muted"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                </span>
                <span
                  className={`text-[10px] font-medium ${
                    isActive ? "text-accent" : "text-muted"
                  }`}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
