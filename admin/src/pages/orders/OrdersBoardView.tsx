import { useMemo, useState } from "react";
import { useAdminOrders, type AdminOrderListItem } from "@/hooks/useAdminOrders";
import { OrderBoardCard } from "@/pages/orders/OrderBoardCard";
import { deliveryIso } from "@/pages/orders/order-ui";
import { useListSearch } from "@/store/listSearch";
import { slotRank } from "@/content/slots";
import { cn } from "@/lib/cn";

const BOARD_PAGE_SIZE = 100;
const EXCLUDE: ("DELIVERED" | "CANCELLED")[] = ["DELIVERED", "CANCELLED"];

function isReady(order: AdminOrderListItem) {
  return order.status === "READY" || order.status === "OUT_FOR_DELIVERY";
}

function earliestSlotRank(order: AdminOrderListItem) {
  return Math.min(...order.items.map((i) => slotRank(i.deliverySlotKey)), slotRank(null));
}

function sortBoardOrders(orders: AdminOrderListItem[]) {
  return [...orders].sort((a, b) => {
    const rank = earliestSlotRank(a) - earliestSlotRank(b);
    if (rank !== 0) return rank;
    return a.orderNumber.localeCompare(b.orderNumber);
  });
}

function BoardSection({
  title,
  subtitle,
  orders,
  isLoading,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  orders: AdminOrderListItem[];
  isLoading: boolean;
  emptyMessage: string;
}) {
  return (
    <section className="mb-8">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {!isLoading && orders.length === 0 && (
        <div className="rounded-card border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center text-sm text-slate-500">
          {emptyMessage}
        </div>
      )}
      {!isLoading && orders.length > 0 && <OrderGrid orders={orders} />}
    </section>
  );
}

function OrderGrid({ orders }: { orders: AdminOrderListItem[] }) {
  return (
    <div className="grid gap-2 min-[360px]:grid-cols-2 sm:gap-4 xl:grid-cols-3">
      {orders.map((o) => (
        <OrderBoardCard key={o.id} order={o} />
      ))}
    </div>
  );
}

export function OrdersBoardView() {
  const search = useListSearch((s) => s.query);
  const searching = search.trim().length > 0;
  const today = deliveryIso(0);
  const tomorrow = deliveryIso(1);
  const [day, setDay] = useState<"today" | "tomorrow">("today");

  const searchQuery = useAdminOrders({
    search: search || null,
    excludeStatuses: EXCLUDE,
    pageSize: BOARD_PAGE_SIZE,
    enabled: searching,
  });
  const todayQuery = useAdminOrders({
    deliveryFrom: today,
    deliveryTo: today,
    search: search || null,
    excludeStatuses: EXCLUDE,
    pageSize: BOARD_PAGE_SIZE,
    enabled: !searching,
  });
  const tomorrowQuery = useAdminOrders({
    deliveryFrom: tomorrow,
    deliveryTo: tomorrow,
    search: search || null,
    excludeStatuses: EXCLUDE,
    pageSize: BOARD_PAGE_SIZE,
    enabled: !searching,
  });

  const searchOrders = useMemo(
    () => sortBoardOrders(searchQuery.data?.items ?? []),
    [searchQuery.data?.items],
  );
  const todayOrders = useMemo(
    () => sortBoardOrders(todayQuery.data?.items ?? []),
    [todayQuery.data?.items],
  );
  const tomorrowOrders = useMemo(
    () => sortBoardOrders(tomorrowQuery.data?.items ?? []),
    [tomorrowQuery.data?.items],
  );

  if (searching) {
    return (
      <div>
        {searchQuery.isFetching && !searchQuery.isLoading && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            Updating results…
          </div>
        )}
        <BoardSection
          title="Search results"
          subtitle={`${searchOrders.length} active order${searchOrders.length === 1 ? "" : "s"} matching “${search.trim()}”`}
          orders={searchOrders}
          isLoading={searchQuery.isLoading}
          emptyMessage={`No active orders match “${search.trim()}”. Try All orders for full history.`}
        />
      </div>
    );
  }

  const isFetching = todayQuery.isFetching || tomorrowQuery.isFetching;
  const isLoading = todayQuery.isLoading || tomorrowQuery.isLoading;

  return (
    <div>
      {isFetching && !isLoading && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          Updating board…
        </div>
      )}

      <div
        role="tablist"
        aria-label="Delivery day"
        className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:inline-grid sm:min-w-96"
      >
        <DayTab
          label="Today"
          date={today}
          count={todayOrders.filter((o) => !isReady(o)).length}
          loading={todayQuery.isLoading}
          active={day === "today"}
          onClick={() => setDay("today")}
        />
        <DayTab
          label="Tomorrow"
          date={tomorrow}
          count={tomorrowOrders.filter((o) => !isReady(o)).length}
          loading={tomorrowQuery.isLoading}
          active={day === "tomorrow"}
          onClick={() => setDay("tomorrow")}
        />
      </div>

      {day === "today" ? (
        <DayBoard
          orders={todayOrders}
          isLoading={todayQuery.isLoading}
          toMakeHint="Make & dispatch today"
          emptyMessage="No active orders delivering today."
        />
      ) : (
        <DayBoard
          orders={tomorrowOrders}
          isLoading={tomorrowQuery.isLoading}
          toMakeHint="Prep tonight / early morning"
          emptyMessage="Nothing scheduled for tomorrow yet."
        />
      )}
    </div>
  );
}

function DayBoard({
  orders,
  isLoading,
  toMakeHint,
  emptyMessage,
}: {
  orders: AdminOrderListItem[];
  isLoading: boolean;
  toMakeHint: string;
  emptyMessage: string;
}) {
  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (orders.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  const toMake = orders.filter((o) => !isReady(o));
  const ready = orders.filter(isReady);

  return (
    <>
      <section className="mb-8">
        <SectionHeading title="To make" count={toMake.length} hint={toMakeHint} />
        {toMake.length > 0 ? (
          <OrderGrid orders={toMake} />
        ) : (
          <div className="rounded-card border border-dashed border-emerald-200 bg-emerald-50/60 px-6 py-6 text-center text-sm font-medium text-emerald-700">
            All caught up. Every order is ready.
          </div>
        )}
      </section>

      {ready.length > 0 && (
        <section className="mb-8 border-t border-slate-200 pt-6">
          <SectionHeading
            title="Ready"
            count={ready.length}
            hint="Waiting for handover or out for delivery"
            tone="ready"
          />
          <OrderGrid orders={ready} />
        </section>
      )}
    </>
  );
}

function SectionHeading({
  title,
  count,
  hint,
  tone = "default",
}: {
  title: string;
  count: number;
  hint: string;
  tone?: "default" | "ready";
}) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
          tone === "ready" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700",
        )}
      >
        {count}
      </span>
      <span className="truncate text-xs text-slate-500">{hint}</span>
    </div>
  );
}

function DayTab({
  label,
  date,
  count,
  loading,
  active,
  onClick,
}: {
  label: string;
  date: string;
  count: number;
  loading: boolean;
  active: boolean;
  onClick: () => void;
}) {
  const [y, m, d] = date.split("-").map(Number);
  const dateLabel = new Date(y!, m! - 1, d!).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg px-3 py-2 transition",
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
      )}
    >
      <span className="flex flex-col items-start leading-tight">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-[11px] text-slate-500">{dateLabel}</span>
      </span>
      <span
        title="Orders still to make"
        className={cn(
          "min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums",
          active ? "bg-brand-500 text-white" : "bg-slate-200 text-slate-700",
        )}
      >
        {loading ? "…" : count}
      </span>
    </button>
  );
}
