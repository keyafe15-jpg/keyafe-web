import { normalizeGstin } from "@/lib/gstin";

/**
 * Optional B2B billing block. Kept collapsed behind a checkbox because most
 * orders are personal — only businesses claiming input tax credit need to give
 * a GSTIN, and when they do it has to appear on the tax invoice.
 */
export function BusinessGstFields({
  enabled,
  onEnabledChange,
  companyName,
  onCompanyNameChange,
  gstin,
  onGstinChange,
  companyError,
  gstinError,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  companyName: string;
  onCompanyNameChange: (value: string) => void;
  gstin: string;
  onGstinChange: (value: string) => void;
  companyError?: string;
  gstinError?: string;
}) {
  const inputClass =
    "w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

  return (
    <div className="sm:col-span-2">
      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-cream-200 text-brand-500 focus:ring-brand-500/20"
        />
        <span className="text-xs font-medium text-ink-700">
          This is a business order — I need a GST invoice
        </span>
      </label>

      {enabled && (
        <div className="mt-3 grid gap-3 rounded-lg border border-cream-200 bg-cream-50/60 p-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-medium text-ink-700">
              Company name
              <span className="text-brand-500">*</span>
            </span>
            <input
              type="text"
              value={companyName}
              onChange={(e) => onCompanyNameChange(e.target.value)}
              placeholder="Registered business name"
              className={inputClass}
            />
            {companyError && (
              <span className="mt-1 block text-[11px] text-brand-700">{companyError}</span>
            )}
          </label>

          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-medium text-ink-700">
              GSTIN
              <span className="text-brand-500">*</span>
            </span>
            <input
              type="text"
              value={gstin}
              // Normalise as they type so a pasted GSTIN with spaces or
              // lowercase still validates against the checksum.
              onChange={(e) => onGstinChange(normalizeGstin(e.target.value).slice(0, 15))}
              placeholder="27AAACR5055K1Z7"
              autoCapitalize="characters"
              spellCheck={false}
              className={`${inputClass} font-mono tracking-wide`}
            />
            <span
              className={`mt-1 block text-[11px] ${gstinError ? "text-brand-700" : "text-ink-500"}`}
            >
              {gstinError ?? "15 characters, as printed on your GST certificate"}
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
