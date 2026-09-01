import { useCancelOrder, type Order } from "@/hooks/useOrders";

function formatDeadline(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CancelOrderButton({ order }: { order: Order }) {
  const cancel = useCancelOrder();
  const state = order.customerCancel;
  const cancelled = order.status === "CANCELLED";

  if (cancelled) {
    return (
      <p className="text-sm font-medium text-red-700">This order is cancelled.</p>
    );
  }

  if (!state?.allowed) {
    if (!state?.reason) return null;
    return <p className="text-xs text-ink-500">{state.reason}</p>;
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled={cancel.isPending}
        onClick={() => {
          if (
            !window.confirm(
              "Cancel this order? This can’t be undone online. Call the bakery if you need help after cancelling.",
            )
          ) {
            return;
          }
          cancel.mutate(order.orderNumber);
        }}
        className="rounded-full border border-red-200 px-4 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
      >
        {cancel.isPending ? "Cancelling…" : "Cancel order"}
      </button>
      {state.deadlineAt && (
        <p className="text-[11px] text-ink-500">
          Online cancel available until {formatDeadline(state.deadlineAt)}.
        </p>
      )}
      {cancel.isError && (
        <p className="text-xs text-red-700">
          {cancel.error instanceof Error
            ? cancel.error.message
            : "Couldn’t cancel this order."}
        </p>
      )}
    </div>
  );
}
