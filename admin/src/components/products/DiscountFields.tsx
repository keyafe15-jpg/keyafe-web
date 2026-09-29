import { useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { Price, applyFactor, priceFactorFor } from "@keyafe/shared";
import { Field, inputClass } from "@/components/form/Field";

/**
 * Discounted price for the product's starting price, editable as ₹ or % off.
 * Only the ₹ value is stored; the storefront scales every size / pound price
 * by discountedPrice / startingPrice.
 */
export function DiscountFields({
  startingPrice,
  sizes,
  perPound,
  value,
  onChange,
  inputProps,
  error,
}: {
  startingPrice: number;
  sizes: Array<{ label: string; price: number }>;
  perPound: boolean;
  value: number | string | undefined;
  onChange: (value: number | "") => void;
  inputProps: UseFormRegisterReturn;
  error?: string;
}) {
  const [pctDraft, setPctDraft] = useState<string | null>(null);
  const discounted = value === "" || value == null ? null : Number(value);
  const hasValue = discounted != null && Number.isFinite(discounted) && discounted > 0;
  const factor = hasValue ? priceFactorFor(startingPrice, discounted) : null;
  const derivedPct = factor ? String(Math.round((1 - factor) * 1000) / 10) : "";
  const tooHigh = hasValue && !factor && startingPrice > 0;

  const onPctChange = (text: string) => {
    setPctDraft(text);
    const pct = Number(text);
    if (text.trim() === "") onChange("");
    else if (pct > 0 && pct < 100 && startingPrice > 0) {
      onChange(Math.round(startingPrice * (1 - pct / 100)));
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Discount</p>
        {hasValue && (
          <button
            type="button"
            onClick={() => {
              setPctDraft(null);
              onChange("");
            }}
            className="text-xs text-slate-500 hover:text-red-600"
          >
            Remove discount
          </button>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2">
        <Field label="Discounted price (₹)" error={error}>
          <input
            type="number"
            min={0}
            step="1"
            placeholder={startingPrice > 0 ? `Below ${startingPrice.toFixed(0)}` : "—"}
            {...inputProps}
            onChange={(e) => {
              setPctDraft(null);
              void inputProps.onChange(e);
            }}
            className={inputClass}
          />
        </Field>
        <Field label="% off">
          <input
            type="number"
            min={0}
            max={99}
            step="0.5"
            inputMode="decimal"
            value={pctDraft ?? derivedPct}
            onChange={(e) => onPctChange(e.target.value)}
            onBlur={() => setPctDraft(null)}
            placeholder="e.g. 20"
            disabled={startingPrice <= 0}
            className={inputClass}
          />
        </Field>
      </div>

      {tooHigh && !error && (
        <p className="text-xs text-amber-700">
          Not applied — must be lower than the starting price (₹{startingPrice.toFixed(0)}).
        </p>
      )}

      {factor && hasValue && (
        <div className="text-xs text-slate-600">
          {sizes.length > 0 ? (
            <>
              <p className="mb-1">Customers pay, by size:</p>
              <ul className="flex flex-wrap gap-1.5">
                {sizes.map((s, i) => (
                  <li
                    key={`${s.label}-${i}`}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1"
                  >
                    <span className="mr-1 text-slate-500">{s.label || "—"}</span>
                    <Price amount={applyFactor(s.price, factor)} original={s.price} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>
              Customers pay <Price amount={discounted} original={startingPrice} showBadge />
              {perPound && " per lb"}
              {perPound && " — every pound size and flavour gets the same % off"}
            </p>
          )}
        </div>
      )}
      {!hasValue && (
        <p className="text-[11px] text-slate-400">
          {sizes.length > 0
            ? "Set for the smallest size; other sizes get the same % off."
            : "Optional. Shown struck-through on the storefront."}
        </p>
      )}
    </div>
  );
}
