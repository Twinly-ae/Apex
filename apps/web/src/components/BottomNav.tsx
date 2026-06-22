import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/", label: "Today", icon: "◆", end: true },
  { to: "/tasks", label: "Tasks", icon: "☑" },
  { to: "/settings", label: "Settings", icon: "⚙" },
];

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur safe-bottom">
      <div className="mx-auto flex max-w-md">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs ${
                isActive ? "text-accent" : "text-muted"
              }`
            }
          >
            <span className="text-xl leading-none">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
