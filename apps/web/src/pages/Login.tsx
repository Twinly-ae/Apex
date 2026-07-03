import { type FormEvent, useState } from "react";
import { ApiError } from "../lib/api";
import { useLogin } from "../lib/queries";
import { inputClass, primaryButtonClass } from "../components/ui/Sheet";

export function Login() {
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login.mutateAsync({ email, password });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    }
  }

  return (
    <div className="relative mx-auto flex min-h-full max-w-md flex-col justify-center overflow-hidden px-6 safe-top safe-bottom">
      {/* Ambient brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[560px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(124,107,255,0.45), rgba(93,68,245,0.15), transparent)",
        }}
      />

      <div className="relative mb-10 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-accent to-accent-strong shadow-glow">
          <img src="/favicon.svg" alt="" className="h-11 w-11" />
        </div>
        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-text">
          Apex
        </h1>
        <p className="mx-auto mt-2 max-w-[240px] text-sm leading-relaxed text-muted">
          Training, nutrition, money and focus — one command center.
        </p>
      </div>

      <form onSubmit={submit} className="relative space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">
            Email
          </span>
          <input
            type="email"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">
            Password
          </span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={inputClass}
            required
          />
        </label>
        {error && <p className="text-center text-sm text-bad">{error}</p>}
        <button
          type="submit"
          disabled={login.isPending}
          className={`${primaryButtonClass} !mt-5`}
        >
          {login.isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="relative mt-10 text-center text-[11px] text-muted/70">
        Private by design — your data stays on your server.
      </p>
    </div>
  );
}
