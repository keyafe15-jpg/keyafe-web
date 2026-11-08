import { Field, inputClass } from "@/components/form/Field";

export function GstFields({
  cgst,
  sgst,
  igst,
  onCgst,
  onSgst,
  onIgst,
  disabled,
  inRates,
}: {
  cgst: string;
  sgst: string;
  igst: string;
  onCgst: (v: string) => void;
  onSgst: (v: string) => void;
  onIgst: (v: string) => void;
  disabled?: boolean;
  /** Buy lines already include GST — these fields are the bill split only. */
  inRates?: boolean;
}) {
  return (
    <div className="grid min-w-0 grid-cols-3 gap-1.5 sm:gap-2">
      <Field label="CGST" className="min-w-0" hint={inRates ? "Already in rates" : "Same state"}>
        <input
          inputMode="decimal"
          value={cgst}
          onChange={(e) => onCgst(e.target.value)}
          placeholder="0"
          className={`${inputClass} px-2 sm:px-3`}
          disabled={disabled}
        />
      </Field>
      <Field label="SGST" className="min-w-0">
        <input
          inputMode="decimal"
          value={sgst}
          onChange={(e) => onSgst(e.target.value)}
          placeholder="0"
          className={`${inputClass} px-2 sm:px-3`}
          disabled={disabled}
        />
      </Field>
      <Field label="IGST" className="min-w-0" hint={inRates ? "Already in rates" : "Other state"}>
        <input
          inputMode="decimal"
          value={igst}
          onChange={(e) => onIgst(e.target.value)}
          placeholder="0"
          className={`${inputClass} px-2 sm:px-3`}
          disabled={disabled}
        />
      </Field>
    </div>
  );
}

export function gstAmt(raw: string) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
