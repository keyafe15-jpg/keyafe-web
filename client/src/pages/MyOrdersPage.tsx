import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { useUserOrders } from "@/hooks/useOrders";

export function MyOrdersPage() {
  const user = useAuth((s) => s.user);
  const { data: orders = [], isLoading, isError } = useUserOrders();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-500">
          Profile
        </p>
        <h1 className="mt-2 font-display text-3xl text-ink-900">My orders</h1>
      </div>

      {isLoading ? (
        <div className="rounded-card border border-cream-200 bg-white p-6 text-sm text-ink-500 shadow-sm">
          Loading your orders...
        </div>
      ) : isError ? (
        <div className="rounded-card border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          We couldn’t load your order history right now.
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-card border border-cream-200 bg-white p-6 text-sm text-ink-500 shadow-sm">
          You haven’t placed any orders yet.
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-card border border-cream-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex flex-col gap-3 border-b border-cream-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-500">
                    Order {order.orderNumber}
                  </p>
                  <p className="mt-1 text-sm text-ink-500">
                    {new Date(order.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                    {order.status}
                  </span>
                  <Link
                    to={`/order/${order.orderNumber}/success`}
                    className="text-sm font-medium text-brand-500 hover:text-brand-600"
                  >
                    View details
                  </Link>
                </div>
              </div>

              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 text-sm">
                    {item.productImage ? (
                      <img
                        src={item.productImage}
                        alt=""
                        className="h-12 w-12 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-md bg-cream-100" />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink-900">
                        {item.productName}
                      </p>
                      <p className="truncate text-xs text-ink-500">
                        {[item.sizeLabel, item.flavourName]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="text-xs text-ink-500">Qty {item.qty}</p>
                    </div>

                    <span className="shrink-0 text-sm font-medium tabular-nums text-ink-900">
                      ₹{Number(item.lineTotal).toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-cream-100 pt-4 text-sm">
                <span className="text-ink-500">Total</span>
                <span className="font-medium tabular-nums text-ink-900">
                  ₹{Number(order.total).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
