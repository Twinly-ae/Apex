import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { useMe } from "./lib/queries";
import { Coach } from "./pages/Coach";
import { Goals } from "./pages/Goals";
import { Login } from "./pages/Login";
import { Businesses } from "./pages/Businesses";
import { Settings } from "./pages/Settings";
import { Tasks } from "./pages/Tasks";
import { Today } from "./pages/Today";

// Charts (recharts) are heavy — load chart-using screens only when visited.
const Health = lazy(() =>
  import("./pages/Health").then((m) => ({ default: m.Health })),
);
const Money = lazy(() =>
  import("./pages/Money").then((m) => ({ default: m.Money })),
);

function Splash() {
  return (
    <div className="grid min-h-full place-items-center">
      <img src="/favicon.svg" alt="Apex" className="h-14 w-14 animate-pulse" />
    </div>
  );
}

export default function App() {
  const { data: user, isLoading } = useMe();

  if (isLoading) return <Splash />;
  if (!user) return <Login />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Today />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/coach" element={<Coach />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/businesses" element={<Businesses />} />
        <Route
          path="/money"
          element={
            <Suspense fallback={<Splash />}>
              <Money />
            </Suspense>
          }
        />
        <Route
          path="/health"
          element={
            <Suspense fallback={<Splash />}>
              <Health />
            </Suspense>
          }
        />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
