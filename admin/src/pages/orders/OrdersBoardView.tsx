import { useMemo } from "react";
import {
  useAdminOrders,
  type AdminOrderListItem,
} from "@/hooks/useAdminOrders";
import { OrderBoardCard } from "@/pages/orders/OrderBoardCard";
import { deliveryIso } from "@/pages/orders/order-ui";

const BOARD_PAGE_SIZE = 100;
const EXCLUDE: ("DELIVERED" | "CANCELLED")[] = ["DELIVERED", "CANCELLED"];

function sortBoardOrders(orders: AdminOrderListItem[]) {
  return [...orders].sort((a, b) => {
    const slotA = a.earliestSlotLabel ?? "";
    const slotB = b.earliestSlotLabel ?? "";
    if (slotA !== slotB) return slotA.localeCompare(slotB);
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
      {isLoading && (
        <p className="text-sm text-slate-500">Loading…</p>
      )}
      {!isLoading && orders.length === 0 && (
        <div className="rounded-card border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center text-sm text-slate-500">
          {emptyMessage}
        </div>
      )}
      {!isLoading && orders.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {orders.map((o) => (
            <OrderBoardCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </section>
  );
}

export function OrdersBoardView() {
  const today = deliveryIso(0);
  const tomorrow = deliveryIso(1);

  const todayQuery = useAdminOrders({
    deliveryFrom: today,
    deliveryTo: today,
    excludeStatuses: EXCLUDE,
    pageSize: BOARD_PAGE_SIZE,
  });
  const tomorrowQuery = useAdminOrders({
    deliveryFrom: tomorrow,
    deliveryTo: tomorrow,
    excludeStatuses: EXCLUDE,
    pageSize: BOARD_PAGE_SIZE,
  });

  const todayOrders = useMemo(
    () => sortBoardOrders(todayQuery.data?.items ?? []),
    [todayQuery.data?.items],
  );
  const tomorrowOrders = useMemo(
    () => sortBoardOrders(tomorrowQuery.data?.items ?? []),
    [tomorrowQuery.data?.items],
  );

  const isFetching = todayQuery.isFetching || tomorrowQuery.isFetching;
  const isLoading = todayQuery.isLoading || tomorrowQuery.isLoading;

  return (
    <div>
      {isFetching && !isLoading && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          Updating board…
        </div>
      )}

      <BoardSection
        title="Deliver today"
        subtitle={`${todayOrders.length} active order${todayOrders.length === 1 ? "" : "s"} · make & dispatch`}
        orders={todayOrders}
        isLoading={todayQuery.isLoading}
        emptyMessage="No active orders delivering today."
      />

      <BoardSection
        title="Deliver tomorrow"
        subtitle={`${tomorrowOrders.length} active order${tomorrowOrders.length === 1 ? "" : "s"} · prep tonight / early morning`}
        orders={tomorrowOrders}
        isLoading={tomorrowQuery.isLoading}
        emptyMessage="Nothing scheduled for tomorrow yet."
      />
    </div>
  );
}
