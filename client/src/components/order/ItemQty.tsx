import { cn } from "@/lib/cn";

/** Always-visible quantity so kitchen staff don't skim past a lone "Qty 1". */
export function ItemQty({ qty, className }: { qty: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md bg-brand-100 px-1.5 py-0.5 text-sm font-bold leading-none text-brand-700 tabular-nums",
        className,
      )}
    >
      ×{qty}
    </span>
  );
}
