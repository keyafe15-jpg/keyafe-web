import type { ReactNode } from "react";
import { lineDisplayNotes } from "@keyafe/shared/lineExtras";
import { RefImageStrip } from "@/components/orders/RefImageStrip";
import { cn } from "@/lib/cn";

export type OrderItemSummaryData = {
  name: string;
  qty: number;
  imageUrls?: string[];
  sizeLine?: string;
  flavour?: string;
  description?: string;
  messageOnCake?: string | null;
  instructions?: string | null;
  unitPrice?: number;
  lineTotal?: number;
};

function isQuietGroup(group: string) {
  return /^(crust|toppings|condiments)$/i.test(group.trim());
}

function isUrgentGroup(group: string) {
  return /candle|topper/i.test(group);
}

function isAddonOnlyGroup(group: string) {
  return /^(add-?ons)$/i.test(group.trim());
}

function highlightedExtras(extras: { group: string; names: string }[]) {
  return extras.filter((extra) => !isQuietGroup(extra.group));
}

/** Cake message, notes, and highlighted add-ons (candles / toppers / add-ons). */
export function OrderItemExtras({
  messageOnCake,
  instructions,
  className,
}: {
  messageOnCake?: string | null;
  instructions?: string | null;
  className?: string;
}) {
  const { extras, notes, message } = lineDisplayNotes({ instructions, messageOnCake });
  const items = highlightedExtras(extras);
  if (!message && !notes && items.length === 0) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      {message && (
        <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs font-medium leading-snug break-words text-amber-950">
          Write: “{message}”
        </p>
      )}
      {notes && (
        <p className="rounded-md bg-slate-50 px-2 py-1.5 text-xs leading-snug break-words text-slate-700">
          Notes: {notes}
        </p>
      )}
      {items.map((item) => {
        const urgent = isUrgentGroup(item.group);
        const label = isAddonOnlyGroup(item.group)
          ? item.names
          : `${item.group}: ${item.names}`;
        return (
          <p
            key={`${item.group}:${item.names}`}
            className={cn(
              "rounded-md px-2 py-1.5 text-xs font-medium leading-snug break-words",
              urgent ? "bg-amber-50 text-amber-950" : "bg-brand-50 text-brand-950",
            )}
          >
            {label}
          </p>
        );
      })}
    </div>
  );
}

export function hasOrderItemExtras(input: {
  messageOnCake?: string | null;
  instructions?: string | null;
}): boolean {
  const { extras, notes, message } = lineDisplayNotes(input);
  return Boolean(message || notes || highlightedExtras(extras).length);
}

/**
 * Compact readonly line used while taking an order and on the order view page.
 * Amount sits under the thumbnail so the name can use leftover width.
 */
export function OrderItemSummary({
  item,
  index,
  actions,
  footer,
  onActivate,
  className,
}: {
  item: OrderItemSummaryData;
  index?: number;
  actions?: ReactNode;
  footer?: ReactNode;
  onActivate?: () => void;
  className?: string;
}) {
  const urls = item.imageUrls ?? [];
  const qty = item.qty || 1;
  const unit = item.unitPrice ?? 0;
  const total = item.lineTotal ?? unit * qty;
  const parsed = lineDisplayNotes({
    messageOnCake: item.messageOnCake,
    instructions: item.instructions,
  });
  const crustLine = parsed.extras
    .filter((extra) => /^crust$/i.test(extra.group.trim()))
    .map((extra) => extra.names)
    .filter(Boolean)
    .join(" · ");
  const quietLine = parsed.extras
    .filter((extra) => /^(toppings|condiments)$/i.test(extra.group.trim()))
    .map((extra) => extra.names)
    .filter(Boolean)
    .join(" · ");
  const sizeLine = uniqueBits([item.sizeLine, crustLine, item.flavour]).join(" · ");
  const titleClass = "min-w-0 flex-1 text-left";
  const titleBody = (
    <>
      <p className="text-sm font-medium leading-snug break-words text-slate-900">
        {item.name}
        {index != null && (
          <span className="ml-1.5 text-[11px] font-normal text-slate-400">#{index + 1}</span>
        )}
      </p>
      {sizeLine && (
        <p className="mt-1 text-[12px] font-medium leading-snug break-words text-slate-800">
          {sizeLine}
        </p>
      )}
      {quietLine && (
        <p className="mt-0.5 text-[12px] leading-snug break-words text-slate-500">{quietLine}</p>
      )}
      {item.description && (
        <p className="mt-0.5 text-[12px] leading-snug whitespace-pre-line break-words text-slate-600">
          {item.description}
        </p>
      )}
    </>
  );

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-start gap-2.5">
        <div className="flex w-16 shrink-0 flex-col items-center gap-1">
          <div className="relative">
            <RefImageStrip urls={urls} alt={item.name} size="h-12 w-12" />
            <span className="absolute -right-1 -bottom-1 rounded-md bg-slate-900 px-1 py-0.5 text-[10px] font-bold leading-none text-white tabular-nums">
              ×{qty}
            </span>
          </div>
          <div className="w-full text-center">
            <p className="text-sm font-semibold leading-tight tabular-nums text-slate-900">
              {unit > 0 || total > 0 ? `₹${total.toFixed(total % 1 ? 2 : 0)}` : "—"}
            </p>
            {unit > 0 && qty > 1 && (
              <p className="text-[10px] leading-tight tabular-nums text-slate-400">
                ₹{unit.toFixed(0)} each
              </p>
            )}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-start gap-1">
          {onActivate ? (
            <button type="button" onClick={onActivate} className={titleClass}>
              {titleBody}
            </button>
          ) : (
            <div className={titleClass}>{titleBody}</div>
          )}
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </div>
      <OrderItemExtras
        className="mt-2"
        messageOnCake={item.messageOnCake}
        instructions={item.instructions}
      />
      {footer ? <div className="mt-2">{footer}</div> : null}
    </div>
  );
}

function uniqueBits(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const bits: string[] = [];
  for (const value of values) {
    const bit = value?.trim() ?? "";
    if (!bit) continue;
    const key = bit.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    bits.push(bit);
  }
  return bits;
}
