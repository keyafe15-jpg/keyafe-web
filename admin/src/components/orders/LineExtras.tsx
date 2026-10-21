import { lineDisplayNotes } from "@keyafe/shared/lineExtras";
import { cn } from "@/lib/cn";

function extraItems(extras: { group: string; names: string }[]) {
  return extras.flatMap((extra) =>
    extra.names
      .split(" · ")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ group: extra.group, name })),
  );
}

function isAddonGroup(group: string) {
  return /^(add-?ons)$/i.test(group.trim());
}

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
  const items = extraItems(extras);
  if (items.length === 0 && !notes && !message) return null;

  return (
    <div className={cn("space-y-1", className)}>
      {items.length > 0 && (
        <div
          className={cn(
            "min-w-0 rounded-lg border border-brand-200 bg-brand-50",
            compact ? "px-2 py-1.5" : "px-3 py-2",
          )}
        >
          <p
            className={cn(
              "font-bold tracking-wide text-brand-800 uppercase",
              compact ? "text-[10px]" : "text-xs",
            )}
          >
            Add-ons
            {items.length > 1 ? ` · ${items.length}` : ""}
          </p>
          <ul className={cn(compact ? "mt-1 space-y-0.5" : "mt-1.5 space-y-1")}>
            {items.map((item) => (
              <li
                key={`${item.group}:${item.name}`}
                className={cn(
                  "break-words text-brand-950",
                  compact ? "text-xs font-semibold" : "text-sm font-semibold leading-snug",
                )}
              >
                {item.name}
                {!isAddonGroup(item.group) && (
                  <span className="ml-1 font-medium text-brand-700">({item.group})</span>
                )}
              </li>
            ))}
          </ul>
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
