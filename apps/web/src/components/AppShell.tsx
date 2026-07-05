import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { getHomeId, pageById } from "../lib/layout";
import { BottomNav } from "./BottomNav";

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const booted = useRef(false);

  // Open on the user's chosen home page (on launch only).
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const home = pageById(getHomeId());
    if (home.route !== "/" && location.pathname === "/") {
      navigate(home.route, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // iOS keeps PWAs alive for days, so a "launch" rarely happens. Treat coming
  // back after a long break as a fresh open and land on the chosen home page.
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > 15 * 60_000) {
        navigate(pageById(getHomeId()).route, { replace: true });
        hiddenAt = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [navigate]);

  return (
    <div className="mx-auto min-h-full max-w-md">
      {/* Blurred backdrop under the iOS status bar so scrolled content
          doesn't collide with the clock (native-app behavior). */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-40 bg-bg/70 backdrop-blur-md"
        style={{ height: "env(safe-area-inset-top, 0px)" }}
      />
      <main className="px-4 pb-32 safe-top">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
