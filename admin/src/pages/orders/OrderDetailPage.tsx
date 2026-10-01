import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Phone,
  Mail,
  Truck,
  Store,
  Save,
  Pencil,
  FileText,
  Download,
  ClipboardList,
  Building2,
  Trash2,
  ChevronDown,
  Copy,
  Check,
  XCircle,
  ImagePlus,
  X,
} from "lucide-react";
import {
  useAdminOrder,
  useDeleteOrder,
  useDownloadChallan,
  useDownloadInvoice,
  useEmailInvoice,
  useRefreshPayment,
  useUpdateBuyerGst,
  useUpdateOrder,
  MAX_PAYMENT_SCREENSHOTS,
  type AdminOrder,
  type PaymentAttemptStatus,
  type InvoiceEmailResult,
  type OrderStatus,
  type PaymentStatus,
} from "@/hooks/useAdminOrders";
import { stateNameFromCode } from "@/lib/indiaStates";
import { gstinIssue, gstinStateCode, normalizeGstin } from "@/lib/gstin";
import { orderGstOnTop } from "@keyafe/shared";
import {
  AwaitingPaymentBadge,
  isAwaitingOnlinePayment,
  OFFLINE_PAYMENT_METHODS,
  paymentMethodLabel,
  paymentPlanLabel,
  StatusPill,
  STATUS_FLOW,
  SurpriseGiftBadge,
} from "@/pages/orders/order-ui";
import { cn } from "@/lib/cn";
import { textareaClass, inputClass } from "@/components/form/Field";
import { uploadImage } from "@/lib/uploads";
import { TIME_SLOTS } from "@/content/slots";
import { useStaffPermission } from "@/lib/permissions";
import { OrderItemsEditPanel } from "@/components/orders/OrderItemsEditPanel";
import { OrderItemCard, SlotSelect, slotLabelFor } from "@/components/orders/OrderItemCard";

export function OrderDetailPage() {
  const { idOrNumber = "" } = useParams<{ idOrNumber: string }>();
  const { data: order, isLoading, isError } = useAdminOrder(idOrNumber);
  const update = useUpdateOrder();
  const canUpdate = useStaffPermission("orders.update");
  const canReadInvoices = useStaffPermission("invoices.read");
  const canReadChallans = useStaffPermission("challans.read");
  const canDelete = useStaffPermission("orders.delete");
  const scheduleLocked = order?.status === "DELIVERED" || order?.status === "CANCELLED";
  const itemsEditLocked =
    scheduleLocked || Boolean(order?.invoiceNumber) || order?.paymentStatus === "REFUNDED";

  const [adminNotes, setAdminNotes] = useState("");
  useEffect(() => {
    if (order) setAdminNotes(order.adminNotes ?? "");
  }, [order?.adminNotes]);

  const [editingItems, setEditingItems] = useState(false);
  useEffect(() => {
    setEditingItems(false);
  }, [order?.id]);

  const [advanceInput, setAdvanceInput] = useState("");
  useEffect(() => {
    if (order) setAdvanceInput(order.advanceAmount);
  }, [order?.advanceAmount]);

  const [screenshotUploading, setScreenshotUploading] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);

  const uploadScreenshot = async (file: File) => {
    if (!order) return;
    setScreenshotError(null);
    setScreenshotUploading(true);
    try {
      const res = await uploadImage(file, "payment-screenshot");
      await update.mutateAsync({
        id: order.id,
        paymentScreenshotUrls: [...order.paymentScreenshotUrls, res.publicUrl],
      });
    } catch (err) {
      setScreenshotError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setScreenshotUploading(false);
    }
  };

  const removeScreenshot = async (url: string) => {
    if (!order || !confirm("Remove this payment screenshot?")) return;
    setScreenshotError(null);
    try {
      await update.mutateAsync({
        id: order.id,
        paymentScreenshotUrls: order.paymentScreenshotUrls.filter((u) => u !== url),
      });
    } catch (err) {
      setScreenshotError(err instanceof Error ? err.message : "Could not remove screenshot");
    }
  };

  if (isLoading) return <div className="p-8 text-center text-sm text-slate-500">Loading…</div>;
  if (isError || !order)
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Order not found.{" "}
        <Link to="/orders" className="text-brand-500 hover:underline">
          Back to orders
        </Link>
      </div>
    );

  const isDelivery = order.fulfillment === "DELIVERY";
  const billingSameAsDelivery = Boolean(
    isDelivery &&
    order.deliveryAddress &&
    order.billingAddress &&
    sameAddress(order.deliveryAddress, order.billingAddress),
  );

  return (
    <div>
      <Link
        to="/orders"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-500"
      >
        <ArrowLeft className="h-3 w-3" /> All orders
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold text-slate-900">{order.orderNumber}</h1>
            <StatusPill status={order.status} />
            {order.isSurpriseGift && <SurpriseGiftBadge />}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {isDelivery ? "Delivery" : "Pickup"} · placed{" "}
            {new Date(order.createdAt).toLocaleString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {order.invoiceDate &&
              ` · bill generated ${new Date(order.invoiceDate).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "Asia/Kolkata",
              })}`}
          </p>
        </div>
        <StatusChanger
          currentStatus={order.status}
          onChange={(status) => update.mutate({ id: order.id, status })}
          pending={update.isPending}
        />
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
        <div className="min-w-0 space-y-3 lg:space-y-6">
          <Card title="Items">
            {canUpdate && !itemsEditLocked && !editingItems && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-slate-500">
                  Need a different size, qty, or ref image? Edit items without cancelling the order.
                </p>
                <button
                  type="button"
                  onClick={() => setEditingItems(true)}
                  className="rounded-md border border-brand-300 bg-white px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                >
                  Edit items
                </button>
              </div>
            )}
            {itemsEditLocked && canUpdate && (
              <p className="mb-3 text-[11px] text-slate-500">
                {order.invoiceNumber
                  ? "Items locked — invoice already issued."
                  : "Items locked on delivered, cancelled, or refunded orders."}
              </p>
            )}
            {editingItems && canUpdate && !itemsEditLocked ? (
              <OrderItemsEditPanel order={order} onClose={() => setEditingItems(false)} />
            ) : (
              <>
            {canUpdate && order.items.length > 1 && !scheduleLocked && (
              <BulkScheduleBar
                pending={update.isPending}
                onApply={async (deliveryDate, slotKey, slotLabel) => {
                  await update.mutateAsync({
                    id: order.id,
                    items: order.items.map((it) => ({
                      id: it.id,
                      deliveryDate,
                      deliverySlotKey: deliveryDate ? slotKey : null,
                      deliverySlotLabel: deliveryDate ? slotLabel : null,
                    })),
                  });
                }}
              />
            )}
            <ul className="divide-y divide-slate-100">
              {order.items.map((it) => (
                <li key={it.id}>
                  <OrderItemCard
                    item={it}
                    pending={update.isPending}
                    onSaveSchedule={
                      canUpdate && !scheduleLocked
                        ? (payload) => update.mutateAsync({ id: order.id, items: [payload] })
                        : undefined
                    }
                  />
                </li>
              ))}
            </ul>
              </>
            )}
          </Card>

          <Card
            title="Totals"
            collapsible
            summary={`₹${Number(order.total).toFixed(2)} · ${paymentMethodLabel(order.paymentMethod)} · ${
              isAwaitingOnlinePayment(order) ? "Awaiting payment" : order.paymentStatus.toLowerCase()
            }`}
          >
            <div className="space-y-1 text-sm">
              {Number(order.taxableAmount) > 0 && (
                <>
                  <Row label="Taxable amount" value={Number(order.taxableAmount)} muted />
                  {Number(order.cgstAmount) > 0 && (
                    <Row label="CGST" value={Number(order.cgstAmount)} muted />
                  )}
                  {Number(order.sgstAmount) > 0 && (
                    <Row label="SGST" value={Number(order.sgstAmount)} muted />
                  )}
                  {Number(order.igstAmount) > 0 && (
                    <Row label="IGST" value={Number(order.igstAmount)} muted />
                  )}
                  <div className="my-1 border-t border-dashed border-slate-200" />
                </>
              )}
              <Row
                label={orderGstOnTop(order) > 0 ? "Subtotal" : "Subtotal (incl. GST)"}
                value={Number(order.subtotal)}
              />
              {isDelivery &&
                (order.deliveryPaidToRider ? (
                  <Row
                    label="Delivery fee · paid to rider, not in total"
                    value={Number(order.deliveryFee)}
                    muted
                  />
                ) : (
                  <Row label="Delivery fee" value={Number(order.deliveryFee)} />
                ))}
              {Number(order.discount) > 0 && (
                <Row
                  label={order.couponCode ? `Discount (${order.couponCode})` : "Discount"}
                  value={-Number(order.discount)}
                />
              )}
              {orderGstOnTop(order) > 0 && <Row label="GST (added)" value={orderGstOnTop(order)} />}
              <div className="my-2 border-t-2 border-slate-900" />
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-900">Total</span>
                <span className="text-2xl font-semibold text-slate-900 tabular-nums">
                  ₹{Number(order.total).toFixed(2)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Payment: {paymentMethodLabel(order.paymentMethod)} ·{" "}
                {isAwaitingOnlinePayment(order) ? "Awaiting online payment" : order.paymentStatus}
              </p>
              {Number(order.advanceAmount) > 0 && (
                <>
                  <Row label="Advance received" value={Number(order.advanceAmount)} muted />
                  <Row
                    label="Pending"
                    value={Math.max(Number(order.total) - Number(order.advanceAmount), 0)}
                    muted
                  />
                </>
              )}
            </div>
          </Card>

          {canReadInvoices && <InvoiceCard order={order} canUpdate={canUpdate} />}

          {/* Corporate orders need both documents: the tax invoice for the
              books and the challan to hand over with the goods. */}
          {canReadChallans && isCorporateOrder(order) && <ChallanCard order={order} />}

          {order.customerNotes && (
            <Card title="Customer notes">
              <p className="text-sm text-slate-700">{order.customerNotes}</p>
            </Card>
          )}

          <Card
            title="Admin notes"
            subtitle="Only visible to the kitchen"
            collapsible
            summary={order.adminNotes?.trim() || "No notes yet"}
          >
            <textarea
              rows={3}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="e.g. Batch with tomorrow's Aditi order"
              className={textareaClass}
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              {update.isPending && <span className="text-xs text-slate-500">Saving…</span>}
              <button
                type="button"
                onClick={() => update.mutate({ id: order.id, adminNotes })}
                disabled={update.isPending || adminNotes === (order.adminNotes ?? "")}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" /> Save notes
              </button>
            </div>
          </Card>
        </div>

        <aside className="min-w-0 space-y-3 lg:space-y-6">
          <Card
            title="Customer"
            collapsible
            summary={`${order.customerCompanyName ?? order.customerName} · ${order.customerPhone}`}
          >
            {order.customerCompanyName ? (
              <>
                <p className="flex items-center gap-1.5 font-medium text-slate-900">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  {order.customerCompanyName}
                </p>
                <p className="text-sm text-slate-600">Contact: {order.customerName}</p>
              </>
            ) : (
              <p className="font-medium text-slate-900">{order.customerName}</p>
            )}
            <a
              href={`tel:${order.customerPhone}`}
              className="mt-1 flex items-center gap-1.5 text-sm text-brand-700 hover:underline"
            >
              <Phone className="h-3.5 w-3.5" /> {order.customerPhone}
              {order.isSurpriseGift && (
                <span className="text-[10px] font-medium tracking-wide text-violet-700 uppercase">
                  buyer
                </span>
              )}
            </a>
            {order.customerEmail && (
              <a
                href={`mailto:${order.customerEmail}`}
                className="mt-1 flex items-center gap-1.5 text-sm text-brand-700 hover:underline"
              >
                <Mail className="h-3.5 w-3.5" /> {order.customerEmail}
              </a>
            )}
            {order.isSurpriseGift && (
              <p className="mt-2 text-xs text-violet-700">
                Surprise gift — use this number for all customer contact.
              </p>
            )}
          </Card>

          <Card
            title={isDelivery ? "Delivery to" : "Pickup"}
            icon={isDelivery ? <Truck className="h-4 w-4" /> : <Store className="h-4 w-4" />}
            collapsible
            summary={
              isDelivery && order.deliveryAddress
                ? [
                    order.deliveryAddress.line1,
                    order.deliveryAddress.area,
                    order.deliveryAddress.pincode,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "Bakery HQ · Howrah 711202"
            }
          >
            {isDelivery && order.deliveryAddress ? (
              <>
                {(order.recipientName || order.deliveryPhone) && (
                  <div className="mb-2 text-sm text-slate-800">
                    {order.recipientName && (
                      <p className="font-medium">{order.recipientName}</p>
                    )}
                    {order.deliveryPhone && (
                      <p className="text-slate-600">
                        {order.isSurpriseGift ? (
                          <span>
                            Delivery phone: {order.deliveryPhone}{" "}
                            <span className="text-[10px] font-semibold tracking-wide text-violet-700 uppercase">
                              do not call
                            </span>
                          </span>
                        ) : (
                          <a
                            href={`tel:${order.deliveryPhone}`}
                            className="text-brand-700 hover:underline"
                          >
                            {order.deliveryPhone}
                          </a>
                        )}
                      </p>
                    )}
                  </div>
                )}
                <address className="text-sm text-slate-700 not-italic">
                  <p>{order.deliveryAddress.line1}</p>
                  {order.deliveryAddress.line2 && <p>{order.deliveryAddress.line2}</p>}
                  {order.deliveryAddress.landmark && (
                    <p className="text-slate-500">Near {order.deliveryAddress.landmark}</p>
                  )}
                  <p>
                    {[order.deliveryAddress.area, order.deliveryAddress.city]
                      .filter(Boolean)
                      .join(", ")}{" "}
                    {order.deliveryAddress.pincode}
                  </p>
                </address>
                {order.deliveryAddress.mapSearchQuery && (
                  <CopyForRideApp text={order.deliveryAddress.mapSearchQuery} />
                )}
                {billingSameAsDelivery && (
                  <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
                    Billing address: same as delivery
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-700">Bakery HQ · Howrah 711202</p>
            )}
          </Card>

          {order.billingAddress && !billingSameAsDelivery && (
            <Card
              title="Billing address"
              collapsible
              summary={[order.billingAddress.line1, order.billingAddress.pincode]
                .filter(Boolean)
                .join(" · ")}
            >
              <address className="text-sm text-slate-700 not-italic">
                <p>{order.billingAddress.line1}</p>
                {order.billingAddress.line2 && <p>{order.billingAddress.line2}</p>}
                {order.billingAddress.landmark && (
                  <p className="text-slate-500">Near {order.billingAddress.landmark}</p>
                )}
                <p>
                  {[order.billingAddress.area, order.billingAddress.city]
                    .filter(Boolean)
                    .join(", ")}{" "}
                  {order.billingAddress.pincode}
                </p>
              </address>
            </Card>
          )}

          <Card
            title="Payment"
            collapsible
            summary={`${
              order.paymentMethod === "cashfree"
                ? "Online (Cashfree)"
                : paymentMethodLabel(order.paymentMethod)
            } · ${paymentPlanLabel(order)} · ${
              isAwaitingOnlinePayment(order) ? "Awaiting payment" : order.paymentStatus.toLowerCase()
            }`}
          >
            <p className="text-sm text-slate-900">
              {order.paymentMethod === "cashfree"
                ? "Online (Cashfree)"
                : paymentMethodLabel(order.paymentMethod)}{" "}
              · {paymentPlanLabel(order)}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <PaymentPill status={order.paymentStatus} />
              {isAwaitingOnlinePayment(order) && <AwaitingPaymentBadge />}
            </div>
            {(order.paymentMethod === "cashfree" || (order.paymentAttempts?.length ?? 0) > 0) && (
              <OnlinePaymentPanel order={order} canRefresh={canUpdate} />
            )}
            {order.paymentMethod !== "cashfree" && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-slate-700">
                  Payment mode
                  <span className="ml-1 font-normal text-slate-400">· for your records</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {OFFLINE_PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      aria-pressed={order.paymentMethod === m.value}
                      onClick={() => update.mutate({ id: order.id, paymentMethod: m.value })}
                      disabled={update.isPending || order.paymentMethod === m.value}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition disabled:cursor-default",
                        order.paymentMethod === m.value
                          ? "border-brand-500 bg-brand-500 text-white"
                          : "hover:border-brand-300 border-slate-200 bg-white text-slate-700 disabled:opacity-50",
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(["PENDING", "PARTIAL", "PAID", "FAILED", "REFUNDED"] as PaymentStatus[])
                .filter((s) => s !== order.paymentStatus)
                .map((s) => (
                  <button
                    key={s}
                    onClick={() => update.mutate({ id: order.id, paymentStatus: s })}
                    disabled={update.isPending}
                    className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700 disabled:opacity-50"
                  >
                    Mark {s.toLowerCase()}
                  </button>
                ))}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <label className="text-xs font-medium text-slate-700">Amount received</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  inputMode="decimal"
                  value={advanceInput}
                  onChange={(e) => setAdvanceInput(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="w-28 rounded-md border border-slate-200 px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    update.mutate({
                      id: order.id,
                      advanceAmount: Number(advanceInput) || 0,
                    })
                  }
                  disabled={
                    update.isPending ||
                    Number(advanceInput) === Number(order.advanceAmount) ||
                    Number(advanceInput) > Number(order.total) ||
                    Number(advanceInput) < 0
                  }
                  className="rounded-md bg-brand-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Pending: ₹
                {Math.max(Number(order.total) - (Number(advanceInput) || 0), 0).toFixed(2)}
              </p>
            </div>

            {order.paymentMethod !== "cashfree" && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-700">Payment screenshots</span>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {order.paymentScreenshotUrls.length}/{MAX_PAYMENT_SCREENSHOTS}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {order.paymentScreenshotUrls.map((url, index) => (
                    <div key={url} className="relative">
                      <a href={url} target="_blank" rel="noreferrer" className="block">
                        <img
                          src={url}
                          alt={`Payment proof ${index + 1}`}
                          className="h-20 w-20 rounded-md border border-slate-200 object-cover"
                        />
                      </a>
                      <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-slate-900/70 px-1.5 text-[10px] font-medium text-white">
                        {index + 1}
                      </span>
                      {canUpdate && (
                        <button
                          type="button"
                          onClick={() => void removeScreenshot(url)}
                          disabled={update.isPending}
                          aria-label={`Remove payment screenshot ${index + 1}`}
                          className="absolute -top-1.5 -right-1.5 rounded-full bg-white p-0.5 text-slate-500 shadow ring-1 ring-slate-200 transition hover:text-red-600 disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {canUpdate && order.paymentScreenshotUrls.length < MAX_PAYMENT_SCREENSHOTS && (
                    <label
                      className={cn(
                        "flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 text-[11px] font-medium text-slate-500 transition hover:border-brand-500 hover:text-brand-600",
                        screenshotUploading && "pointer-events-none opacity-60",
                      )}
                    >
                      <ImagePlus className="h-5 w-5" />
                      {screenshotUploading ? "Uploading…" : "Add"}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={screenshotUploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) void uploadScreenshot(file);
                        }}
                        className="sr-only"
                      />
                    </label>
                  )}
                  {!canUpdate && order.paymentScreenshotUrls.length === 0 && (
                    <p className="text-[11px] text-slate-400">None uploaded.</p>
                  )}
                </div>
                {screenshotError && (
                  <p className="mt-1 text-[11px] text-red-700">{screenshotError}</p>
                )}
              </div>
            )}
          </Card>

          {order.status !== "CANCELLED" && <CancelOrderCard order={order} />}
          {canDelete && <DeleteOrderCard order={order} />}
        </aside>
      </div>
    </div>
  );
}

function BulkScheduleBar({
  pending,
  onApply,
}: {
  pending: boolean;
  onApply: (deliveryDate: string | null, slotKey: string, slotLabel: string) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [slotKey, setSlotKey] = useState<string>(TIME_SLOTS[0].key);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-2 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-brand-700"
      >
        <Pencil className="h-3 w-3" /> Change date & slot for every item
      </button>
    );
  }

  const close = () => {
    setOpen(false);
    setError(null);
  };

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-medium text-slate-600">Set date & slot for every item</p>
      <div className="flex flex-wrap items-end gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={cn(inputClass, "w-auto py-1.5 text-xs")}
          aria-label="Delivery date"
        />
        <div className="min-w-40 flex-1 sm:max-w-64">
          <SlotSelect
            value={slotKey}
            onChange={setSlotKey}
            disabled={pending}
            className="py-1.5 text-xs"
          />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          disabled={pending || !date}
          onClick={async () => {
            setError(null);
            try {
              await onApply(date, slotKey, slotLabelFor(slotKey));
              close();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not update");
            }
          }}
          className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Apply to all
        </button>
        <button
          type="button"
          onClick={close}
          disabled={pending}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-brand-600">{error}</p>}
    </div>
  );
}

/**
 * A challan is only worth printing when someone is taking delivery on a
 * business's behalf, which is exactly the orders carrying a company name or a
 * GSTIN. Ordinary B2C orders never show the card.
 */
function isCorporateOrder(order: AdminOrder): boolean {
  return Boolean(order.customerCompanyName || order.customerGstin);
}

function ChallanCard({ order }: { order: AdminOrder }) {
  const download = useDownloadChallan();
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const issued = Boolean(order.challanNumber);
  // The server refuses to number a cancelled order, so say so up front rather
  // than letting the click fail.
  const blocked =
    order.status === "CANCELLED" && !issued
      ? "This order was cancelled, so nothing was handed over and no challan can be raised."
      : null;

  return (
    <Card
      collapsible
      summary={order.challanNumber ?? "Not issued yet"}
      title="Delivery challan"
      subtitle={
        issued
          ? "Already issued — downloading again reprints the same number"
          : "A permanent challan number is assigned the first time you download"
      }
      icon={<ClipboardList className="h-4 w-4 text-slate-400" />}
    >
      <dl className="space-y-1.5 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-xs text-slate-500">Challan number</dt>
          <dd
            className={cn(
              "text-right",
              issued ? "font-mono text-slate-900" : "text-xs text-slate-400",
            )}
          >
            {order.challanNumber ?? "Not issued yet"}
          </dd>
        </div>
        {order.challanDate && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-xs text-slate-500">Challan date</dt>
            <dd className="text-right text-slate-700">
              {new Date(order.challanDate).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-xs text-slate-500">Quantity to hand over</dt>
          <dd className="text-right text-slate-700">
            {order.items.reduce((sum, i) => sum + i.qty, 0)} Nos
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-slate-500">
        Carries quantities and HSN codes only — no prices or GST. Print it, hand it over with the
        goods and have the receiver sign it.
      </p>

      {blocked ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{blocked}</p>
      ) : (
        <div className="mt-4">
          <button
            type="button"
            disabled={download.isPending}
            onClick={() => {
              setNote(null);
              setError(null);
              download
                .mutateAsync({ id: order.id, orderNumber: order.orderNumber })
                .then((r) =>
                  setNote(r.challanNumber ? `Downloaded ${r.challanNumber}` : "Downloaded"),
                )
                .catch((err: unknown) =>
                  setError(err instanceof Error ? err.message : "Something went wrong"),
                );
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {download.isPending ? "Preparing…" : "Download challan"}
          </button>
        </div>
      )}

      {note && <p className="mt-2 text-xs text-emerald-700">{note}</p>}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </Card>
  );
}

function InvoiceCard({ order, canUpdate }: { order: AdminOrder; canUpdate: boolean }) {
  const download = useDownloadInvoice();
  const email = useEmailInvoice();
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingGst, setEditingGst] = useState(false);
  const canEditGst = canUpdate && order.status !== "CANCELLED";

  // Which tax applied is derived from the amounts actually charged, rather
  // than re-deriving the seller's state on the client.
  const isIntraState = Number(order.cgstAmount) > 0;
  const isInterState = Number(order.igstAmount) > 0;
  const placeName = stateNameFromCode(order.placeOfSupply);

  const issued = Boolean(order.invoiceNumber);
  // The server refuses to number a cancelled order, so say so up front rather
  // than letting the click fail.
  const blocked =
    order.status === "CANCELLED" && !issued
      ? "This order was cancelled, so it can't be invoiced. Issue a credit note instead."
      : null;
  const busy = download.isPending || email.isPending;

  const run = async (fn: () => Promise<unknown>, done: (r: unknown) => string) => {
    setNote(null);
    setError(null);
    try {
      const result = await fn();
      setNote(done(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <Card
      collapsible
      summary={
        order.invoiceNumber
          ? `${order.invoiceNumber}${order.customerGstin ? ` · GSTIN ${order.customerGstin}` : ""}`
          : "Not issued yet"
      }
      title="Tax invoice"
      subtitle={
        issued
          ? "Already issued — downloading again reuses the same number"
          : "A permanent invoice number is assigned the first time you download or email"
      }
      icon={<FileText className="h-4 w-4 text-slate-400" />}
    >
      <dl className="space-y-1.5 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-xs text-slate-500">Invoice number</dt>
          <dd
            className={cn(
              "text-right",
              issued ? "font-mono text-slate-900" : "text-xs text-slate-400",
            )}
          >
            {order.invoiceNumber ?? "Not issued yet"}
          </dd>
        </div>
        {order.invoiceDate && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-xs text-slate-500">Invoice date</dt>
            <dd className="text-right text-slate-700">
              {new Date(order.invoiceDate).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-xs text-slate-500">Place of supply</dt>
          <dd className="text-right text-slate-700">
            {order.placeOfSupply ? `${placeName ?? "Unknown"} (${order.placeOfSupply})` : "—"}
            {(isIntraState || isInterState) && (
              <span className="ml-1.5 text-xs text-slate-400">
                {isIntraState ? "CGST + SGST" : "IGST"}
              </span>
            )}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-xs text-slate-500">Billed to</dt>
          <dd className="text-right">
            {order.customerGstin ? (
              <>
                <span className="text-slate-900">{order.customerCompanyName}</span>
                <span className="ml-1.5 rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-800">
                  {order.customerGstin}
                </span>
              </>
            ) : (
              <span className="text-xs text-slate-400">Individual — no GSTIN on this order</span>
            )}
            {canEditGst && !editingGst && (
              <button
                type="button"
                onClick={() => {
                  setNote(null);
                  setError(null);
                  setEditingGst(true);
                }}
                className="ml-2 text-xs font-medium text-brand-700 hover:underline"
              >
                {order.customerGstin ? "Edit" : "Add GSTIN"}
              </button>
            )}
          </dd>
        </div>
      </dl>

      {editingGst && (
        <BuyerGstEditor
          order={order}
          onClose={() => setEditingGst(false)}
          onSaved={(message) => {
            setEditingGst(false);
            setNote(message);
          }}
        />
      )}

      {blocked ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{blocked}</p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(
                () =>
                  download.mutateAsync({
                    id: order.id,
                    orderNumber: order.orderNumber,
                  }),
                () => "Downloaded",
              )
            }
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {download.isPending ? "Preparing…" : "Download PDF"}
          </button>

          <button
            type="button"
            disabled={busy || !order.customerEmail}
            onClick={() =>
              void run(
                () => email.mutateAsync({ id: order.id }),
                (r) => {
                  const result = r as InvoiceEmailResult;
                  return result.sent
                    ? `Emailed to ${result.to}`
                    : "Email is not configured on the server, so nothing was sent";
                },
              )
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Mail className="h-3.5 w-3.5" />
            {email.isPending ? "Sending…" : "Email to customer"}
          </button>

          {!order.customerEmail && (
            <span className="text-xs text-slate-400">No email on this order</span>
          )}
        </div>
      )}

      {note && <p className="mt-2 text-xs text-emerald-700">{note}</p>}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </Card>
  );
}

function CancelOrderCard({ order }: { order: AdminOrder }) {
  const update = useUpdateOrder();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async () => {
    setError(null);
    try {
      await update.mutateAsync({ id: order.id, status: "CANCELLED" });
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel the order");
    }
  };

  return (
    <section className="rounded-card border border-amber-200 bg-white">
      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Cancel order</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Stops the order and emails the customer. Works even if the kitchen has started.
        </p>
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50"
          >
            <XCircle className="h-3.5 w-3.5" /> Cancel order
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-slate-800">
              Cancel {order.orderNumber}? The customer will be notified.
            </p>
            {error && <p className="text-xs text-red-700">{error}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void cancel()}
                disabled={update.isPending}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {update.isPending ? "Cancelling…" : "Yes, cancel order"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setError(null);
                }}
                disabled={update.isPending}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Keep order
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function DeleteOrderCard({ order }: { order: AdminOrder }) {
  const navigate = useNavigate();
  const remove = useDeleteOrder();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  const matches = typed.trim().toUpperCase() === order.orderNumber.toUpperCase();
  const paidAmount =
    order.paymentStatus === "PAID"
      ? Number(order.total)
      : order.paymentStatus === "PARTIAL"
        ? Number(order.advanceAmount)
        : 0;
  const warnings = [
    order.invoiceNumber &&
      `Tax invoice ${order.invoiceNumber} has been issued. That number won't be reused, so your GST invoice series will have a gap — keep a copy of the invoice for your records.`,
    order.challanNumber && `Delivery challan ${order.challanNumber} will no longer exist.`,
    paidAmount > 0 &&
      `₹${paidAmount.toLocaleString("en-IN")} was collected on this order${
        order.paymentMethod === "cashfree" ? " online" : ""
      }. Deleting doesn't refund it.`,
  ].filter((w): w is string => Boolean(w));

  const submit = async () => {
    setError(null);
    try {
      await remove.mutateAsync({ id: order.id, confirmOrderNumber: typed.trim() });
      navigate("/orders", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the order");
    }
  };

  return (
    <section className="rounded-card border border-red-200 bg-white">
      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Delete order</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Permanently removes the order, its items and payment records. This can't be undone — to
          stop an order, cancel it instead.
        </p>
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete order
          </button>
        ) : (
          <form
            className="mt-3 space-y-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (matches) void submit();
            }}
          >
            {warnings.length > 0 && (
              <ul className="space-y-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <label className="block">
              <span className="text-xs text-slate-600">
                Type <span className="font-mono font-semibold">{order.orderNumber}</span> to confirm
              </span>
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={order.orderNumber}
                className={cn(inputClass, "mt-1 font-mono")}
              />
            </label>
            {error && <p className="text-xs text-red-700">{error}</p>}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!matches || remove.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {remove.isPending ? "Deleting…" : "Delete permanently"}
              </button>
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => {
                  setOpen(false);
                  setTyped("");
                  setError(null);
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Keep order
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function BuyerGstEditor({
  order,
  onClose,
  onSaved,
}: {
  order: AdminOrder;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const save = useUpdateBuyerGst();
  const [companyName, setCompanyName] = useState(order.customerCompanyName ?? "");
  const [gstin, setGstin] = useState(order.customerGstin ?? "");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeGstin(gstin);
  const gstinError = gstinIssue(normalized);
  const nameError =
    companyName.trim().length < 2 ? "Enter the registered business name" : null;
  const newState = gstinError ? null : gstinStateCode(normalized);
  const unchanged =
    normalized === (order.customerGstin ?? "") &&
    companyName.trim() === (order.customerCompanyName ?? "");
  const stateChanges = !!newState && !!order.placeOfSupply && newState !== order.placeOfSupply;

  const submit = async (body: { customerGstin: string | null; customerCompanyName: string | null }) => {
    setError(null);
    try {
      const result = await save.mutateAsync({ id: order.id, ...body });
      const pos = result.order.placeOfSupply;
      const split = Number(result.order.igstAmount) > 0 ? "IGST" : "CGST + SGST";
      const base = body.customerGstin ? "GST details saved" : "GSTIN removed";
      onSaved(
        result.placeOfSupplyChanged && pos
          ? `${base}. Place of supply is now ${stateNameFromCode(pos) ?? pos} (${pos}), charged as ${split}.`
          : `${base}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save GST details");
    }
  };

  return (
    <form
      className="mt-3 space-y-2.5 rounded-md border border-slate-200 bg-slate-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (gstinError || nameError) return;
        void submit({ customerGstin: normalized, customerCompanyName: companyName.trim() });
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="block min-w-0">
          <span className="text-xs font-medium text-slate-600">Business name</span>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            maxLength={160}
            placeholder="As on GST certificate"
            className={cn(inputClass, "mt-1")}
          />
          {touched && nameError && <span className="text-xs text-red-700">{nameError}</span>}
        </label>
        <label className="block min-w-0">
          <span className="text-xs font-medium text-slate-600">GSTIN</span>
          <input
            value={gstin}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
            onBlur={() => setGstin(normalizeGstin(gstin))}
            maxLength={20}
            placeholder="19ABCDE1234F1Z5"
            className={cn(inputClass, "mt-1 font-mono uppercase")}
          />
          {touched && gstinError && <span className="text-xs text-red-700">{gstinError}</span>}
        </label>
      </div>

      {stateChanges && (
        <p className="rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
          This GSTIN is registered in {stateNameFromCode(newState) ?? newState}, so the place of
          supply moves from {stateNameFromCode(order.placeOfSupply) ?? order.placeOfSupply} to{" "}
          {stateNameFromCode(newState) ?? newState}. The GST already charged is re-split between
          CGST + SGST and IGST — the order total doesn't change.
        </p>
      )}
      {order.invoiceNumber && (
        <p className="text-xs text-slate-500">
          Invoice <span className="font-mono">{order.invoiceNumber}</span> is already issued. The
          next download or email will show these details under the same number — send the
          customer the updated copy.
        </p>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={save.isPending || unchanged}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {save.isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={save.isPending}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-50"
        >
          Cancel
        </button>
        {order.customerGstin && (
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => {
              if (!window.confirm("Remove the GSTIN and bill this order to an individual?")) return;
              void submit({ customerGstin: null, customerCompanyName: null });
            }}
            className="ml-auto text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
          >
            Remove GSTIN
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * With `collapsible`, the card folds down to its header and `summary` below
 * the lg breakpoint, where the page is a single long column. From lg up every
 * card stays open.
 */
function Card({
  title,
  subtitle,
  icon,
  summary,
  collapsible = false,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  summary?: React.ReactNode;
  collapsible?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!collapsible);
  const collapsed = collapsible && !open;

  const heading = (
    <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
      {icon}
      {title}
    </h2>
  );

  return (
    <section className="rounded-card border border-slate-200 bg-white">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(
            "flex w-full items-start gap-2 px-4 py-3 text-left lg:pointer-events-none",
            collapsed ? "lg:border-b lg:border-slate-100" : "border-b border-slate-100",
          )}
        >
          <div className="min-w-0 flex-1">
            {heading}
            {collapsed && summary && (
              <p className="mt-0.5 truncate text-xs text-slate-500 lg:hidden">{summary}</p>
            )}
            {subtitle && (
              <p className={cn("mt-0.5 text-xs text-slate-500", collapsed && "hidden lg:block")}>
                {subtitle}
              </p>
            )}
          </div>
          <ChevronDown
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform lg:hidden",
              open && "rotate-180",
            )}
          />
        </button>
      ) : (
        <div className="border-b border-slate-100 px-4 py-3">
          {heading}
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      )}
      <div className={cn("p-4", collapsed && "hidden lg:block")}>{children}</div>
    </section>
  );
}

function sameAddress(
  a: NonNullable<AdminOrder["deliveryAddress"]>,
  b: NonNullable<AdminOrder["billingAddress"]>,
): boolean {
  const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
  return (["line1", "line2", "landmark", "area", "city", "pincode"] as const).every(
    (k) => norm(a[k]) === norm(b[k]),
  );
}

function CopyForRideApp({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="mt-3 flex w-full items-center gap-2.5 rounded-lg border border-brand-500/20 bg-brand-100/50 px-3 py-2 text-left hover:bg-brand-100"
    >
      {copied ? (
        <Check className="h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <Copy className="h-4 w-4 shrink-0 text-brand-700" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold tracking-wide text-brand-700 uppercase">
          {copied ? "Copied" : "Copy for Uber / Rapido"}
        </span>
        <span className="line-clamp-1 text-xs text-slate-700">{text}</span>
      </span>
    </button>
  );
}

function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between",
        muted ? "text-xs text-slate-500" : "text-slate-700",
      )}
    >
      <span>{label}</span>
      <span className={cn("tabular-nums", !muted && "text-slate-900")}>₹{value.toFixed(2)}</span>
    </div>
  );
}

function PaymentPill({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, string> = {
    PENDING: "bg-slate-100 text-slate-700",
    PARTIAL: "bg-amber-50 text-amber-700",
    PAID: "bg-emerald-50 text-emerald-700",
    FAILED: "bg-red-50 text-red-700",
    REFUNDED: "bg-amber-50 text-amber-700",
  };
  return (
    <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium", map[status])}>
      {status}
    </span>
  );
}

const ATTEMPT_LABEL: Record<PaymentAttemptStatus, { label: string; className: string }> = {
  CREATED: { label: "Open", className: "text-slate-600" },
  SUCCESS: { label: "Paid", className: "text-emerald-700" },
  FAILED: { label: "Failed", className: "text-red-700" },
  USER_DROPPED: { label: "Abandoned", className: "text-amber-700" },
  EXPIRED: { label: "Closed", className: "text-slate-400" },
};

function OnlinePaymentPanel({ order, canRefresh }: { order: AdminOrder; canRefresh: boolean }) {
  const refresh = useRefreshPayment();
  const attempts = order.paymentAttempts ?? [];
  const paid = attempts.find((a) => a.status === "SUCCESS");

  return (
    <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-2.5 text-xs">
      {order.paidAt && (
        <p className="text-slate-700">
          Paid on{" "}
          {new Date(order.paidAt).toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      )}
      {paid?.gatewayPaymentId && (
        <p className="mt-0.5 text-slate-500">
          Cashfree payment ID{" "}
          <span className="font-mono text-slate-700 select-all">{paid.gatewayPaymentId}</span>
          {paid.paymentGroup && ` · ${paid.paymentGroup.replace(/_/g, " ")}`}
        </p>
      )}
      {attempts.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {attempts.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[11px] text-slate-500">
                {a.gatewayOrderId}
              </span>
              <span className="shrink-0 tabular-nums">
                ₹{Number(a.amount).toFixed(0)} ·{" "}
                <span className={ATTEMPT_LABEL[a.status].className}>
                  {ATTEMPT_LABEL[a.status].label}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {attempts.length === 0 && !order.paidAt && (
        <p className="text-slate-500">The customer hasn't opened the payment page yet.</p>
      )}
      {canRefresh && !order.paidAt && attempts.length > 0 && (
        <button
          type="button"
          onClick={() => refresh.mutate({ id: order.id, orderNumber: order.orderNumber })}
          disabled={refresh.isPending}
          className="mt-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700 disabled:opacity-50"
        >
          {refresh.isPending ? "Checking with Cashfree…" : "Refresh payment status"}
        </button>
      )}
      {refresh.error && (
        <p className="mt-1 text-[11px] text-red-700">
          {refresh.error instanceof Error ? refresh.error.message : "Couldn't reach Cashfree"}
        </p>
      )}
    </div>
  );
}

function StatusChanger({
  currentStatus,
  onChange,
  pending,
}: {
  currentStatus: OrderStatus;
  onChange: (status: OrderStatus) => void;
  pending: boolean;
}) {
  const currentIdx = STATUS_FLOW.indexOf(currentStatus);
  const next =
    currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;
  const others = STATUS_FLOW.filter((s) => s !== currentStatus && s !== next);
  const pretty = (s: OrderStatus) => s.toLowerCase().replace(/_/g, " ");
  const statusMoveLabel = (s: OrderStatus) => {
    if (currentStatus === "CANCELLED") return `Restore as ${pretty(s)}`;
    return STATUS_FLOW.indexOf(s) < currentIdx ? `Back to ${pretty(s)}` : `Skip to ${pretty(s)}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {next && (
        <button
          type="button"
          onClick={() => onChange(next)}
          disabled={pending}
          className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Mark {next.toLowerCase().replace(/_/g, " ")} →
        </button>
      )}
      {others.length > 0 && (
        <label className="relative inline-flex">
          <span className="sr-only">Change status</span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) onChange(e.target.value as OrderStatus);
            }}
            disabled={pending}
            className="appearance-none rounded-md border border-slate-200 bg-white py-1.5 pr-7 pl-2.5 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 focus:ring-2 focus:ring-brand-500/20 focus:outline-none disabled:opacity-50"
          >
            <option value="" disabled hidden>
              {next ? "Other status" : "Change status"}
            </option>
            {others.map((s) => (
              <option key={s} value={s}>
                {statusMoveLabel(s)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </label>
      )}
    </div>
  );
}
