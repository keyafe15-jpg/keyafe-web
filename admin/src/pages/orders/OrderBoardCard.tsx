import { Link } from "react-router-dom";
import { Truck, Store, Phone, ImageOff } from "lucide-react";
import {
  useUpdateOrder,
  type AdminOrderListItem,
} from "@/hooks/useAdminOrders";
import {
  nextStatus,
  nextStatusLabel,
  SourceBadge,
  StatusPill,
} from "@/pages/orders/order-ui";
import { cn } from "@/lib/cn";

interface OrderBoardCardProps {
  order: AdminOrderListItem;
}

export function OrderBoardCard({ order }: OrderBoardCardProps) {
  const update = useUpdateOrder();
  const advance = nextStatus(order.status);
  const canAdvance =
    advance &&
    order.status !== "DELIVERED" &&
    order.status !== "CANCELLED";

  const handleAdvance = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!advance || update.isPending) return;
    update.mutate({ id: order.id, status: advance });
  };

  return (
    <article className="flex flex-col rounded-card border border-slate-200 bg-white shadow-sm transition hover:border-brand-200 hover:shadow-md">
      <Link
        to={`/orders/${order.orderNumber}`}
        className="flex flex-1 flex-col p-4"
      >
        <header className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {order.fulfillment === "DELIVERY" ? (
                <Truck className="h-4 w-4 shrink-0 text-slate-400" />
              ) : (
                <Store className="h-4 w-4 shrink-0 text-slate-400" />
              )}
              <span className="font-mono text-xs font-semibold text-slate-900">
                {order.orderNumber}
              </span>
              <StatusPill status={order.status} />
            </div>
            {order.earliestDelivery && (
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {order.earliestSlotLabel && (
                  <span>{order.earliestSlotLabel} · </span>
                )}
                {new Date(order.earliestDelivery).toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </p>
            )}
          </div>
          <SourceBadge source={order.source} />
        </header>

        <ul className="flex-1 space-y-2.5 border-t border-slate-100 pt-3">
          {order.items.map((item) => {
            const imageUrl = item.productImage ?? item.referenceImageUrl;
            return (
            <li key={item.id} className="text-sm">
              <div className="flex gap-3">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-lg border border-slate-100 object-cover"
                  />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-300">
                    <ImageOff className="h-5 w-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug text-slate-900">
                    <span className="tabular-nums text-brand-600">
                      {item.qty}×
                    </span>{" "}
                    {item.productName}
                  </p>
                  {(item.sizeLabel || item.flavourName) && (
                    <p className="mt-0.5 text-xs text-slate-600">
                      {[item.sizeLabel, item.flavourName]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {item.messageOnCake && (
                    <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900">
                      Cake message: “{item.messageOnCake}”
                    </p>
                  )}
                  {item.instructions && (
                    <p className="mt-1 text-xs text-slate-500">
                      Note: {item.instructions}
                    </p>
                  )}
                </div>
              </div>
            </li>
            );
          })}
        </ul>

        <footer className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <div className="flex min-w-0 items-center gap-1 truncate">
            <Phone className="h-3 w-3 shrink-0" />
            <span className="truncate">{order.customerName}</span>
            <span className="text-slate-300">·</span>
            <a
              href={`tel:${order.customerPhone}`}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 hover:text-brand-600"
            >
              {order.customerPhone}
            </a>
          </div>
          <span className="shrink-0 tabular-nums">
            ₹{Number(order.total).toFixed(0)} · {order.paymentMethod.toUpperCase()}
          </span>
        </footer>
      </Link>

      {canAdvance && (
        <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={handleAdvance}
            disabled={update.isPending}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition",
              advance === "READY"
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-brand-500 text-white hover:bg-brand-700",
              update.isPending && "opacity-50",
            )}
          >
            {update.isPending ? "Updating…" : nextStatusLabel(advance)}
          </button>
          <Link
            to={`/orders/${order.orderNumber}`}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Open
          </Link>
        </div>
      )}
    </article>
  );
}
