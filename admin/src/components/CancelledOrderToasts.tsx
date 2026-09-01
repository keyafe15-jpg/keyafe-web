import { Link } from "react-router-dom";
import { useAlerts } from "@/store/alerts";
import { X } from "lucide-react";
import { useEffect } from "react";

export function CancelledOrderToasts() {
  const cancelled = useAlerts((s) => s.cancelled);
  const dismiss = useAlerts((s) => s.dismissCancelled);

  useEffect(() => {
    if (cancelled.length === 0) return;
    const timers = cancelled.map((a) =>
      window.setTimeout(() => dismiss(a.id), 12_000),
    );
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [cancelled, dismiss]);

  if (cancelled.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(100%-2rem,22rem)] flex-col gap-2">
      {cancelled.map((a) => (
        <div
          key={a.id}
          className="pointer-events-auto rounded-lg border border-red-200 bg-white p-3 shadow-lg"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                Order cancelled
              </p>
              <p className="mt-0.5 font-mono text-sm font-medium text-slate-900">
                {a.orderNumber}
              </p>
              <p className="mt-0.5 text-sm text-slate-600">
                {a.cancelledBy === "customer" ? "Customer" : "Admin"} cancelled{" "}
                {a.customerName} · ₹{Number(a.total).toFixed(0)}
              </p>
              <Link
                to={`/orders/${a.orderNumber}`}
                className="mt-1 inline-block text-xs font-medium text-brand-500 hover:underline"
                onClick={() => dismiss(a.id)}
              >
                Open order
              </Link>
            </div>
            <button
              type="button"
              onClick={() => dismiss(a.id)}
              className="rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
