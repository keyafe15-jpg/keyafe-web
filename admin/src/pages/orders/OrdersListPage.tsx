import { useState } from "react";
import { OrdersBoardView } from "@/pages/orders/OrdersBoardView";
import { OrdersAllView } from "@/pages/orders/OrdersAllView";
import { cn } from "@/lib/cn";

type PageTab = "board" | "all";

const PAGE_TABS: { key: PageTab; label: string }[] = [
  { key: "board", label: "Board" },
  { key: "all", label: "All orders" },
];

export function OrdersListPage() {
  const [pageTab, setPageTab] = useState<PageTab>("board");

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Orders</h1>
          <p className="mt-1 text-sm text-slate-500">
            {pageTab === "board"
              ? "Kitchen board — today & tomorrow at a glance."
              : "Full order history with search and filters."}
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {PAGE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setPageTab(t.key)}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition",
                pageTab === t.key
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {pageTab === "board" ? <OrdersBoardView /> : <OrdersAllView />}
    </div>
  );
}

// Re-export for OrderDetailPage and other consumers
export { StatusPill, SourceBadge } from "@/pages/orders/order-ui";
