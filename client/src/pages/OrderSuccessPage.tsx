import { Link, useParams } from "react-router-dom";
import { useOrder } from "@/hooks/useOrders";
import { CancelOrderButton } from "@/components/order/CancelOrderButton";

export function OrderSuccessPage() {
  const { id = "" } = useParams<{ id: string }>();
  const { data: order, isLoading, isError } = useOrder(id);

  if (isLoading) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mx-auto h-6 w-40 animate-pulse rounded bg-cream-100" />
      </section>
    );
  }

  if (isError || !order) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="mb-3 font-display text-3xl text-ink-900">
          Order not found
        </h1>
        <p className="mb-6 text-ink-500">
          We couldn't find this order. Try opening the link from your
          confirmation SMS.
        </p>
        <Link
          to="/"
          className="inline-block rounded-full bg-brand-500 px-6 py-3 text-sm font-medium text-white hover:bg-brand-700"
        >
          Back to home
        </Link>
      </section>
    );
  }

  const isDelivery = order.fulfillment === "DELIVERY";
  const cancelled = order.status === "CANCELLED";

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <div
        className={`rounded-card border p-6 text-center sm:p-8 ${
          cancelled
            ? "border-red-200 bg-red-50/50"
            : "border-emerald-200 bg-emerald-50/50"
        }`}
      >
        <div
          className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-white ${
            cancelled ? "bg-red-500" : "bg-emerald-500"
          }`}
        >
          <svg
            width={28}
            height={28}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {cancelled ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <path d="M20 6L9 17l-5-5" />
            )}
          </svg>
        </div>
        <h1 className="font-display text-3xl text-ink-900">
          {cancelled ? "Order cancelled" : "Order confirmed!"}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {cancelled
            ? "This order is no longer being prepared."
            : `Thanks ${order.customerName.split(" ")[0]} — we've got your order.`}
        </p>
        <p
          className={`mt-3 inline-block rounded-full bg-white px-3 py-1 text-xs font-medium tabular-nums text-ink-700 ring-1 ${
            cancelled ? "ring-red-200" : "ring-emerald-200"
          }`}
        >
          {order.orderNumber}
        </p>
      </div>

      <div className="mt-8">
        <InfoCard title={isDelivery ? "Delivery to" : "Pickup at"}>
          {isDelivery && order.deliveryAddress ? (
            <>
              <address className="not-italic text-sm text-ink-700">
                <p className="font-medium">{order.customerName}</p>
                <p>{order.deliveryAddress.line1}</p>
                {order.deliveryAddress.line2 && (
                  <p>{order.deliveryAddress.line2}</p>
                )}
                {order.deliveryAddress.landmark && (
                  <p className="text-ink-500">
                    Near {order.deliveryAddress.landmark}
                  </p>
                )}
                <p>
                  {[order.deliveryAddress.area, order.deliveryAddress.city]
                    .filter(Boolean)
                    .join(", ")}{" "}
                  {order.deliveryAddress.pincode}
                </p>
                <p className="mt-2 text-ink-500">{order.customerPhone}</p>
              </address>
              {order.deliveryAddress.mapSearchQuery && (
                <div className="mt-3 rounded-lg border border-brand-500/20 bg-brand-100/40 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                    Search on Uber / Rapido
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-ink-900">
                    {order.deliveryAddress.mapSearchQuery}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-ink-700">
              <p className="font-medium">Keyafe Bakery</p>
              <p className="text-ink-500">Howrah, West Bengal 711202</p>
              <p className="mt-2 text-ink-500">Under {order.customerName}</p>
            </div>
          )}
        </InfoCard>
      </div>

      <div className="mt-6 rounded-card border border-cream-200 bg-white p-5">
        <h2 className="mb-3 font-display text-lg text-ink-900">Your order</h2>
        <ul className="space-y-3">
          {order.items.map((it) => (
            <li key={it.id} className="flex items-start gap-3 text-sm">
              {it.productImage ? (
                <img
                  src={it.productImage}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="h-12 w-12 shrink-0 rounded-md bg-cream-100" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink-900">
                  {it.productName}
                </p>
                <p className="truncate text-xs text-ink-500">
                  {[it.sizeLabel, it.flavourName].filter(Boolean).join(" · ")}
                </p>
                {it.messageOnCake && (
                  <p className="truncate text-xs italic text-ink-500">
                    "{it.messageOnCake}"
                  </p>
                )}
                <p className="text-xs text-ink-500">Qty {it.qty}</p>
                <p className="mt-1 text-[11px] font-medium text-brand-700">
                  {it.deliveryDate && it.deliverySlotLabel
                    ? `${formatItemDate(it.deliveryDate)} · ${it.deliverySlotLabel}`
                    : "Ships pan-India via courier"}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums text-ink-900">
                ₹{Number(it.lineTotal).toFixed(0)}
              </span>
            </li>
          ))}
        </ul>

        <hr className="my-4 border-cream-200" />

        {(Number(order.cgstAmount) > 0 ||
          Number(order.sgstAmount) > 0 ||
          Number(order.igstAmount) > 0) && (
          <div className="mb-3 rounded-lg border border-cream-200 bg-cream-50/60 px-3 py-2 text-xs">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
              GST breakup
            </p>
            <div className="space-y-1 text-ink-700">
              <BreakupRow
                label="Taxable amount"
                value={Number(order.taxableAmount)}
              />
              {Number(order.cgstAmount) > 0 && (
                <BreakupRow label="CGST" value={Number(order.cgstAmount)} />
              )}
              {Number(order.sgstAmount) > 0 && (
                <BreakupRow label="SGST" value={Number(order.sgstAmount)} />
              )}
              {Number(order.igstAmount) > 0 && (
                <BreakupRow label="IGST" value={Number(order.igstAmount)} />
              )}
            </div>
          </div>
        )}

        <SummaryRow
          label="Subtotal (incl. GST)"
          value={Number(order.subtotal)}
        />
        {Number(order.discount) > 0 && (
          <SummaryRow
            label={
              order.couponCode
                ? `Discount (${order.couponCode})`
                : "Discount"
            }
            value={-Number(order.discount)}
          />
        )}
        {isDelivery && (
          <SummaryRow
            label={
              Number(order.deliveryFee) === 0 ? "Delivery (free)" : "Delivery"
            }
            value={Number(order.deliveryFee)}
          />
        )}
        <hr className="my-3 border-cream-200" />
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink-700">Total</span>
          <span className="text-2xl font-semibold tabular-nums text-ink-900">
            ₹{Number(order.total).toFixed(2)}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-ink-500">
          Payment: {order.paymentMethod.toUpperCase()} · {order.paymentStatus}
        </p>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <div className="w-full max-w-sm text-center sm:w-auto">
          <CancelOrderButton order={order} />
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          to="/"
          className="rounded-full border border-ink-700 px-5 py-2 text-sm font-medium text-ink-700 transition hover:bg-cream-100"
        >
          Continue shopping
        </Link>
        <a
          href={`tel:+919330048665`}
          className="rounded-full bg-brand-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          Call the bakery
        </a>
      </div>
    </section>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-cream-200 bg-white p-5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
        {title}
      </p>
      {children}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-0.5 text-sm">
      <span className={muted ? "text-ink-500 text-xs" : "text-ink-700"}>
        {label}
      </span>
      <span
        className={
          muted
            ? "tabular-nums text-xs text-ink-500"
            : "tabular-nums text-ink-900"
        }
      >
        ₹{value.toFixed(2)}
      </span>
    </div>
  );
}

function BreakupRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <span>{label}</span>
      <span className="tabular-nums">₹{value.toFixed(2)}</span>
    </div>
  );
}

function formatItemDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
