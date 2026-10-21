import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  className,
}: {
  value: number;
  onChange: (qty: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  const qty = Number.isFinite(value) && value >= min ? Math.min(Math.round(value), max) : min;
  return (
    <div
      className={cn(
        "flex h-10 w-full min-w-0 items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white",
        className,
      )}
    >
      <button
        type="button"
        disabled={qty <= min}
        onClick={() => onChange(qty - 1)}
        aria-label="Decrease quantity"
        className="flex w-8 shrink-0 items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 sm:w-9"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="flex min-w-0 flex-1 items-center justify-center text-sm font-medium tabular-nums">
        {qty}
      </span>
      <button
        type="button"
        disabled={qty >= max}
        onClick={() => onChange(qty + 1)}
        aria-label="Increase quantity"
        className="flex w-8 shrink-0 items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 sm:w-9"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
