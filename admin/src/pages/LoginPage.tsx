import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/store/adminAuth";

export function LoginPage() {
  const login = useAdminAuth((s) => s.login);
  const user = useAdminAuth((s) => s.user);
  const error = useAdminAuth((s) => s.error);
  const isSubmitting = useAdminAuth((s) => s.isSubmitting);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (user) {
    navigate("/", { replace: true });
    return null;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login({ email, password });
    if (useAdminAuth.getState().user) navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-card border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="mb-6 flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Keyafe"
            className="h-10 w-10 rounded-full"
          />
          <div>
            <p className="text-sm font-semibold text-slate-900">Keyafe Admin</p>
            <p className="text-xs text-slate-500">
              Sign in to manage the store.
            </p>
          </div>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Email
          </span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Password
          </span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>

        {error && (
          <p className="mb-3 rounded-md bg-brand-100 px-3 py-2 text-xs text-brand-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-brand-500 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>

        <p className="mt-4 text-center text-[11px] text-slate-400">
          Auth is mocked — any email + a ≥ 6-char password works.
        </p>
      </form>
    </div>
  );
}
