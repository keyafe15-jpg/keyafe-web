import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = 9999,
  className,
}: {
  value: number;
  onChange: (qty: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  const qty = Number.isFinite(value) && value >= min ? Math.min(Math.round(value), max) : min;
  const [draft, setDraft] = useState(String(qty));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(qty));
  }, [qty, focused]);

  const commit = (raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < min) {
      onChange(min);
      setDraft(String(min));
      return;
    }
    const next = clamp(n, min, max);
    onChange(next);
    setDraft(String(next));
  };

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
      <input
        type="text"
        inputMode="numeric"
        aria-label="Quantity"
        value={focused ? draft : String(qty)}
        onFocus={() => {
          setFocused(true);
          setDraft(String(qty));
        }}
        onBlur={() => {
          setFocused(false);
          commit(draft);
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, "");
          setDraft(raw);
          if (!raw) return;
          const n = Number(raw);
          if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="min-w-0 flex-1 bg-transparent text-center text-sm font-medium tabular-nums text-slate-900 outline-none"
      />
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
