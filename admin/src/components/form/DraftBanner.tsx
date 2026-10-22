import { Link } from "react-router-dom";

export function DraftBanner({
  title,
  summary,
  kindLabel,
  to,
  onContinue,
  onDiscard,
}: {
  title: string;
  summary: string;
  kindLabel: string;
  to?: string;
  onContinue?: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-900">{title}</p>
        <p className="truncate text-xs text-slate-500">
          {kindLabel}
          {summary ? ` · ${summary}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-800 uppercase">
          Draft
        </span>
        <div className="flex items-center gap-1.5">
          {to ? (
            <Link
              to={to}
              className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-slate-700"
            >
              Continue
            </Link>
          ) : (
            <button
              type="button"
              onClick={onContinue}
              className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-slate-700"
            >
              Continue
            </button>
          )}
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
