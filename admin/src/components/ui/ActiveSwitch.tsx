import { cn } from "@/lib/cn";

export function ActiveSwitch({
  checked,
  label,
  onChange,
  disabled,
  title,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={
        title ?? (checked ? "Active — tap to hide from the storefront" : "Hidden — tap to activate")
      }
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:ring-2 focus:ring-brand-500/30 focus:outline-none disabled:opacity-50",
        checked ? "bg-emerald-500" : "bg-slate-300",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4.5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
