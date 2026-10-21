import { lineDisplayNotes } from "@keyafe/shared/lineExtras";
import { cn } from "@/lib/cn";

export function LineExtras({
  instructions,
  messageOnCake,
  className,
  compact,
}: {
  instructions?: string | null;
  messageOnCake?: string | null;
  className?: string;
  compact?: boolean;
}) {
  const { extras, notes, message } = lineDisplayNotes({ instructions, messageOnCake });
  if (extras.length === 0 && !notes && !message) return null;

  return (
    <div className={cn("space-y-1", className)}>
      {extras.length > 0 && (
        <div>
          {!compact && (
            <p className="text-[10px] font-semibold tracking-wide text-brand-700 uppercase">
              Add-ons
            </p>
          )}
          <div className={cn("flex flex-wrap gap-1", !compact && "mt-1")}>
            {extras.map((extra) => (
              <span
                key={`${extra.group}:${extra.names}`}
                className="inline-flex max-w-full items-baseline gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800 ring-1 ring-brand-200"
              >
                <span className="shrink-0 font-semibold">{extra.group}</span>
                <span className="min-w-0 truncate">{extra.names}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {message && (
        <p className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900">
          Cake message: “{message}”
        </p>
      )}
      {notes && <p className="text-xs text-slate-600">Notes: {notes}</p>}
    </div>
  );
}
