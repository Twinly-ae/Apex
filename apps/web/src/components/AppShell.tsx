import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";

export function AppShell() {
  return (
    <div className="mx-auto min-h-full max-w-md">
      <main className="px-4 pb-28 pt-5 safe-top">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
