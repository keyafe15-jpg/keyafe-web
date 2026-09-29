import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { useAuth } from "@/store/auth";
import { newPasswordSchema } from "@/lib/validators";
import { Field, inputClass, submitClass } from "@/components/form/Field";
import { AUTH_COPY } from "@/content/auth";

const COPY = AUTH_COPY.changePassword;

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-cream-200 bg-cream-50 p-6 shadow-2xl focus:outline-none">
          {/* Remounted on every open so fields and errors start fresh. */}
          {open && <ChangePasswordForm onDone={() => onOpenChange(false)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const hasPassword = useAuth((s) => Boolean(s.user?.hasPassword));
  const changePassword = useAuth((s) => s.changePassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = newPasswordSchema.safeParse(newPassword);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid password");
      return;
    }
    if (newPassword !== confirm) {
      setError(COPY.mismatch);
      return;
    }
    setBusy(true);
    try {
      await changePassword({
        currentPassword: hasPassword ? currentPassword : undefined,
        newPassword,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Dialog.Title className="mb-1 font-display text-2xl text-ink-900">
          {hasPassword ? COPY.changeTitle : COPY.setTitle}
        </Dialog.Title>
        <Dialog.Description className="text-sm text-ink-500">
          {hasPassword ? COPY.changeDescription : COPY.setDescription}
        </Dialog.Description>
      </div>

      {hasPassword && (
        <Field label={COPY.current} required>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputClass}
          />
        </Field>
      )}
      <Field
        label={AUTH_COPY.fields.newPassword.label}
        hint={AUTH_COPY.fields.newPassword.hint}
        required
      >
        <input
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label={COPY.repeat} required>
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
  );
}
