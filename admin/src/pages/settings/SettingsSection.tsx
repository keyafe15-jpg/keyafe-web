import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Pencil, X } from "lucide-react";
import { cn } from "@/lib/cn";

export function SettingsCard({
  title,
  description,
  editing,
  onEdit,
  onCancel,
  children,
}: {
  title: string;
  description?: string;
  editing?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (editing) setOpen(true);
  }, [editing]);

  return (
    <section className="min-w-0 rounded-card border border-slate-200 bg-white">
      <div className="flex items-start gap-2 p-4 sm:p-5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            if (!editing) setOpen((v) => !v);
          }}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition",
              !open && "-rotate-90",
            )}
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">{title}</span>
            {open && description && (
              <span className="mt-1 block text-xs text-slate-500">{description}</span>
            )}
          </span>
        </button>
        {onEdit &&
          (editing ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                onEdit();
              }}
              className="hover:border-brand-300 inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:text-brand-700"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          ))}
      </div>
      {open && (
        <div className="border-t border-slate-100 px-4 py-4 sm:px-5 sm:py-5">{children}</div>
      )}
    </section>
  );
}

export function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-0.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 text-sm break-words text-slate-900">
        {value || <span className="text-slate-400">Not set</span>}
      </dd>
    </div>
  );
}
