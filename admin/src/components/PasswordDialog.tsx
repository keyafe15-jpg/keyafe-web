import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Field, inputClass, submitClass } from "@/components/form/Field";

const MIN_LENGTH = 8;

interface PasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Ask for the current password first (changing your own existing password). */
  requireCurrent?: boolean;
  submitLabel: string;
  onSubmit: (values: { currentPassword?: string; newPassword: string }) => Promise<void>;
}

export function PasswordDialog({ open, onOpenChange, ...rest }: PasswordDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-card border border-slate-200 bg-white p-5 shadow-xl">
          {/* Remounted on every open so fields and errors start fresh. */}
          {open && <PasswordForm {...rest} onDone={() => onOpenChange(false)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PasswordForm({
  title,
  description,
  requireCurrent,
  submitLabel,
  onSubmit,
  onDone,
}: Omit<PasswordDialogProps, "open" | "onOpenChange"> & { onDone: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters`);
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        currentPassword: requireCurrent ? currentPassword : undefined,
        newPassword,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Dialog.Title className="text-base font-semibold text-slate-900">{title}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-500">
            {description}
          </Dialog.Description>
        </div>
        <Dialog.Close
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Dialog.Close>
      </div>

      {requireCurrent && (
        <Field label="Current password" required>
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
      <Field label="New password" hint={`At least ${MIN_LENGTH} characters`} required>
        <input
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Repeat new password" required>
        <input
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
        />
      </Field>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <button type="submit" disabled={busy} className={`${submitClass} w-full`}>
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
