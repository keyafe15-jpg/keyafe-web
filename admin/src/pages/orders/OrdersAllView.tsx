import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Store, Phone, ChevronRight, Search, X, Building2 } from "lucide-react";
import { useAdminOrders, useAdminOrderCounts, type OrderStatus } from "@/hooks/useAdminOrders";
import { PaginationControls } from "@/components/ClientPagination";
import { inputClass } from "@/components/form/Field";
import { SourceBadge, StatusPill, SurpriseGiftBadge } from "@/pages/orders/order-ui";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 20;

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

export function OrdersAllView() {
  const [tab, setTab] = useState<OrderStatus | "ALL">("ALL");
  const [deliveryFrom, setDeliveryFrom] = useState("");
  const [deliveryTo, setDeliveryTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useAdminOrders({
    status: tab === "ALL" ? null : tab,
    deliveryFrom: deliveryFrom || null,
    deliveryTo: deliveryTo || null,
    search: search || null,
    page,
    pageSize: PAGE_SIZE,
  });
  const orders = data?.items ?? [];
  const { data: counts } = useAdminOrderCounts();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const searching = search.length > 0;

  const changeTab = (t: OrderStatus | "ALL") => {
    setTab(t);
    setPage(1);
  };

  const rangeActive = !!(deliveryFrom || deliveryTo);
  const rangeInvalid = deliveryFrom && deliveryTo && deliveryFrom > deliveryTo;

  const clearRange = () => {
    setDeliveryFrom("");
    setDeliveryTo("");
    setPage(1);
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
    setPage(1);
  };

  return (
    <div>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm text-slate-500">
          {searching
            ? `${data?.total ?? 0} match${data?.total === 1 ? "" : "es"} for “${search}”`
            : "Search and filter across all orders."}
        </p>

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

          {/* The date inputs get their own row on mobile so the native
              control keeps the width dd/mm/yyyy needs. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="text-xs font-medium text-slate-600">Delivering</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={deliveryFrom}
                onChange={(e) => {
                  setDeliveryFrom(e.target.value);
                  setPage(1);
                }}
                max={deliveryTo || undefined}
                className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none sm:w-36 sm:flex-none"
              />
              <span className="shrink-0 text-xs text-slate-400">→</span>
              <input
                type="date"
                value={deliveryTo}
                onChange={(e) => {
                  setDeliveryTo(e.target.value);
                  setPage(1);
                }}
                min={deliveryFrom || undefined}
                className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none sm:w-36 sm:flex-none"
              />
            </div>
          </div>

          {rangeInvalid && (
            <p className="text-[11px] text-brand-700">"From" must be on or before "To".</p>
          )}
        </div>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search order #, customer, phone, or product…"
            className={cn(inputClass, "pr-9 pl-9")}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mb-5">
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => changeTab(t.key)}
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
                    tab === t.key ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700",
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
        {isLoading && <div className="p-8 text-center text-sm text-slate-500">Loading…</div>}
        {!isLoading && orders.length === 0 && (
          <div className="p-12 text-center text-sm text-slate-500">
            {searching ? `No orders match “${search}”.` : "No orders in this bucket yet."}
          </div>
        )}

        {!isLoading && orders.length > 0 && (
          <>
            {isFetching && !isLoading && (
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                Updating results…
              </div>
            )}
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium">Order</th>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Deliver on</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
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
                            {o.itemCount} item
                            {o.itemCount === 1 ? "" : "s"} ·{" "}
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
                      {o.customerCompanyName ? (
                        <>
                          <p className="flex items-center gap-1 font-medium text-slate-900">
                            <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            {o.customerCompanyName}
                          </p>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            {o.customerName}
                            <span className="text-slate-300">·</span>
                            <Phone className="h-3 w-3" />
                            {o.customerPhone}
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-slate-900">{o.customerName}</p>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            <Phone className="h-3 w-3" />
                            {o.customerPhone}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <SourceBadge source={o.source} />
                        {o.isSurpriseGift && <SurpriseGiftBadge compact />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {o.earliestDelivery ? (
                        <>
                          <p className="text-xs font-medium text-slate-900">
                            {new Date(o.earliestDelivery).toLocaleDateString("en-IN", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                          <p className="text-[11px] text-slate-500">{o.earliestSlotLabel}</p>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm font-medium text-slate-900 tabular-nums">
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
                          <p className="flex items-center gap-1 truncate text-sm font-medium text-slate-900">
                            {o.customerCompanyName && (
                              <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            )}
                            <span className="truncate">
                              {o.customerCompanyName ?? o.customerName}
                            </span>
                          </p>
                          <p className="flex items-center gap-1 truncate text-[11px] text-slate-500">
                            {o.customerCompanyName && (
                              <>
                                <span className="truncate">{o.customerName}</span>
                                <span className="text-slate-300">·</span>
                              </>
                            )}
                            <Phone className="h-3 w-3 shrink-0" />
                            {o.customerPhone}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-slate-900 tabular-nums">
                          ₹{Number(o.total).toFixed(0)}
                        </p>
                        <div className="mt-1">
                          <StatusPill status={o.status} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <SourceBadge source={o.source} />
                      {o.isSurpriseGift && <SurpriseGiftBadge compact />}
                      {o.earliestDelivery && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">
                          {new Date(o.earliestDelivery).toLocaleDateString("en-IN", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
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

            <PaginationControls
              page={data?.page ?? 1}
              pageCount={data?.totalPages ?? 1}
              total={data?.total ?? 0}
              firstItem={data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0}
              lastItem={data ? Math.min(data.page * data.pageSize, data.total) : 0}
              onPageChange={setPage}
              noun="orders"
              className="mx-4 mb-4"
            />
          </>
        )}
      </div>
    </div>
  );
}
