import { cn } from "@/lib/cn";
import { purposeLabel } from "@/pages/expenses/books-ui";

/** After-the-fact tag — not part of logging a shop run. */
export function PurposeMark<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
        Mark as
      </p>
      <p className="mb-1.5 text-xs text-slate-500">
        You usually only know trial or waste after the bake — change it here later.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((p) => (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => onChange(p)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              value === p
                ? "border-brand-500 bg-brand-500 text-white"
                : "border-slate-200 bg-white text-slate-700",
            )}
          >
            {purposeLabel(p)}
          </button>
        ))}
      </div>
    </div>
  );
}
