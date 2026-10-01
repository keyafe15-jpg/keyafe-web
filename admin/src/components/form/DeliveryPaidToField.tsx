import { cn } from "@/lib/cn";

const OPTIONS = [
  { paidToRider: true, label: "Rider (Rapido)" },
  { paidToRider: false, label: "Us" },
];

/** Who the customer pays the delivery charge to. Rider = noted only, not billed or counted. */
export function DeliveryPaidToField({
  paidToRider,
  onChange,
  disabled,
  className,
}: {
  paidToRider: boolean;
  onChange: (paidToRider: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className="mb-1 block text-xs font-medium tracking-wide text-slate-500 uppercase">
        Delivery paid to
      </span>
      <div
        role="radiogroup"
        aria-label="Delivery paid to"
        className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
      >
        {OPTIONS.map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={paidToRider === o.paidToRider}
            disabled={disabled}
            onClick={() => onChange(o.paidToRider)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition disabled:opacity-60",
              paidToRider === o.paidToRider
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {paidToRider
          ? "Customer pays the rider. Noted on the order, not added to the bill or sales."
          : "Added to the bill and counted in sales."}
      </p>
    </div>
  );
}
