import { useDownloadMyInvoice, type Order } from "@/hooks/useOrders";

/**
 * Customer's own tax-invoice download. Renders nothing unless the order is
 * fully paid, because that's the only case the server will serve — showing a
 * button that always errors would be worse than showing none.
 */
export function DownloadInvoiceButton({ order }: { order: Order }) {
  const download = useDownloadMyInvoice();

  if (order.status === "CANCELLED") return null;

  if (order.paymentStatus !== "PAID") {
    return (
      <p className="text-[11px] text-ink-500">
        Your GST invoice will be available here once payment is confirmed.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled={download.isPending}
        onClick={() => download.mutate({ idOrNumber: order.orderNumber })}
        className="rounded-full border border-ink-700 px-4 py-1.5 text-sm font-medium text-ink-700 transition hover:bg-cream-100 disabled:opacity-50"
      >
        {download.isPending ? "Preparing…" : "Download invoice"}
      </button>
      {download.isError && (
        <p className="text-xs text-red-700">
          {download.error instanceof Error
            ? download.error.message
            : "Couldn’t download the invoice."}
        </p>
      )}
    </div>
  );
}
