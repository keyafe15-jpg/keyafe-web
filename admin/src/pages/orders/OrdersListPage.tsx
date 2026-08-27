import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Store, Phone, ChevronRight } from "lucide-react";
import {
  useAdminOrders,
  useAdminOrderCounts,
  type OrderStatus,
} from "@/hooks/useAdminOrders";
import { cn } from "@/lib/cn";

const TABS: { key: OrderStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "IN_KITCHEN", label: "In kitchen" },
  { key: "READY", label: "Ready" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "CANCELLED", label: "Cancelled" },
];

export function OrdersListPage() {
  const [tab, setTab] = useState<OrderStatus | "ALL">("ALL");
  const [deliveryFrom, setDeliveryFrom] = useState<string>("");
  const [deliveryTo, setDeliveryTo] = useState<string>("");
  const { data: orders = [], isLoading } = useAdminOrders({
    status: tab === "ALL" ? null : tab,
    deliveryFrom: deliveryFrom || null,
    deliveryTo: deliveryTo || null,
  });
  const { data: counts } = useAdminOrderCounts();
  const navigate = useNavigate();

  const rangeActive = !!(deliveryFrom || deliveryTo);
  const rangeInvalid = deliveryFrom && deliveryTo && deliveryFrom > deliveryTo;

  const clearRange = () => {
    setDeliveryFrom("");
    setDeliveryTo("");
  };
  const setQuickRange = (fromOffset: number, toOffset: number) => {
    const iso = (offset: number) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + offset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    setDeliveryFrom(iso(fromOffset));
    setDeliveryTo(iso(toOffset));
  };

  return (
    <div>
      <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Orders</h1>
          <p className="mt-1 text-sm text-slate-500">
            Web + offline orders across all channels.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setQuickRange(0, 0)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:border-brand-500 hover:text-brand-700"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setQuickRange(0, 6)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:border-brand-500 hover:text-brand-700"
            >
              Next 7d
            </button>
            <button
              type="button"
              onClick={() => setQuickRange(-6, 0)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:border-brand-500 hover:text-brand-700"
            >
              Last 7d
            </button>
            {rangeActive && (
              <button
                type="button"
                onClick={clearRange}
                className="ml-1 text-xs text-slate-500 hover:text-brand-500"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium text-slate-600">
              Delivering
            </label>
            <input
              type="date"
              value={deliveryFrom}
              onChange={(e) => setDeliveryFrom(e.target.value)}
              max={deliveryTo || undefined}
              className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:flex-none"
            />
            <span className="text-xs text-slate-400">→</span>
            <input
              type="date"
              value={deliveryTo}
              onChange={(e) => setDeliveryTo(e.target.value)}
              min={deliveryFrom || undefined}
              className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:flex-none"
            />
          </div>

          {rangeInvalid && (
            <p className="text-[11px] text-brand-700">
              "From" must be on or before "To".
            </p>
          )}
        </div>
      </div>

      <div className="mb-5 -mx-4 overflow-x-auto sm:mx-0">
        <div className="mx-4 inline-flex min-w-full flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5 sm:mx-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition",
                tab === t.key
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {t.label}
              {counts && counts[t.key] > 0 && (
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 text-[10px] font-bold",
                    tab === t.key
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 text-slate-700",
                  )}
                >
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-slate-200 bg-white">
        {isLoading && (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        )}
        {!isLoading && orders.length === 0 && (
          <div className="p-12 text-center text-sm text-slate-500">
            No orders in this bucket yet.
          </div>
        )}

        {/* Table view — md+ screens */}
        {!isLoading && orders.length > 0 && (
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Order</th>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Deliver on</th>
                <th className="px-4 py-2 font-medium text-right">Amount</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => navigate(`/orders/${o.orderNumber}`)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {o.fulfillment === "DELIVERY" ? (
                        <Truck className="h-4 w-4 shrink-0 text-slate-400" />
                      ) : (
                        <Store className="h-4 w-4 shrink-0 text-slate-400" />
                      )}
                      <div>
                        <p className="font-mono text-xs font-medium text-slate-900">
                          {o.orderNumber}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {o.itemCount} item{o.itemCount === 1 ? "" : "s"} ·{" "}
                          {new Date(o.createdAt).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">
                      {o.customerName}
                    </p>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Phone className="h-3 w-3" />
                      {o.customerPhone}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {o.earliestDelivery ? (
                      <>
                        <p className="text-xs font-medium text-slate-900">
                          {new Date(o.earliestDelivery).toLocaleDateString(
                            "en-IN",
                            {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            },
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {o.earliestSlotLabel}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-medium tabular-nums text-slate-900">
                      ₹{Number(o.total).toFixed(0)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {o.paymentMethod.toUpperCase()} · {o.paymentStatus}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400">
                    <ChevronRight className="h-4 w-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Card list — small screens */}
        {!isLoading && orders.length > 0 && (
          <ul className="divide-y divide-slate-100 md:hidden">
            {orders.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/orders/${o.orderNumber}`)}
                  className="w-full px-4 py-3 text-left transition hover:bg-slate-50 active:bg-slate-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      {o.fulfillment === "DELIVERY" ? (
                        <Truck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      ) : (
                        <Store className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      )}
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-medium text-slate-900">
                          {o.orderNumber}
                        </p>
                        <p className="truncate text-sm font-medium text-slate-900">
                          {o.customerName}
                        </p>
                        <p className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Phone className="h-3 w-3" />
                          {o.customerPhone}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-slate-900">
                        ₹{Number(o.total).toFixed(0)}
                      </p>
                      <div className="mt-1">
                        <StatusPill status={o.status} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    {o.earliestDelivery && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">
                        {new Date(o.earliestDelivery).toLocaleDateString(
                          "en-IN",
                          {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          },
                        )}
                        {o.earliestSlotLabel && ` · ${o.earliestSlotLabel}`}
                      </span>
                    )}
                    <span>
                      {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                    </span>
                    <span>
                      · {o.paymentMethod.toUpperCase()} · {o.paymentStatus}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { label: string; className: string }> = {
    PENDING: { label: "Pending", className: "bg-slate-100 text-slate-700" },
    CONFIRMED: { label: "Confirmed", className: "bg-blue-50 text-blue-700" },
    IN_KITCHEN: {
      label: "In kitchen",
      className: "bg-amber-50 text-amber-700",
    },
    READY: { label: "Ready", className: "bg-emerald-50 text-emerald-700" },
    OUT_FOR_DELIVERY: {
      label: "Out for delivery",
      className: "bg-brand-100 text-brand-700",
    },
    DELIVERED: {
      label: "Delivered",
      className:
        "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20",
    },
    CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-700" },
  };
  const cfg = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  );
}
