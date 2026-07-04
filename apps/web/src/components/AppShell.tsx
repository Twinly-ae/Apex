import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { getHomeId, pageById } from "../lib/layout";
import { BottomNav } from "./BottomNav";

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const booted = useRef(false);

  // Open on the user's chosen home page (once, on app launch only).
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const home = pageById(getHomeId());
    if (home.route !== "/" && location.pathname === "/") {
      navigate(home.route, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto min-h-full max-w-md">
      <main className="px-4 pb-32 pt-5 safe-top">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
