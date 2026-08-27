import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import {
  usePincodeCheck,
  type PincodeCheckResult,
} from "@/hooks/usePincodeCheck";
import { inputClass } from "@/components/form/Field";
import { PRODUCT_COPY } from "@/content/product";

const PIN_RE = /^[1-9][0-9]{5}$/;

export function PincodeChecker({
  onResult,
}: {
  onResult?: (result: PincodeCheckResult | null) => void;
}) {
  const [pincode, setPincode] = useState("");
  const mutation = usePincodeCheck();

  const submit = () => {
    if (!PIN_RE.test(pincode)) return;
    mutation.mutate(pincode, {
      onSuccess: (data) => onResult?.(data),
    });
  };

  useEffect(() => {
    // Clear result when user edits the pincode
    if (mutation.data) onResult?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pincode]);

  const isValid = PIN_RE.test(pincode);
  const result = mutation.data;

  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">
        {PRODUCT_COPY.labels.pincodeLabel}
      </label>
      <div className="flex gap-2">
        <input
          type="tel"
          inputMode="numeric"
          maxLength={6}
          value={pincode}
          onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={PRODUCT_COPY.labels.pincodePlaceholder}
          className={cn(inputClass, "flex-1")}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!isValid || mutation.isPending}
          className="shrink-0 rounded-lg border border-ink-700 px-4 text-sm font-medium text-ink-700 transition hover:bg-cream-100 disabled:opacity-50"
        >
          {mutation.isPending ? "…" : PRODUCT_COPY.labels.checkCta}
        </button>
      </div>

      {/* Status line */}
      <p className="mt-1 text-xs">
        {mutation.isError && (
          <span className="text-brand-500">{PRODUCT_COPY.pincode.invalid}</span>
        )}
        {!mutation.isError && !result && (
          <span className="text-ink-500">{PRODUCT_COPY.pincode.idle}</span>
        )}
        {result?.serviceable === false && (
          <span className="text-brand-500">
            {PRODUCT_COPY.pincode.unserviceable}
          </span>
        )}
        {result?.serviceable === true && (
          <span className="text-ink-700">
            ✓{" "}
            {PRODUCT_COPY.pincode.serviceable(result.city, result.deliveryFee)}
          </span>
        )}
      </p>
    </div>
  );
}
