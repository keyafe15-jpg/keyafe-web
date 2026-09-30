import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Field, inputClass, submitClass } from "@/components/form/Field";
import { useUpdateStaffUser, type StaffUser } from "@/hooks/useAdminStaff";
import { useAdminAuth } from "@/store/adminAuth";

interface StaffDetailsDialogProps {
  user: StaffUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StaffDetailsDialog({ user, open, onOpenChange }: StaffDetailsDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-card border border-slate-200 bg-white p-5 shadow-xl">
          {/* Remounted on every open so fields start from the saved values. */}
          {open && <DetailsForm user={user} onDone={() => onOpenChange(false)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DetailsForm({ user, onDone }: { user: StaffUser; onDone: () => void }) {
  const update = useUpdateStaffUser();
  const currentUser = useAdminAuth((s) => s.user);
  const isSelf = currentUser?.id === user.id;
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [email, setEmail] = useState(user.email ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const saved = await update.mutateAsync({
        id: user.id,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
      });
      if (isSelf && currentUser) {
        useAdminAuth.setState({
          user: {
            ...currentUser,
            name: saved.name,
            phone: saved.phone,
            email: saved.email ?? undefined,
          },
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  };

  const phoneChanged = phone.trim() !== user.phone;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Dialog.Title className="text-base font-semibold text-slate-900">
            {isSelf ? "Edit your details" : `Edit ${user.name}`}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-500">
            The phone number is used to sign in to this admin app.
          </Dialog.Description>
        </div>
        <Dialog.Close
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Dialog.Close>
      </div>

      <Field label="Name" required>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field
        label="Phone"
        hint={phoneChanged ? "Sign in with the new number from now on." : undefined}
        required
      >
        <input
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Email" hint="Forgot-password links are sent here.">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </Field>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <button type="submit" disabled={update.isPending} className={`${submitClass} w-full`}>
        {update.isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
