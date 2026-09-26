import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Building2,
  ImageOff,
  Phone,
  Store,
  Truck,
} from "lucide-react";
import { useOrderSchedule, type ScheduleEntry } from "@/hooks/useOrderSchedule";
import type { OrderStatus } from "@/hooks/useAdminOrders";
import { slotRank } from "@/content/slots";
import { StatusPill, SourceBadge, SurpriseGiftBadge } from "@/pages/orders/order-ui";
import { PaginationControls } from "@/components/ClientPagination";
import { useListSearch } from "@/store/listSearch";

const PAGE_SIZE = 25;
const EXCLUDE: OrderStatus[] = ["CANCELLED", "DELIVERED"];

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Splits the page into day sections. The server already sorts by delivery
 * date, so entries for one day arrive contiguously; only the slots within a
 * day need reordering, because SQL sorts slot keys alphabetically.
 */
function groupByDay(entries: ScheduleEntry[]) {
  const days: { date: string; entries: ScheduleEntry[] }[] = [];
  for (const entry of entries) {
    const date = entry.deliveryDate.slice(0, 10);
    const last = days[days.length - 1];
    if (last && last.date === date) last.entries.push(entry);
    else days.push({ date, entries: [entry] });
  }
  for (const day of days) {
    day.entries.sort((a, b) => slotRank(a.deliverySlotKey) - slotRank(b.deliverySlotKey));
  }
  return days;
}

function dayHeading(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const when = new Date(y!, m! - 1, d!);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((when.getTime() - today.getTime()) / 86_400_000);
  const label = when.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  if (diff === 0) return `Today · ${label}`;
  if (diff === 1) return `Tomorrow · ${label}`;
  return label;
}

function ScheduleCard({ entry }: { entry: ScheduleEntry }) {
  const order = entry.order;
  if (!order) return null;
  const isDelivery = order.fulfillment === "DELIVERY";
  const destination = [order.city, order.pincode].filter(Boolean).join(" · ");

  return (
    <Link
      to={`/orders/${order.orderNumber}`}
      className="hover:border-brand-300 flex flex-col rounded-card border border-slate-200 bg-white p-4 transition hover:shadow-sm"
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-slate-900">
              {order.orderNumber}
            </span>
            <StatusPill status={order.status} />
            {order.isSurpriseGift && <SurpriseGiftBadge compact />}
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {entry.deliverySlotLabel ?? "Slot not set"}
          </p>
        </div>
        <SourceBadge source={order.source} />
      </header>

      <ul className="flex-1 space-y-2.5 border-t border-slate-100 pt-3">
        {entry.items.map((item) => {
          const imageUrl = item.productImage ?? item.referenceImageUrl;
          return (
            <li key={item.id} className="flex gap-3 text-sm">
              {imageUrl ? (
                <img src={imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100">
                  <ImageOff className="h-4 w-4 text-slate-300" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">
                  {item.qty} × {item.productName}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {[item.sizeLabel, item.flavourName].filter(Boolean).join(" · ")}
                </p>
                {item.messageOnCake && (
                  <p className="mt-0.5 text-xs text-slate-500">Message: “{item.messageOnCake}”</p>
                )}
                {item.instructions && (
                  <p className="mt-0.5 text-xs text-slate-500">Note: {item.instructions}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <div className="flex min-w-0 items-center gap-1 truncate">
          {order.customerCompanyName ? (
            <Building2 className="h-3 w-3 shrink-0" />
          ) : (
            <Phone className="h-3 w-3 shrink-0" />
          )}
          <span className="truncate">{order.customerCompanyName ?? order.customerName}</span>
          <span className="text-slate-300">·</span>
          <span className="shrink-0">{order.customerPhone}</span>
        </div>
        <span className="flex shrink-0 items-center gap-1">
          {isDelivery ? <Truck className="h-3 w-3" /> : <Store className="h-3 w-3" />}
          {isDelivery ? destination || "Delivery" : "Pickup"}
        </span>
      </footer>
    </Link>
  );
}

export function OrdersScheduleView() {
  const [deliveryFrom, setDeliveryFrom] = useState(isoDay(0));
  const [deliveryTo, setDeliveryTo] = useState("");
  const search = useListSearch((s) => s.query);
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [includeDone, setIncludeDone] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const { data, isLoading, isFetching } = useOrderSchedule({
    // While searching, drop the default "from today" window so matches aren't hidden.
    deliveryFrom: search.trim() ? null : deliveryFrom || null,
    deliveryTo: search.trim() ? null : deliveryTo || null,
    search: search || null,
    excludeStatuses: includeDone ? [] : EXCLUDE,
    dir,
    page,
    pageSize: PAGE_SIZE,
  });

  const entries = data?.items ?? [];
  const days = useMemo(() => groupByDay(entries), [entries]);
  const rangeInvalid = !!(deliveryFrom && deliveryTo && deliveryFrom > deliveryTo);

  const setQuickRange = (fromOffset: number, toOffset: number | null) => {
    setDeliveryFrom(isoDay(fromOffset));
    setDeliveryTo(toOffset === null ? "" : isoDay(toOffset));
    setPage(1);
  };

  return (
    <div>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm text-slate-500">
          One card per delivery. An order with items on different dates appears under each of them.
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
              onClick={() => setQuickRange(0, 30)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:border-brand-500 hover:text-brand-700"
            >
              Next 30d
            </button>
            <button
              type="button"
              onClick={() => setQuickRange(0, null)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:border-brand-500 hover:text-brand-700"
            >
              All upcoming
            </button>
          </div>

          {/* The two date inputs get a row to themselves on mobile: sharing
              one with the label, arrow and sort toggle squeezes the native
              control below the width dd/mm/yyyy needs, clipping the date. */}
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
            <button
              type="button"
              onClick={() => {
                setDir(dir === "asc" ? "desc" : "asc");
                setPage(1);
              }}
              className="inline-flex items-center gap-1 self-start rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-600 hover:border-brand-500 hover:text-brand-700 sm:self-auto"
              title={
                dir === "asc"
                  ? "Soonest first — switch to latest first"
                  : "Latest first — switch to soonest first"
              }
            >
              {dir === "asc" ? (
                <ArrowUpNarrowWide className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownNarrowWide className="h-3.5 w-3.5" />
              )}
              {dir === "asc" ? "Soonest first" : "Latest first"}
            </button>
          </div>

          {rangeInvalid && (
            <p className="text-[11px] text-brand-700">"From" must be on or before "To".</p>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={includeDone}
            onChange={(e) => {
              setIncludeDone(e.target.checked);
              setPage(1);
            }}
            className="h-3.5 w-3.5 rounded border-slate-300 text-brand-500 focus:ring-brand-500/20"
          />
          Include delivered & cancelled
        </label>
      </div>

      {isFetching && !isLoading && <p className="mb-3 text-xs text-slate-500">Updating…</p>}

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

      {!isLoading && entries.length === 0 && (
        <div className="rounded-card border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center text-sm text-slate-500">
          {search ? `No deliveries match “${search}”.` : "Nothing scheduled in this range."}
        </div>
      )}

      {!isLoading &&
        days.map((day) => (
          <section key={day.date} className="mb-8">
            <div className="mb-3 flex items-baseline gap-2 border-b border-slate-200 pb-2">
              <h2 className="text-base font-semibold text-slate-900">{dayHeading(day.date)}</h2>
              <span className="text-xs text-slate-500">
                {day.entries.length} deliver
                {day.entries.length === 1 ? "y" : "ies"}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {day.entries.map((entry) => (
                <ScheduleCard key={entry.key} entry={entry} />
              ))}
            </div>
          </section>
        ))}

      <PaginationControls
        page={data?.page ?? 1}
        pageCount={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        firstItem={data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0}
        lastItem={data ? Math.min(data.page * data.pageSize, data.total) : 0}
        onPageChange={setPage}
        noun="deliveries"
      />
    </div>
  );
}
