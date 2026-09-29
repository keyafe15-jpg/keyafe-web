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
    <div className="grid grid-cols-2 gap-x-2 gap-y-3 sm:gap-4">
      <Field label="Discount">
        <select
          value={type}
          onChange={(e) => onType(e.target.value as ManualDiscountType)}
          className={selectClass}
        >
          <option value="FLAT">Flat (₹)</option>
          <option value="PERCENT">Percent (%)</option>
        </select>
      </Field>
      <Field label={type === "FLAT" ? "Amount (₹)" : "Percent"}>
        <input
          type="number"
          min={0}
          max={type === "PERCENT" ? 100 : undefined}
          step={type === "FLAT" ? "1" : "0.01"}
          value={value}
          onChange={(e) => onValue(e.target.value)}
          placeholder="0"
          className={inputClass}
        />
      </Field>
    </div>
  );
}
