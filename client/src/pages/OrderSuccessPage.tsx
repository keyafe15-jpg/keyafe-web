import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { orderGstOnTop } from "@keyafe/shared";
import { useOrder, type Order } from "@/hooks/useOrders";
import { useStoreProfile } from "@/hooks/useStoreProfile";
import {
  useCreatePaymentSession,
  useSwitchToCod,
  useVerifyPayment,
  type PaymentState,
} from "@/hooks/usePayments";
import { payWithCashfree } from "@/lib/cashfree";
import { CancelOrderButton } from "@/components/order/CancelOrderButton";
import { DownloadInvoiceButton } from "@/components/order/DownloadInvoiceButton";
import { SurpriseGiftBadge } from "@/components/order/SurpriseGiftBadge";

const PAYMENT_CHECKS = 5;
const PAYMENT_CHECK_INTERVAL_MS = 3000;

export function OrderSuccessPage() {
  const { id = "" } = useParams<{ id: string }>();
  const { data: order, isLoading, isError } = useOrder(id);
  const contact = useStoreProfile();
  const awaitingPayment =
    !!order && order.paymentMethod === "cashfree" && !order.paidAt && order.status !== "CANCELLED";
  const paymentCheck = usePaymentCheck(order?.id ?? "", awaitingPayment);

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
        <h1 className="mb-3 font-display text-3xl text-ink-900">Order not found</h1>
        <p className="mb-6 text-ink-500">
          We couldn't find this order. Try opening the link from your confirmation message.
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
  const gstOnTop = orderGstOnTop(order);
  const cancelled = order.status === "CANCELLED";
  const deliverToName = order.recipientName?.trim() || order.customerName;
  const deliverToPhone = order.isSurpriseGift
    ? order.customerPhone
    : order.deliveryPhone?.trim() || order.customerPhone;

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      {awaitingPayment ? (
        <PaymentPendingCard order={order} check={paymentCheck} />
      ) : (
        <div
          className={`rounded-card border p-6 text-center sm:p-8 ${
            cancelled ? "border-red-200 bg-red-50/50" : "border-emerald-200 bg-emerald-50/50"
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
              {cancelled ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M20 6L9 17l-5-5" />}
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
            className={`mt-3 inline-block rounded-full bg-white px-3 py-1 text-xs font-medium text-ink-700 tabular-nums ring-1 ${
              cancelled ? "ring-red-200" : "ring-emerald-200"
            }`}
          >
            {order.orderNumber}
          </p>
          {order.isSurpriseGift && (
            <div className="mt-3 flex justify-center">
              <SurpriseGiftBadge />
            </div>
          )}
        </div>
      )}

      <div className="mt-8">
        <InfoCard title={isDelivery ? "Delivery to" : "Pickup at"}>
          {isDelivery && order.deliveryAddress ? (
            <>
              <address className="text-sm text-ink-700 not-italic">
                <p className="font-medium">{deliverToName}</p>
                <p>{order.deliveryAddress.line1}</p>
                {order.deliveryAddress.line2 && <p>{order.deliveryAddress.line2}</p>}
                {order.deliveryAddress.landmark && (
                  <p className="text-ink-500">Near {order.deliveryAddress.landmark}</p>
                )}
                <p>
                  {[order.deliveryAddress.area, order.deliveryAddress.city]
                    .filter(Boolean)
                    .join(", ")}{" "}
                  {order.deliveryAddress.pincode}
                </p>
                <p className="mt-2 text-ink-500">{deliverToPhone}</p>
              </address>
              {order.deliveryAddress.mapSearchQuery && (
                <div className="mt-3 rounded-lg border border-brand-500/20 bg-brand-100/40 px-3 py-2">
                  <p className="text-[10px] font-semibold tracking-wide text-brand-700 uppercase">
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
              <p className="font-medium">Keyafe Foods</p>
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
                <p className="truncate font-medium text-ink-900">{it.productName}</p>
                <p className="truncate text-xs text-ink-500">
                  {[it.sizeLabel, it.flavourName].filter(Boolean).join(" · ")}
                </p>
                {it.description && (
                  <p className="text-xs whitespace-pre-line text-ink-700">{it.description}</p>
                )}
                {it.messageOnCake && (
                  <p className="truncate text-xs text-ink-500 italic">"{it.messageOnCake}"</p>
                )}
                <p className="text-xs text-ink-500">Qty {it.qty}</p>
                <p className="mt-1 text-[11px] font-medium text-brand-700">
                  {it.deliveryDate && it.deliverySlotLabel
                    ? `${formatItemDate(it.deliveryDate)} · ${it.deliverySlotLabel}`
                    : "Ships pan-India via courier"}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium text-ink-900 tabular-nums">
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
            <p className="mb-1 text-[10px] font-semibold tracking-wide text-ink-500 uppercase">
              GST breakup
            </p>
            <div className="space-y-1 text-ink-700">
              <BreakupRow label="Taxable amount" value={Number(order.taxableAmount)} />
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
          label={gstOnTop > 0 ? "Subtotal" : "Subtotal (incl. GST)"}
          value={Number(order.subtotal)}
        />
        {Number(order.discount) > 0 && (
          <SummaryRow
            label={order.couponCode ? `Discount (${order.couponCode})` : "Discount"}
            value={-Number(order.discount)}
          />
        )}
        {isDelivery && (
          <SummaryRow
            label={
              order.deliveryPaidToRider
                ? "Delivery (pay the rider)"
                : Number(order.deliveryFee) === 0
                  ? "Delivery (free)"
                  : "Delivery"
            }
            value={Number(order.deliveryFee)}
          />
        )}
        {gstOnTop > 0 && <SummaryRow label="GST (added)" value={gstOnTop} />}
        <hr className="my-3 border-cream-200" />
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink-700">Total</span>
          <span className="text-2xl font-semibold text-ink-900 tabular-nums">
            ₹{Number(order.total).toFixed(2)}
          </span>
        </div>
        {isDelivery && order.deliveryPaidToRider && (
          <p className="mt-1 text-xs text-ink-500">
            Excludes ₹{Number(order.deliveryFee).toFixed(0)} delivery, which you pay the rider
            directly.
          </p>
        )}
        <p className="mt-1 text-[11px] text-ink-500">
          Payment: {paymentMethodLabel(order.paymentMethod)} · {paymentStatusLabel(order)}
        </p>
      </div>

      {!awaitingPayment && (
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <div className="w-full max-w-sm text-center sm:w-auto">
            <CancelOrderButton order={order} />
          </div>
          <div className="w-full max-w-sm text-center sm:w-auto">
            <DownloadInvoiceButton order={order} />
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          to="/"
          className="rounded-full border border-ink-700 px-5 py-2 text-sm font-medium text-ink-700 transition hover:bg-cream-100"
        >
          Continue shopping
        </Link>
        <a
          href={`tel:${contact.phoneHref}`}
          className="rounded-full bg-brand-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          Call the bakery
        </a>
      </div>
    </section>
  );
}

type PaymentCheck = ReturnType<typeof usePaymentCheck>;

/**
 * Asks the server to reconcile with Cashfree a few times after the customer
 * lands back here, since the payment can take a moment to settle.
 */
function usePaymentCheck(orderId: string, enabled: boolean) {
  const verify = useVerifyPayment();
  const [state, setState] = useState<PaymentState | null>(null);
  const [checks, setChecks] = useState(0);
  const { mutate } = verify;

  const done = state === "PAID" || state === "FAILED" || state === "NOT_ONLINE";

  useEffect(() => {
    if (!enabled || done || checks >= PAYMENT_CHECKS) return;
    const timer = setTimeout(
      () => {
        mutate(orderId, {
          onSuccess: (res) => setState(res.state),
          onSettled: () => setChecks((n) => n + 1),
        });
      },
      checks === 0 ? 0 : PAYMENT_CHECK_INTERVAL_MS,
    );
    return () => clearTimeout(timer);
  }, [enabled, done, checks, orderId, mutate]);

  return {
    checking: enabled && (state === "PAID" || (!done && checks < PAYMENT_CHECKS)),
    failed: state === "FAILED",
    recheck: () => {
      setState(null);
      setChecks(0);
    },
  };
}

function PaymentPendingCard({ order, check }: { order: Order; check: PaymentCheck }) {
  const createSession = useCreatePaymentSession();
  const switchToCod = useSwitchToCod();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSwitchToCod = order.source === "STOREFRONT";

  const retry = async () => {
    setError(null);
    setRedirecting(true);
    try {
      const session = await createSession.mutateAsync(order.id);
      await payWithCashfree(session);
    } catch (err) {
      setRedirecting(false);
      setError(err instanceof Error ? err.message : "Couldn't start the payment");
    }
  };

  const payByCash = () => {
    setError(null);
    switchToCod.mutate(order.id, {
      onError: (err) => {
        setError(err instanceof Error ? err.message : "Couldn't switch to cash on delivery");
        check.recheck();
      },
    });
  };

  if (check.checking) {
    return (
      <div className="rounded-card border border-cream-200 bg-cream-50 p-6 text-center sm:p-8">
        <span className="mx-auto block h-12 w-12 animate-spin rounded-full border-4 border-brand-500/20 border-t-brand-500" />
        <h1 className="mt-4 font-display text-2xl text-ink-900">Confirming your payment…</h1>
        <p className="mt-1 text-sm text-ink-500">
          This usually takes a few seconds. Please don't close this page.
        </p>
        <p className="mt-3 inline-block rounded-full bg-white px-3 py-1 text-xs font-medium text-ink-700 tabular-nums ring-1 ring-cream-200">
          {order.orderNumber}
        </p>
      </div>
    );
  }

  const busy = redirecting || switchToCod.isPending;

  return (
    <div className="rounded-card border border-amber-200 bg-amber-50/60 p-6 text-center sm:p-8">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-2xl font-semibold text-white">
        !
      </div>
      <h1 className="font-display text-2xl text-ink-900 sm:text-3xl">
        {check.failed ? "Payment didn't go through" : "Payment not completed yet"}
      </h1>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
        {check.failed
          ? "The payment was declined or cancelled. You can try again"
          : "We haven't received your payment yet. If money was debited, it'll show up here shortly. Otherwise, try again"}
        {canSwitchToCod ? " or pay when your order arrives." : "."}
      </p>
      <p className="mt-3 inline-block rounded-full bg-white px-3 py-1 text-xs font-medium text-ink-700 tabular-nums ring-1 ring-amber-200">
        {order.orderNumber}
      </p>

      {error && (
        <p className="mx-auto mt-4 max-w-md rounded-md bg-brand-100/60 px-3 py-2 text-xs text-brand-700">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
        <button
          type="button"
          onClick={retry}
          disabled={busy}
          className="w-full max-w-xs rounded-full bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {redirecting ? "Opening payment…" : "Retry payment"}
        </button>
        {canSwitchToCod && (
          <button
            type="button"
            onClick={payByCash}
            disabled={busy}
            className="w-full max-w-xs rounded-full border border-ink-700 px-5 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {switchToCod.isPending ? "Switching…" : "Pay on delivery instead"}
          </button>
        )}
      </div>
      {!check.failed && (
        <button
          type="button"
          onClick={check.recheck}
          disabled={busy}
          className="mt-3 text-xs text-ink-500 hover:text-brand-700 hover:underline"
        >
          I've paid — check again
        </button>
      )}
    </div>
  );
}

function paymentMethodLabel(method: string) {
  switch (method) {
    case "cod":
      return "Cash on delivery";
    case "cash":
      return "Cash";
    case "upi":
      return "UPI transfer";
    case "netbanking":
      return "Netbanking";
    case "cashfree":
      return "Online payment";
    default:
      return method.toUpperCase();
  }
}

function paymentStatusLabel(order: Order) {
  switch (order.paymentStatus) {
    case "PAID":
      return "Paid";
    case "PARTIAL":
      return `Advance ₹${Number(order.advanceAmount).toFixed(0)} paid`;
    case "PENDING":
      return order.paymentMethod === "cashfree" ? "Awaiting payment" : "Due on delivery";
    case "FAILED":
      return "Payment failed";
    case "REFUNDED":
      return "Refunded";
  }
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-cream-200 bg-white p-5">
      <p className="mb-2 text-[11px] font-semibold tracking-wider text-ink-500 uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-0.5 text-sm">
      <span className={muted ? "text-xs text-ink-500" : "text-ink-700"}>{label}</span>
      <span className={muted ? "text-xs text-ink-500 tabular-nums" : "text-ink-900 tabular-nums"}>
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
