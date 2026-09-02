import { Field, inputClass, selectClass } from "@/components/form/Field";
import type { ManualDiscountType } from "@/lib/manualDiscount";

export function ManualDiscountFields({
  type,
  value,
  onType,
  onValue,
}: {
  type: ManualDiscountType;
  value: string;
  onType: (t: ManualDiscountType) => void;
  onValue: (v: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Discount type">
        <select
          value={type}
          onChange={(e) => onType(e.target.value as ManualDiscountType)}
          className={selectClass}
        >
          <option value="FLAT">Flat (₹)</option>
          <option value="PERCENT">Percent (%)</option>
        </select>
      </Field>
      <Field
        label={type === "FLAT" ? "Amount (₹)" : "Percent"}
        hint="Optional. Applied on items only — not delivery."
      >
        <input
          type="number"
          min={0}
          max={type === "PERCENT" ? 100 : undefined}
          step={type === "FLAT" ? "1" : "0.01"}
          value={value}
          onChange={(e) => onValue(e.target.value)}
          placeholder={type === "FLAT" ? "0" : "0"}
          className={inputClass}
        />
      </Field>
    </div>
  );
}
