import { useMemo } from "react";
import { useAdminOrders, type AdminOrderListItem } from "@/hooks/useAdminOrders";
import { OrderBoardCard } from "@/pages/orders/OrderBoardCard";
import { useListSearch } from "@/store/listSearch";

const PAGE_SIZE = 100;
const EXCLUDE: ("DELIVERED" | "CANCELLED")[] = ["DELIVERED", "CANCELLED"];

function sortByReceived(orders: AdminOrderListItem[]) {
  return [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function TileSection({
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
      {!isLoading && orders.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2">
          {orders.map((o) => (
            <OrderBoardCard key={o.id} order={o} flow="courier" />
          ))}
        </div>
      )}
    </section>
  );
}

export function OrdersPanIndiaView() {
  const search = useListSearch((s) => s.query);
  const searching = search.trim().length > 0;

  const query = useAdminOrders({
    panIndia: true,
    search: search || null,
    excludeStatuses: EXCLUDE,
    pageSize: PAGE_SIZE,
  });

  const orders = useMemo(() => sortByReceived(query.data?.items ?? []), [query.data?.items]);

  const toDispatch = orders.filter((o) => o.status !== "OUT_FOR_DELIVERY");
  const withCourier = orders.filter((o) => o.status === "OUT_FOR_DELIVERY");

  return (
    <div>
      {query.isFetching && !query.isLoading && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          Updating pan-India orders…
        </div>
      )}

      {searching ? (
        <TileSection
          title="Search results"
          subtitle={`${orders.length} pan-India order${orders.length === 1 ? "" : "s"} matching “${search.trim()}”`}
          orders={orders}
          isLoading={query.isLoading}
          emptyMessage={`No pan-India orders match “${search.trim()}”.`}
        />
      ) : (
        <>
          <TileSection
            title="To pack & dispatch"
            subtitle={`${toDispatch.length} received order${toDispatch.length === 1 ? "" : "s"} · pack and hand to courier`}
            orders={toDispatch}
            isLoading={query.isLoading}
            emptyMessage="No pan-India orders waiting to be packed."
          />

          <TileSection
            title="With courier"
            subtitle={`${withCourier.length} already handed over`}
            orders={withCourier}
            isLoading={query.isLoading}
            emptyMessage="Nothing currently with the courier."
          />
        </>
      )}
    </div>
  );
}
