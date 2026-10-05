import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

/** Slim pill toggle for two or three mutually exclusive choices. */
export function SegmentedChoice<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-full border border-cream-200 bg-white p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition",
              active ? "bg-brand-500 text-white shadow-sm" : "text-ink-700 hover:bg-cream-50",
              o.disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
