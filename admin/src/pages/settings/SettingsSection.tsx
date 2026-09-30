import { Pencil, X } from "lucide-react";

export function SectionHeader({
  title,
  description,
  editing,
  onEdit,
  onCancel,
}: {
  title: string;
  description: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      {editing ? (
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
          onClick={onEdit}
          className="hover:border-brand-300 inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:text-brand-700"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
      )}
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">
        {value || <span className="text-slate-400">Not set</span>}
      </dd>
    </div>
  );
}
