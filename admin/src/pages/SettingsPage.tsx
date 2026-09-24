import { useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
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
  textareaClass,
} from "@/components/form/Field";
import { gstinIssue, gstinStateCode, normalizeGstin } from "@/lib/gstin";
import { SELECTABLE_STATES, stateNameFromCode } from "@/lib/indiaStates";
import { cn } from "@/lib/cn";

export function SettingsPage() {
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">Business, GST, invoicing.</p>

      <UpiSettingsSection />
      <BusinessGstSection />
    </div>
  );
}

function SectionHeader({
  title,
  description,
  editing,
  onEdit,
  onCancel,
}: {
  title: string;
  description: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      {editing ? (
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
      ) : (
        <button
          type="button"
          onClick={onEdit}
          className="hover:border-brand-300 inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:text-brand-700"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">
        {value || <span className="text-slate-400">Not set</span>}
      </dd>
    </div>
  );
}

function UpiSettingsSection() {
  const { data, isLoading } = useBusinessUpi();
  const update = useUpdateBusinessUpi();

  const [editing, setEditing] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [upiPayeeName, setUpiPayeeName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setUpiId(data.upiId ?? "");
      setUpiPayeeName(data.upiPayeeName ?? "");
      // First visit with nothing configured → open the form.
      if (!data.upiId && !data.upiPayeeName) setEditing(true);
    }
  }, [data]);

  const resetFromServer = () => {
    setUpiId(data?.upiId ?? "");
    setUpiPayeeName(data?.upiPayeeName ?? "");
    setError(null);
  };

  const submit = async () => {
    setError(null);
    try {
      await update.mutateAsync({
        upiId: upiId.trim() || null,
        upiPayeeName: upiPayeeName.trim() || null,
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  };

  return (
    <section className="mt-6 rounded-card border border-slate-200 bg-white p-5">
      <SectionHeader
        title="UPI payment collection"
        description="Shown to customers on order links so they can pay you directly — no gateway, no fees."
        editing={editing}
        onEdit={() => {
          resetFromServer();
          setEditing(true);
        }}
        onCancel={() => {
          resetFromServer();
          setEditing(false);
        }}
      />

      {isLoading ? (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      ) : editing ? (
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
              placeholder="Keyafe Foods"
              className={inputClass}
            />
          </Field>
          {error && <p className="text-xs text-red-700">{error}</p>}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={update.isPending}
            className={submitClass}
          >
            {update.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      ) : (
        <dl className="mt-4 space-y-3 rounded-lg border border-slate-100 bg-slate-50/70 p-4">
          <InfoRow label="UPI ID" value={data?.upiId} />
          <InfoRow label="Payee name" value={data?.upiPayeeName} />
        </dl>
      )}
    </section>
  );
}

function BusinessGstSection() {
  const { data, isLoading } = useBusinessGst();
  const update = useUpdateBusinessGst();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<BusinessGst | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setForm(data);
      // Open form only when the business profile has never been filled in.
      if (!data.legalName.trim() || !data.tradeName.trim()) setEditing(true);
    }
  }, [data]);

  const resetFromServer = () => {
    if (data) setForm(data);
    setError(null);
  };

  const setField = <K extends keyof BusinessGst>(key: K, value: BusinessGst[K]) => {
    setError(null);
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const setAddress = (key: keyof RegisteredAddress, value: string) => {
    setError(null);
    setForm((prev) =>
      prev ? { ...prev, registeredAddress: { ...prev.registeredAddress, [key]: value } } : prev,
    );
  };

  const gstinError = form?.gstin && form.gstin.trim() ? gstinIssue(form.gstin) : null;

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
    setError(null);
    try {
      await update.mutateAsync({
        ...form,
        gstin: form.gstin?.trim() ? form.gstin.trim() : null,
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  };

  const addr = data?.registeredAddress;
  const addressLines = addr
    ? [addr.line1, addr.line2, [addr.city, addr.pincode].filter(Boolean).join(" — "), addr.state]
        .filter(Boolean)
        .join(", ")
    : null;

  return (
    <section className="mt-6 rounded-card border border-slate-200 bg-white p-5">
      <SectionHeader
        title="Business & GST"
        description='Printed on every tax invoice. Until a GSTIN is saved here, invoices are issued as a plain "Invoice" rather than a "Tax Invoice".'
        editing={editing}
        onEdit={() => {
          resetFromServer();
          setEditing(true);
        }}
        onCancel={() => {
          resetFromServer();
          setEditing(false);
        }}
      />

      {isLoading || !form || !data ? (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      ) : editing ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Legal name" hint="As registered with GST">
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
              onChange={(e) => setField("gstin", normalizeGstin(e.target.value).slice(0, 15))}
              placeholder="19AAACR5055K1Z7"
              spellCheck={false}
              className={cn(inputClass, "font-mono tracking-wide")}
            />
          </Field>

          <Field label="GST scheme" hint="Composition dealers cannot charge GST on invoices">
            <select
              value={form.gstScheme}
              onChange={(e) => setField("gstScheme", e.target.value as BusinessGst["gstScheme"])}
              className={selectClass}
            >
              <option value="REGULAR">Regular</option>
              <option value="COMPOSITE">Composition</option>
            </select>
          </Field>

          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-xs font-semibold text-slate-700">Registered address</p>
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
                    setAddress("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))
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
            <Field label="Invoice prefix" hint='Invoice numbers look like "KEY/26-27/0001"'>
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
            <Field label="Financial year starts" hint="April for the Indian FY">
              <select
                value={form.fyStartMonth}
                onChange={(e) => setField("fyStartMonth", Number(e.target.value))}
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

          <Field
            label="Delivery challan terms"
            hint="Printed in the terms box on every challan. Leave blank to omit the box."
          >
            <textarea
              value={form.challanTerms ?? ""}
              onChange={(e) => setField("challanTerms", e.target.value)}
              rows={3}
              maxLength={600}
              placeholder="Goods once delivered will not be taken back. Please check the goods and quantity before signing."
              className={textareaClass}
            />
          </Field>

          {stateMismatch && <p className="text-xs text-red-700">{stateMismatch}</p>}
          {error && <p className="text-xs text-red-700">{error}</p>}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSave}
            className={submitClass}
          >
            {update.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      ) : (
        <dl className="mt-4 space-y-3 rounded-lg border border-slate-100 bg-slate-50/70 p-4">
          <InfoRow label="Legal name" value={data.legalName} />
          <InfoRow label="Trade name" value={data.tradeName} />
          <InfoRow
            label="GSTIN"
            value={
              data.gstin ? (
                <span className="font-mono tracking-wide">{data.gstin}</span>
              ) : (
                "Not registered"
              )
            }
          />
          <InfoRow
            label="GST scheme"
            value={data.gstScheme === "COMPOSITE" ? "Composition" : "Regular"}
          />
          <InfoRow label="Address" value={addressLines} />
          <InfoRow label="Invoice prefix" value={data.invoicePrefix} />
          <InfoRow
            label="FY starts"
            value={MONTHS[data.fyStartMonth - 1] ?? `Month ${data.fyStartMonth}`}
          />
          <InfoRow label="Challan terms" value={data.challanTerms} />
        </dl>
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
