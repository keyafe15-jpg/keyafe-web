import { useEffect, useState } from "react";
import { useBusinessUpi, useUpdateBusinessUpi } from "@/hooks/useBusinessUpi";
import { Field, inputClass, submitClass } from "@/components/form/Field";

export function SettingsPage() {
  const { data, isLoading } = useBusinessUpi();
  const update = useUpdateBusinessUpi();

  const [upiId, setUpiId] = useState("");
  const [upiPayeeName, setUpiPayeeName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setUpiId(data.upiId ?? "");
      setUpiPayeeName(data.upiPayeeName ?? "");
    }
  }, [data]);

  const submit = async () => {
    setSaved(false);
    await update.mutateAsync({
      upiId: upiId.trim() || null,
      upiPayeeName: upiPayeeName.trim() || null,
    });
    setSaved(true);
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">Business, GST, invoicing.</p>

      <section className="mt-6 rounded-card border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          UPI payment collection
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Shown to customers on order links so they can pay you directly — no
          gateway, no fees.
        </p>

        {isLoading ? (
          <p className="mt-4 text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="mt-4 space-y-4">
            <Field label="UPI ID (VPA)" hint="e.g. yourshop@okhdfcbank">
              <input
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="yourshop@upi"
                className={inputClass}
              />
            </Field>
            <Field
              label="Payee name"
              hint="Shown to the customer's UPI app. Defaults to your trade name."
            >
              <input
                value={upiPayeeName}
                onChange={(e) => setUpiPayeeName(e.target.value)}
                placeholder="Keyafe Bakery"
                className={inputClass}
              />
            </Field>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={submit}
                disabled={update.isPending}
                className={submitClass}
              >
                {update.isPending ? "Saving…" : "Save"}
              </button>
              {saved && !update.isPending && (
                <span className="text-xs text-emerald-700">Saved</span>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
