import { Field, inputClass, selectClass } from "@/components/form/Field";
import { isGramsWithinBounds } from "@/lib/productConfiguration";
import type { CakeSize } from "@/hooks/useCakeSizes";
import { cn } from "@/lib/cn";

export const CAKE_SIZE_OTHER = "__other__";

export function allowedCakeSizes(
  sizes: CakeSize[],
  minGrams?: number | null,
  maxGrams?: number | null,
): CakeSize[] {
  return sizes.filter(
    (s) => s.isActive && isGramsWithinBounds(s.grams, minGrams, maxGrams),
  );
}

export function CakeSizeField({
  sizes,
  cakeSizeId,
  customPounds,
  minGrams,
  maxGrams,
  error,
  className,
  poundsClassName,
  onPickNamed,
  onOtherPounds,
}: {
  sizes: CakeSize[];
  cakeSizeId: string;
  customPounds: string;
  minGrams?: number | null;
  maxGrams?: number | null;
  error?: string;
  className?: string;
  poundsClassName?: string;
  onPickNamed: (size: CakeSize) => void;
  onOtherPounds: (pounds: string) => void;
}) {
  const allowed = allowedCakeSizes(sizes, minGrams, maxGrams);
  const named = Boolean(cakeSizeId && allowed.some((s) => s.id === cakeSizeId));
  const selectValue = named ? cakeSizeId : allowed.length ? CAKE_SIZE_OTHER : "";
  const showPounds = allowed.length === 0 || selectValue === CAKE_SIZE_OTHER;

  return (
    <>
      {allowed.length > 0 && (
        <Field label="Size" required className={className}>
          <select
            value={selectValue}
            onChange={(e) => {
              const value = e.target.value;
              if (value === CAKE_SIZE_OTHER) {
                onOtherPounds(customPounds.trim() || "1");
                return;
              }
              const size = allowed.find((s) => s.id === value);
              if (size) onPickNamed(size);
            }}
            className={cn(selectClass, "pl-2.5")}
          >
            {allowed.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
            <option value={CAKE_SIZE_OTHER}>Other</option>
          </select>
        </Field>
      )}
      {showPounds && (
        <Field label="Pounds" required error={error} className={poundsClassName ?? className}>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={minGrams ? minGrams / 500 : 0.1}
              max={maxGrams ? maxGrams / 500 : undefined}
              step={0.1}
              value={customPounds}
              onChange={(e) => onOtherPounds(e.target.value)}
              placeholder="1"
              className={cn(inputClass, "w-full px-2")}
            />
            <span className="shrink-0 text-xs text-slate-500">lb</span>
          </div>
        </Field>
      )}
    </>
  );
}
