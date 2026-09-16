import { useEffect, useState } from "react";
import { useBusinessUpi, useUpdateBusinessUpi } from "@/hooks/useBusinessUpi";
import {
  useBusinessGst,
  useUpdateBusinessGst,
  type BusinessGst,
  type RegisteredAddress,
} from "@/hooks/useBusinessGst";
import {
  Field,
  inputClass,
  selectClass,
  submitClass,
} from "@/components/form/Field";
import { gstinIssue, gstinStateCode, normalizeGstin } from "@/lib/gstin";
import { SELECTABLE_STATES, stateNameFromCode } from "@/lib/indiaStates";

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

      <BusinessGstSection />
    </div>
  );
}

function BusinessGstSection() {
  const { data, isLoading } = useBusinessGst();
  const update = useUpdateBusinessGst();

  const [form, setForm] = useState<BusinessGst | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const setField = <K extends keyof BusinessGst>(
    key: K,
    value: BusinessGst[K],
  ) => {
    setSaved(false);
    setError(null);
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const setAddress = (key: keyof RegisteredAddress, value: string) => {
    setSaved(false);
    setError(null);
    setForm((prev) =>
      prev
        ? { ...prev, registeredAddress: { ...prev.registeredAddress, [key]: value } }
        : prev,
    );
  };

  const gstinError =
    form?.gstin && form.gstin.trim() ? gstinIssue(form.gstin) : null;

  // The GSTIN's first two characters are the state it was issued in. A
  // mismatch with the registered address means one of them is mistyped, and
  // every invoice would carry the error.
  const gstinState = form?.gstin ? gstinStateCode(form.gstin) : null;
  const stateMismatch =
    gstinState && gstinState !== form?.registeredAddress.stateCode
      ? `GSTIN is registered in ${stateNameFromCode(gstinState)} (${gstinState}) but the address below says ${
          stateNameFromCode(form?.registeredAddress.stateCode) ?? "—"
        }. Fix whichever is wrong.`
      : null;

  const canSave =
    !!form &&
    form.legalName.trim().length >= 2 &&
    form.tradeName.trim().length >= 2 &&
    form.registeredAddress.line1.trim().length > 0 &&
    /^\d{6}$/.test(form.registeredAddress.pincode) &&
    !gstinError &&
    !stateMismatch &&
    !update.isPending;

  const submit = async () => {
    if (!form) return;
    setSaved(false);
    setError(null);
    try {
      await update.mutateAsync({
        ...form,
        gstin: form.gstin?.trim() ? form.gstin.trim() : null,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  };

  return (
    <section className="mt-6 rounded-card border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">Business & GST</h2>
      <p className="mt-1 text-xs text-slate-500">
        Printed on every tax invoice. Until a GSTIN is saved here, invoices are
        issued as a plain "Invoice" rather than a "Tax Invoice".
      </p>

      {isLoading || !form ? (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Legal name"
              hint="As registered with GST"
            >
              <input
                value={form.legalName}
                onChange={(e) => setField("legalName", e.target.value)}
                placeholder="Keyafe Foods"
                className={inputClass}
              />
            </Field>
            <Field label="Trade name" hint="The name customers know">
              <input
                value={form.tradeName}
                onChange={(e) => setField("tradeName", e.target.value)}
                placeholder="Keyafe"
                className={inputClass}
              />
            </Field>
          </div>

          <Field
            label="GSTIN"
            hint={
              gstinError ??
              "15 characters from your GST certificate. Leave blank if not registered."
            }
          >
            <input
              value={form.gstin ?? ""}
              onChange={(e) =>
                setField("gstin", normalizeGstin(e.target.value).slice(0, 15))
              }
              placeholder="19AAACR5055K1Z7"
              spellCheck={false}
              className={`${inputClass} font-mono tracking-wide`}
            />
          </Field>

          <Field
            label="GST scheme"
            hint="Composition dealers cannot charge GST on invoices"
          >
            <select
              value={form.gstScheme}
              onChange={(e) =>
                setField("gstScheme", e.target.value as BusinessGst["gstScheme"])
              }
              className={selectClass}
            >
              <option value="REGULAR">Regular</option>
              <option value="COMPOSITE">Composition</option>
            </select>
          </Field>

          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-xs font-semibold text-slate-700">
              Registered address
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Address line 1" className="sm:col-span-2">
                <input
                  value={form.registeredAddress.line1}
                  onChange={(e) => setAddress("line1", e.target.value)}
                  placeholder="12A, Grand Trunk Road"
                  className={inputClass}
                />
              </Field>
              <Field label="Address line 2" className="sm:col-span-2">
                <input
                  value={form.registeredAddress.line2 ?? ""}
                  onChange={(e) => setAddress("line2", e.target.value)}
                  placeholder="Belur"
                  className={inputClass}
                />
              </Field>
              <Field label="City">
                <input
                  value={form.registeredAddress.city}
                  onChange={(e) => setAddress("city", e.target.value)}
                  placeholder="Howrah"
                  className={inputClass}
                />
              </Field>
              <Field label="Pincode">
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={form.registeredAddress.pincode}
                  onChange={(e) =>
                    setAddress(
                      "pincode",
                      e.target.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  placeholder="711202"
                  className={inputClass}
                />
              </Field>
              <Field
                label="State"
                hint="Decides CGST+SGST vs IGST on every order"
                className="sm:col-span-2"
              >
                <select
                  value={form.registeredAddress.stateCode}
                  onChange={(e) => {
                    const stateCode = e.target.value;
                    setForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            registeredAddress: {
                              ...prev.registeredAddress,
                              stateCode,
                              state: stateNameFromCode(stateCode) ?? "",
                            },
                          }
                        : prev,
                    );
                    setSaved(false);
                    setError(null);
                  }}
                  className={selectClass}
                >
                  {SELECTABLE_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Invoice prefix"
              hint='Invoice numbers look like "KEY/26-27/0001"'
            >
              <input
                value={form.invoicePrefix}
                onChange={(e) =>
                  setField(
                    "invoicePrefix",
                    e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
                  )
                }
                placeholder="KEY"
                className={inputClass}
              />
            </Field>
            <Field
              label="Financial year starts"
              hint="April for the Indian FY"
            >
              <select
                value={form.fyStartMonth}
                onChange={(e) =>
                  setField("fyStartMonth", Number(e.target.value))
                }
                className={selectClass}
              >
                {MONTHS.map((month, idx) => (
                  <option key={month} value={idx + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {stateMismatch && (
            <p className="text-xs text-red-700">{stateMismatch}</p>
          )}
          {error && <p className="text-xs text-red-700">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={!canSave}
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
  );
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
