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
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 safe-top safe-bottom">
      <div className="mb-8 text-center">
        <img src="/favicon.svg" alt="" className="mx-auto h-16 w-16" />
        <h1 className="mt-4 text-2xl font-semibold text-text">Apex</h1>
        <p className="mt-1 text-sm text-muted">Your private command center.</p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className={inputClass}
          required
        />
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className={inputClass}
          required
        />
        {error && <p className="text-center text-sm text-bad">{error}</p>}
        <button
          type="submit"
          disabled={login.isPending}
          className={primaryButtonClass}
        >
          {login.isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
