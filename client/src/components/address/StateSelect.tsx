import { cn } from "@/lib/cn";
import { SELECTABLE_STATES } from "@/lib/indiaStates";

/**
 * Delivery state picker. Only needed for pan-India (courier) orders — local
 * zones are all in West Bengal. The chosen state decides whether GST is
 * charged as CGST + SGST or IGST, so it is a required field, not a nicety.
 */
export function StateSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (stateCode: string) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20",
        className,
      )}
    >
      <option value="">Select state</option>
      {SELECTABLE_STATES.map((state) => (
        <option key={state.code} value={state.code}>
          {state.name}
        </option>
      ))}
    </select>
  );
}
