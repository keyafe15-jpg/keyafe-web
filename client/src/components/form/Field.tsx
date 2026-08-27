import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-brand-500">
            *
          </span>
        )}
      </span>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-brand-500">{error}</p>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

export const textareaClass =
  "w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-y min-h-24";

export const submitClass =
  "w-full rounded-full bg-brand-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60";
