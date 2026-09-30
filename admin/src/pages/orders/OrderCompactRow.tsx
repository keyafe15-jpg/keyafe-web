import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Gift, Hourglass, ImageOff, MessageSquareText, Phone, Store, Truck } from "lucide-react";
import type { OrderFulfillment, OrderStatus } from "@/hooks/useAdminOrders";
import { StatusPill } from "@/pages/orders/order-ui";
import { cn } from "@/lib/cn";

interface CompactItem {
  id: string;
  qty: number;
  productName: string;
  productImage: string | null;
  referenceImageUrl: string | null;
  sizeLabel: string | null;
  flavourName: string | null;
  messageOnCake: string | null;
}

interface OrderCompactRowProps {
  orderNumber: string;
  status: OrderStatus;
  fulfillment: OrderFulfillment;
  heading: string;
  items: CompactItem[];
  customer: string;
  place?: string;
  phone?: string;
  isSurpriseGift?: boolean;
  awaitingPayment?: boolean;
  action?: ReactNode;
  className?: string;
}

/**
 * A dense tile for phone screens, laid out two per row, where the full order
 * cards leave room for only one or two orders per screen.
 */
export function OrderCompactRow({
  orderNumber,
  status,
  fulfillment,
  heading,
  items,
  customer,
  place,
  phone,
  isSurpriseGift,
  awaitingPayment,
  action,
  className,
}: OrderCompactRowProps) {
  const first = items[0];
  const imageUrl = first ? (first.productImage ?? first.referenceImageUrl) : null;
  const extraItems = items.length - 1;
  const hasMessage = items.some((i) => i.messageOnCake?.trim());
  const firstSpecs = first ? [first.sizeLabel, first.flavourName].filter(Boolean).join(" · ") : "";
  const specsLine = [firstSpecs, extraItems > 0 ? `+${extraItems} more` : ""]
    .filter(Boolean)
    .join(" · ");
  const [title, ...rest] = heading.split(" · ");
  const subtitle = rest.join(" · ");

  return (
    <article
      className={cn(
        "relative flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm active:bg-slate-50",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="relative shrink-0">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="h-11 w-11 rounded-lg border border-slate-100 object-cover"
            />
          ) : (
            <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-300">
              <ImageOff className="h-4 w-4" />
            </span>
          )}
          {extraItems > 0 && (
            <span className="absolute -right-1.5 -bottom-1.5 rounded-full bg-slate-900 px-1.5 text-[10px] leading-4 font-semibold text-white ring-2 ring-white">
              +{extraItems}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col items-end gap-1">
          <StatusPill status={status} />
          <div className="flex items-center gap-1">
            {hasMessage && (
              <MessageSquareText
                className="h-3.5 w-3.5 text-amber-600"
                aria-label="Has cake message"
              />
            )}
            {isSurpriseGift && (
              <Gift className="h-3.5 w-3.5 text-violet-600" aria-label="Surprise gift" />
            )}
            {awaitingPayment && (
              <Hourglass className="h-3.5 w-3.5 text-amber-600" aria-label="Awaiting payment" />
            )}
          </div>
        </div>
      </div>

      <Link
        to={`/orders/${orderNumber}`}
        className="mt-2 truncate text-sm font-semibold text-slate-900 after:absolute after:inset-0 after:rounded-xl"
      >
        {title}
      </Link>
      {subtitle && <p className="truncate text-[11px] text-slate-500">{subtitle}</p>}

      {first && (
        <>
          <p className="mt-1.5 line-clamp-2 text-xs leading-snug font-medium text-slate-800">
            <span className="text-brand-600 tabular-nums">{first.qty}×</span> {first.productName}
          </p>
          {specsLine && <p className="truncate text-[11px] text-slate-500">{specsLine}</p>}
        </>
      )}

      <div className="mt-1.5 flex min-w-0 items-center gap-1 text-[11px] text-slate-500">
        {fulfillment === "DELIVERY" ? (
          <Truck className="h-3 w-3 shrink-0 text-slate-400" aria-label="Delivery" />
        ) : (
          <Store className="h-3 w-3 shrink-0 text-slate-400" aria-label="Pickup" />
        )}
        <span className="truncate">
          {customer}
          {place ? ` · ${place}` : ""}
        </span>
      </div>
      <p className="truncate font-mono text-[10px] text-slate-400">{orderNumber}</p>

      {(phone || action) && (
        <div className="mt-auto flex items-center gap-1.5 pt-2">
          {phone && (
            <a
              href={`tel:${phone}`}
              className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:text-brand-600"
              aria-label={`Call ${phone}`}
            >
              <Phone className="h-3.5 w-3.5" />
            </a>
          )}
          {action && <div className="relative z-10 min-w-0 flex-1">{action}</div>}
        </div>
      )}
    </article>
  );
}
