import { lineDisplayNotes } from "@keyafe/shared/lineExtras";
import { cn } from "@/lib/cn";

export function LineExtras({
  instructions,
  messageOnCake,
  className,
}: {
  instructions?: string | null;
  messageOnCake?: string | null;
  className?: string;
}) {
  const { extras, notes, message } = lineDisplayNotes({ instructions, messageOnCake });
  if (extras.length === 0 && !notes && !message) return null;

  return (
    <div className={cn("space-y-1", className)}>
      {extras.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-brand-700 uppercase">
            Add-ons
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {extras.map((extra) => (
              <span
                key={`${extra.group}:${extra.names}`}
                className="inline-flex max-w-full items-baseline gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800"
              >
                <span className="shrink-0 font-semibold">{extra.group}</span>
                <span className="min-w-0 truncate">{extra.names}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {message && <p className="text-xs text-ink-500 italic">"{message}"</p>}
      {notes && (
        <p className="text-xs text-ink-700">
          <span className="text-ink-400">Notes: </span>
          {notes}
        </p>
      )}
    </div>
  );
}
