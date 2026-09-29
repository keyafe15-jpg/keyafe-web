import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";

const MIN_LENGTH = 8;
const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none";
const labelClass = "mb-1 block text-xs font-medium tracking-wide text-slate-500 uppercase";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setBusy(true);
    try {
      const data = await api.post<{ message: string }>("/auth/reset-password", {
        token,
        password,
      });
      setDone(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-card border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <img src="/logo.png" alt="Keyafe" className="h-10 w-10 rounded-full" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Reset your password</p>
            <p className="text-xs text-slate-500">Choose a new password for Keyafe Admin.</p>
          </div>
        </div>

        {!token ? (
          <p className="text-sm text-slate-600">
            This link is missing its reset code. Request a new one from the{" "}
            <Link to="/login" className="text-brand-600 hover:underline">
              sign-in page
            </Link>
            .
          </p>
        ) : done ? (
          <div className="space-y-4">
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{done}</p>
            <Link
              to="/login"
              className="block w-full rounded-lg bg-brand-500 py-2 text-center text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Go to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label className="mb-4 block">
              <span className={labelClass}>New password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="mb-4 block">
              <span className={labelClass}>Repeat new password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
              />
            </label>
            {error && (
              <p className="mb-3 rounded-md bg-brand-100 px-3 py-2 text-xs text-brand-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-brand-500 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
