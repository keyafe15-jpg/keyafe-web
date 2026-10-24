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
    <div className="grid grid-cols-3 gap-2">
      <Field label="CGST" hint={inRates ? "Already in rates" : "Same state"}>
        <input
          inputMode="decimal"
          value={cgst}
          onChange={(e) => onCgst(e.target.value)}
          placeholder="0"
          className={inputClass}
          disabled={disabled}
        />
      </Field>
      <Field label="SGST">
        <input
          inputMode="decimal"
          value={sgst}
          onChange={(e) => onSgst(e.target.value)}
          placeholder="0"
          className={inputClass}
          disabled={disabled}
        />
      </Field>
      <Field label="IGST" hint={inRates ? "Already in rates" : "Other state"}>
        <input
          inputMode="decimal"
          value={igst}
          onChange={(e) => onIgst(e.target.value)}
          placeholder="0"
          className={inputClass}
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
