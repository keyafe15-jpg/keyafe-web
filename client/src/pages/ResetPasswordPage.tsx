import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { newPasswordSchema } from "@/lib/validators";
import { Field, inputClass, submitClass } from "@/components/form/Field";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { AUTH_COPY } from "@/content/auth";

const COPY = AUTH_COPY.reset;

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
    const parsed = newPasswordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid password");
      return;
    }
    if (password !== confirm) {
      setError(AUTH_COPY.changePassword.mismatch);
      return;
    }
    setBusy(true);
    try {
      const data = await api.post<{ message: string }>("/auth/reset-password", { token, password });
      setDone(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-cream-200 bg-cream-50 p-6 shadow-sm">
        <h1 className="mb-1 font-display text-2xl text-ink-900">{COPY.title}</h1>
        <p className="mb-5 text-sm text-ink-500">{COPY.subtitle}</p>

        {!token ? (
          <p className="text-sm text-ink-700">{COPY.missingToken}</p>
        ) : done ? (
          <div className="space-y-4">
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{done}</p>
            <AuthDialog
              trigger={
                <button type="button" className={submitClass}>
                  {AUTH_COPY.headerButton}
                </button>
              }
            />
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field
              label={AUTH_COPY.fields.newPassword.label}
              hint={AUTH_COPY.fields.newPassword.hint}
              required
            >
              <input
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={AUTH_COPY.changePassword.repeat} required>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
              />
            </Field>
            {error && <p className="text-sm text-brand-500">{error}</p>}
            <button type="submit" disabled={busy} className={submitClass}>
              {busy ? COPY.submitting : COPY.submit}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
