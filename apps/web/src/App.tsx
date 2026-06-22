import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { useMe } from "./lib/queries";
import { Login } from "./pages/Login";
import { Settings } from "./pages/Settings";
import { Tasks } from "./pages/Tasks";
import { Today } from "./pages/Today";

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
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
