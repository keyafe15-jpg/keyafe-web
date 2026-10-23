import { useState } from "react";
import { Field, inputClass, textareaClass } from "@/components/form/Field";
import { AddressPlacesSearch } from "@/components/address/AddressPlacesSearch";
import { cn } from "@/lib/cn";
import { gstinIssue, normalizeGstin } from "@/lib/gstin";
import { supplyLabel, VENDOR_SUPPLY_TAGS, type VendorChannel } from "@/pages/vendors/vendor-ui";
import { VendorChannelField } from "@/pages/vendors/VendorChannelField";
import type { AdminVendor, VendorWritePayload } from "@/hooks/useAdminVendors";

export function VendorForm({
  vendor,
  pending,
  error,
  saved,
  onSubmit,
  submitLabel,
}: {
  vendor?: AdminVendor;
  pending: boolean;
  error: string | null;
  saved?: boolean;
  onSubmit: (body: VendorWritePayload) => void;
  submitLabel: string;
}) {
  const [name, setName] = useState(vendor?.name ?? "");
  const [phone, setPhone] = useState(vendor?.phone ?? "");
  const [channel, setChannel] = useState<VendorChannel>(vendor?.channel ?? "OFFLINE");
  const [supplies, setSupplies] = useState<string[]>(vendor?.supplies ?? []);
  const [customSupply, setCustomSupply] = useState("");
  const [gstin, setGstin] = useState(vendor?.gstin ?? "");
  const [upiId, setUpiId] = useState(vendor?.upiId ?? "");
  const [accountHint, setAccountHint] = useState(vendor?.accountHint ?? "");
  const [address, setAddress] = useState(vendor?.address ?? "");
  const [notes, setNotes] = useState(vendor?.notes ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  const gstinTrimmed = gstin.trim();
  const gstinError = gstinTrimmed ? gstinIssue(gstinTrimmed) : null;

  const toggleSupply = (tag: string) => {
    setSupplies((prev) => (prev.includes(tag) ? prev.filter((s) => s !== tag) : [...prev, tag]));
  };

  const addCustom = () => {
    const tag = customSupply.trim().toLowerCase().replace(/\s+/g, "-");
    if (!tag) return;
    if (!supplies.includes(tag)) setSupplies((prev) => [...prev, tag]);
    setCustomSupply("");
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setLocalError(null);
        if (!name.trim()) {
          setLocalError("Name is required.");
          return;
        }
        if (gstinError) {
          setLocalError(gstinError);
          return;
        }
        onSubmit({
          name: name.trim(),
          phone: phone.trim() || null,
          channel,
          supplies,
          gstin: gstinTrimmed ? normalizeGstin(gstinTrimmed) : null,
          upiId: upiId.trim() || null,
          accountHint: accountHint.trim() || null,
          address: address.trim() || null,
          notes: notes.trim() || null,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
        <Field label="Name" required>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Phone">
          <input
            value={phone}
            inputMode="tel"
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <VendorChannelField value={channel} onChange={setChannel} />

      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
        <Field label="GSTIN" hint="Optional. Validated if you fill it.">
          <input
            value={gstin}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
            className={inputClass}
            autoComplete="off"
          />
        </Field>
        <Field label="UPI">
          <input
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            className={inputClass}
            placeholder="name@upi"
          />
        </Field>
        <Field
          label="Search on map"
          className="min-[480px]:col-span-2"
          hint="Optional. Pick a nearby place if Google has it."
        >
          <AddressPlacesSearch
            value={address}
            onChange={setAddress}
            onPlaceSelect={(place) => {
              setAddress(place.mapSearchQuery || place.line1 || address);
            }}
            placeholder="Shop, market, or area"
          />
        </Field>
        <Field
          label="Address"
          className="min-[480px]:col-span-2"
          hint="Type it yourself when the shop is not on the map — market, lane, landmark."
        >
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            placeholder="e.g. Shop 12, Bikram Super Market, Dunlop"
            className={textareaClass}
          />
        </Field>
        <Field label="Pay hint" className="min-[480px]:col-span-2" hint="Bank last-4, cash only, Monday market…">
          <input
            value={accountHint}
            onChange={(e) => setAccountHint(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium tracking-wide text-slate-500 uppercase">
          What they sell
        </p>
        <div className="flex flex-wrap gap-1.5">
          {VENDOR_SUPPLY_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              aria-pressed={supplies.includes(tag)}
              onClick={() => toggleSupply(tag)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition",
                supplies.includes(tag)
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-brand-300",
              )}
            >
              {supplyLabel(tag)}
            </button>
          ))}
          {supplies
            .filter((s) => !(VENDOR_SUPPLY_TAGS as readonly string[]).includes(s))
            .map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleSupply(tag)}
                className="rounded-full border border-brand-500 bg-brand-500 px-2.5 py-0.5 text-[11px] font-medium text-white"
              >
                {supplyLabel(tag)}
              </button>
            ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={customSupply}
            onChange={(e) => setCustomSupply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="Other (type + Enter)"
            className={cn(inputClass, "h-8 py-1")}
          />
        </div>
      </div>

      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={textareaClass}
          rows={3}
        />
      </Field>

      {(localError || error) && <p className="text-xs text-red-700">{localError || error}</p>}
      {saved && !localError && !error && (
        <p className="text-xs text-emerald-700">Saved.</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
