import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import { usePincodeCheck, type PincodeCheckResult } from "@/hooks/usePincodeCheck";
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
      <div className="relative">
        <MapPin className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-500" />
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
          aria-label={PRODUCT_COPY.labels.pincodeLabel}
          placeholder={PRODUCT_COPY.labels.pincodeCompactPlaceholder}
          className={cn(inputClass, "pr-20 pl-9")}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!isValid || mutation.isPending}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md bg-ink-700 px-3 py-1 text-xs font-medium text-white transition hover:bg-ink-900 disabled:bg-cream-200 disabled:text-ink-500"
        >
          {mutation.isPending ? "…" : PRODUCT_COPY.labels.checkCta}
        </button>
      </div>

      {(mutation.isError || result) && (
        <p className="mt-1 text-xs" aria-live="polite">
          {mutation.isError && (
            <span className="text-brand-500">{PRODUCT_COPY.pincode.invalid}</span>
          )}
          {result?.serviceable === false && (
            <span className="text-brand-500">{PRODUCT_COPY.pincode.unserviceable}</span>
          )}
          {result?.serviceable === true && (
            <span className="text-ink-700">
              ✓ {PRODUCT_COPY.pincode.serviceable(result.city, result.deliveryFee)}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
