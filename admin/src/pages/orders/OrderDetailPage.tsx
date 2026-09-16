import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Phone,
  Mail,
  Truck,
  Store,
  Save,
  ImageOff,
  FileText,
  Download,
  ClipboardList,
} from "lucide-react";
import {
  useAdminOrder,
  useDownloadChallan,
  useDownloadInvoice,
  useEmailInvoice,
  useUpdateOrder,
  type AdminOrder,
  type InvoiceEmailResult,
  type OrderStatus,
  type PaymentStatus,
} from "@/hooks/useAdminOrders";
import { stateNameFromCode } from "@/lib/indiaStates";
import { StatusPill, STATUS_FLOW } from "@/pages/orders/order-ui";
import { cn } from "@/lib/cn";
import { textareaClass, inputClass, selectClass } from "@/components/form/Field";
import { uploadImage } from "@/lib/uploads";
import { TIME_SLOTS } from "@/content/slots";
import { useStaffPermission } from "@/lib/permissions";

export function OrderDetailPage() {
  const { idOrNumber = "" } = useParams<{ idOrNumber: string }>();
  const { data: order, isLoading, isError } = useAdminOrder(idOrNumber);
  const update = useUpdateOrder();
  const canUpdate = useStaffPermission("orders.update");
  const canReadInvoices = useStaffPermission("invoices.read");
  const canReadChallans = useStaffPermission("challans.read");
  const scheduleLocked =
    order?.status === "DELIVERED" || order?.status === "CANCELLED";

  const [adminNotes, setAdminNotes] = useState("");
  useEffect(() => {
    if (order) setAdminNotes(order.adminNotes ?? "");
  }, [order?.adminNotes]);

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
        paymentScreenshotUrl: res.publicUrl,
      });
    } catch (err) {
      setScreenshotError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setScreenshotUploading(false);
    }
  };

  if (isLoading)
    return (
      <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
    );
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
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold text-slate-900">
              {order.orderNumber}
            </h1>
            <StatusPill status={order.status} />
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
          </p>
        </div>
        <StatusChanger
          currentStatus={order.status}
          onChange={(status) => {
            if (status === "CANCELLED") {
              const ok = window.confirm(
                "Cancel this order? The customer will be emailed. You can cancel even if the kitchen has started.",
              );
              if (!ok) return;
            }
            update.mutate({ id: order.id, status });
          }}
          pending={update.isPending}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card title="Items">
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
                <li key={it.id} className="flex items-start gap-3 py-3">
                  {it.productImage ? (
                    <img
                      src={it.productImage}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400">
                      <ImageOff className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">
                      {it.productName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {[it.sizeLabel, it.flavourName]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {it.messageOnCake && (
                      <p className="text-xs italic text-slate-600">
                        Message: "{it.messageOnCake}"
                      </p>
                    )}
                    {it.instructions && (
                      <p className="text-xs text-slate-600">
                        Notes: {it.instructions}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] font-medium text-brand-700">
                      {it.deliveryDate && it.deliverySlotLabel
                        ? `${new Date(it.deliveryDate).toLocaleDateString(
                            "en-IN",
                            {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            },
                          )} · ${it.deliverySlotLabel}`
                        : "Ships pan-India via courier"}
                    </p>
                    {canUpdate && (
                      <ItemScheduleEditor
                        itemId={it.id}
                        orderId={order.id}
                        locked={scheduleLocked}
                        deliveryDate={it.deliveryDate}
                        deliverySlotKey={it.deliverySlotKey}
                        deliverySlotLabel={it.deliverySlotLabel}
                        pending={update.isPending}
                        onSave={(payload) =>
                          update.mutateAsync({
                            id: order.id,
                            items: [payload],
                          })
                        }
                      />
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-slate-500">
                      ₹{Number(it.unitPrice).toFixed(0)} × {it.qty}
                    </p>
                    <p className="font-medium tabular-nums text-slate-900">
                      ₹{Number(it.lineTotal).toFixed(2)}
                    </p>
                    {it.gstRate !== null && (
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {it.hsnCode ? `HSN ${it.hsnCode} · ` : ""}
                        GST {Number(it.gstRate)}%
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Totals">
            <div className="space-y-1 text-sm">
              {Number(order.taxableAmount) > 0 && (
                <>
                  <Row
                    label="Taxable amount"
                    value={Number(order.taxableAmount)}
                    muted
                  />
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
                label="Subtotal (incl. GST)"
                value={Number(order.subtotal)}
              />
              {isDelivery && (
                <Row label="Delivery fee" value={Number(order.deliveryFee)} />
              )}
              {Number(order.discount) > 0 && (
                <Row
                  label={
                    order.couponCode
                      ? `Discount (${order.couponCode})`
                      : "Discount"
                  }
                  value={-Number(order.discount)}
                />
              )}
              <div className="my-2 border-t-2 border-slate-900" />
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-900">
                  Total
                </span>
                <span className="text-2xl font-semibold tabular-nums text-slate-900">
                  ₹{Number(order.total).toFixed(2)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Payment: {order.paymentMethod.toUpperCase()} ·{" "}
                {order.paymentStatus}
              </p>
              {Number(order.advanceAmount) > 0 && (
                <>
                  <Row
                    label="Advance received"
                    value={Number(order.advanceAmount)}
                    muted
                  />
                  <Row
                    label="Pending"
                    value={Math.max(
                      Number(order.total) - Number(order.advanceAmount),
                      0,
                    )}
                    muted
                  />
                </>
              )}
            </div>
          </Card>

          {canReadInvoices && <InvoiceCard order={order} />}

          {/* Corporate orders need both documents: the tax invoice for the
              books and the challan to hand over with the goods. */}
          {canReadChallans && isCorporateOrder(order) && (
            <ChallanCard order={order} />
          )}

          {order.customerNotes && (
            <Card title="Customer notes">
              <p className="text-sm text-slate-700">{order.customerNotes}</p>
            </Card>
          )}

          <Card title="Admin notes" subtitle="Only visible to the kitchen">
            <textarea
              rows={3}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="e.g. Batch with tomorrow's Aditi order"
              className={textareaClass}
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              {update.isPending && (
                <span className="text-xs text-slate-500">Saving…</span>
              )}
              <button
                type="button"
                onClick={() => update.mutate({ id: order.id, adminNotes })}
                disabled={
                  update.isPending || adminNotes === (order.adminNotes ?? "")
                }
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" /> Save notes
              </button>
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title="Customer">
            <p className="font-medium text-slate-900">{order.customerName}</p>
            <a
              href={`tel:${order.customerPhone}`}
              className="mt-1 flex items-center gap-1.5 text-sm text-brand-700 hover:underline"
            >
              <Phone className="h-3.5 w-3.5" /> {order.customerPhone}
            </a>
            {order.customerEmail && (
              <a
                href={`mailto:${order.customerEmail}`}
                className="mt-1 flex items-center gap-1.5 text-sm text-brand-700 hover:underline"
              >
                <Mail className="h-3.5 w-3.5" /> {order.customerEmail}
              </a>
            )}
          </Card>

          <Card
            title={isDelivery ? "Delivery to" : "Pickup"}
            icon={
              isDelivery ? (
                <Truck className="h-4 w-4" />
              ) : (
                <Store className="h-4 w-4" />
              )
            }
          >
            {isDelivery && order.deliveryAddress ? (
              <>
                <address className="not-italic text-sm text-slate-700">
                  <p>{order.deliveryAddress.line1}</p>
                  {order.deliveryAddress.line2 && (
                    <p>{order.deliveryAddress.line2}</p>
                  )}
                  {order.deliveryAddress.landmark && (
                    <p className="text-slate-500">
                      Near {order.deliveryAddress.landmark}
                    </p>
                  )}
                  <p>
                    {[order.deliveryAddress.area, order.deliveryAddress.city]
                      .filter(Boolean)
                      .join(", ")}{" "}
                    {order.deliveryAddress.pincode}
                  </p>
                </address>
                {order.deliveryAddress.mapSearchQuery && (
                  <div className="mt-3 rounded-lg border border-brand-500/20 bg-brand-100/50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                      Search on Uber / Rapido
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-slate-900">
                      {order.deliveryAddress.mapSearchQuery}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          order.deliveryAddress!.mapSearchQuery!,
                        );
                      }}
                      className="mt-1 text-[10px] text-brand-700 hover:underline"
                    >
                      Copy to clipboard
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-700">
                Bakery HQ · Howrah 711202
              </p>
            )}
          </Card>

          <Card title="Payment">
            <p className="text-sm text-slate-900">
              {order.paymentMethod.toUpperCase()} ·{" "}
              {order.paymentMode === "ADVANCE" ? "Advance" : "Full"}
            </p>
            <div className="mt-1">
              <PaymentPill status={order.paymentStatus} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(
                [
                  "PENDING",
                  "PARTIAL",
                  "PAID",
                  "FAILED",
                  "REFUNDED",
                ] as PaymentStatus[]
              )
                .filter((s) => s !== order.paymentStatus)
                .map((s) => (
                  <button
                    key={s}
                    onClick={() =>
                      update.mutate({ id: order.id, paymentStatus: s })
                    }
                    disabled={update.isPending}
                    className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700 disabled:opacity-50"
                  >
                    Mark {s.toLowerCase()}
                  </button>
                ))}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <label className="text-xs font-medium text-slate-700">
                Advance amount
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  inputMode="decimal"
                  value={advanceInput}
                  onChange={(e) =>
                    setAdvanceInput(e.target.value.replace(/[^0-9.]/g, ""))
                  }
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
                {Math.max(
                  Number(order.total) - (Number(advanceInput) || 0),
                  0,
                ).toFixed(2)}
              </p>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <label className="text-xs font-medium text-slate-700">
                Payment screenshot
              </label>
              {order.paymentScreenshotUrl && (
                <a
                  href={order.paymentScreenshotUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block"
                >
                  <img
                    src={order.paymentScreenshotUrl}
                    alt="Payment proof"
                    className="h-32 w-32 rounded-md border border-slate-200 object-cover"
                  />
                </a>
              )}
              <input
                type="file"
                accept="image/*"
                disabled={screenshotUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadScreenshot(file);
                }}
                className="mt-2 block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
              {screenshotUploading && (
                <p className="mt-1 text-[11px] text-slate-500">Uploading…</p>
              )}
              {screenshotError && (
                <p className="mt-1 text-[11px] text-red-700">
                  {screenshotError}
                </p>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function toYmd(iso: string | null) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function slotLabelFor(key: string) {
  const known = TIME_SLOTS.find((s) => s.key === key);
  if (known) return known.label;
  if (key === "SAME_DAY") return "Same day";
  return key;
}

function SlotSelect({
  value,
  onChange,
  extraKey,
  extraLabel,
  disabled,
}: {
  value: string;
  onChange: (key: string) => void;
  extraKey?: string | null;
  extraLabel?: string | null;
  disabled?: boolean;
}) {
  const extra =
    extraKey && !TIME_SLOTS.some((s) => s.key === extraKey)
      ? { key: extraKey, label: extraLabel || extraKey }
      : null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(selectClass, "min-w-0")}
    >
      {extra && <option value={extra.key}>{extra.label}</option>}
      {TIME_SLOTS.map((s) => (
        <option key={s.key} value={s.key}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

function BulkScheduleBar({
  pending,
  onApply,
}: {
  pending: boolean;
  onApply: (
    deliveryDate: string | null,
    slotKey: string,
    slotLabel: string,
  ) => Promise<unknown>;
}) {
  const [date, setDate] = useState("");
  const [slotKey, setSlotKey] = useState<string>(TIME_SLOTS[0].key);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-medium text-slate-600">
        Set date & slot for every item
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={cn(inputClass, "w-auto")}
        />
        <SlotSelect value={slotKey} onChange={setSlotKey} disabled={pending} />
        <button
          type="button"
          disabled={pending || !date}
          onClick={async () => {
            setError(null);
            try {
              await onApply(date, slotKey, slotLabelFor(slotKey));
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not update");
            }
          }}
          className="rounded-md bg-brand-500 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Apply to all
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-brand-600">{error}</p>}
    </div>
  );
}

function ItemScheduleEditor({
  itemId,
  locked,
  deliveryDate,
  deliverySlotKey,
  deliverySlotLabel,
  pending,
  onSave,
}: {
  itemId: string;
  orderId: string;
  locked: boolean;
  deliveryDate: string | null;
  deliverySlotKey: string | null;
  deliverySlotLabel: string | null;
  pending: boolean;
  onSave: (payload: {
    id: string;
    deliveryDate: string | null;
    deliverySlotKey: string | null;
    deliverySlotLabel: string | null;
  }) => Promise<unknown>;
}) {
  const [date, setDate] = useState(toYmd(deliveryDate));
  const [slotKey, setSlotKey] = useState(
    deliverySlotKey || TIME_SLOTS[0].key,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDate(toYmd(deliveryDate));
    setSlotKey(deliverySlotKey || TIME_SLOTS[0].key);
    setError(null);
  }, [deliveryDate, deliverySlotKey]);

  const originalDate = toYmd(deliveryDate);
  const originalSlot = deliverySlotKey || "";
  const dirty =
    date !== originalDate || (date ? slotKey !== originalSlot : false);

  if (locked) return null;

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className={cn(inputClass, "w-auto py-1.5 text-xs")}
      />
      <div className="min-w-40 flex-1">
        <SlotSelect
          value={slotKey}
          onChange={setSlotKey}
          extraKey={deliverySlotKey}
          extraLabel={deliverySlotLabel}
          disabled={pending}
        />
      </div>
      <button
        type="button"
        disabled={pending || !dirty || (!!date && !slotKey)}
        onClick={async () => {
          setError(null);
          try {
            await onSave({
              id: itemId,
              deliveryDate: date || null,
              deliverySlotKey: date ? slotKey : null,
              deliverySlotLabel: date ? slotLabelFor(slotKey) : null,
            });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not update");
          }
        }}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-40"
      >
        Save date
      </button>
      {error && <p className="w-full text-xs text-brand-600">{error}</p>}
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
        Carries quantities and HSN codes only — no prices or GST. Print it,
        hand it over with the goods and have the receiver sign it.
      </p>

      {blocked ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {blocked}
        </p>
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
                  setNote(
                    r.challanNumber
                      ? `Downloaded ${r.challanNumber}`
                      : "Downloaded",
                  ),
                )
                .catch((err: unknown) =>
                  setError(
                    err instanceof Error ? err.message : "Something went wrong",
                  ),
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

function InvoiceCard({ order }: { order: AdminOrder }) {
  const download = useDownloadInvoice();
  const email = useEmailInvoice();
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            {order.placeOfSupply
              ? `${placeName ?? "Unknown"} (${order.placeOfSupply})`
              : "—"}
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
                <span className="text-slate-900">
                  {order.customerCompanyName}
                </span>
                <span className="ml-1.5 rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-800">
                  {order.customerGstin}
                </span>
              </>
            ) : (
              <span className="text-xs text-slate-400">
                Individual — no GSTIN on this order
              </span>
            )}
          </dd>
        </div>
      </dl>

      {blocked ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {blocked}
        </p>
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
            <span className="text-xs text-slate-400">
              No email on this order
            </span>
          )}
        </div>
      )}

      {note && <p className="mt-2 text-xs text-emerald-700">{note}</p>}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </Card>
  );
}

function Card({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          {icon}
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between",
        muted ? "text-xs text-slate-500" : "text-slate-700",
      )}
    >
      <span>{label}</span>
      <span className={cn("tabular-nums", !muted && "text-slate-900")}>
        ₹{value.toFixed(2)}
      </span>
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
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium",
        map[status],
      )}
    >
      {status}
    </span>
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
    currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1
      ? STATUS_FLOW[currentIdx + 1]
      : null;

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
      {currentStatus !== "CANCELLED" && (
        <button
          type="button"
          onClick={() => onChange("CANCELLED")}
          disabled={pending}
          className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Cancel order
        </button>
      )}
      <select
        value={currentStatus}
        onChange={(e) => onChange(e.target.value as OrderStatus)}
        disabled={pending}
        className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50"
      >
        {(
          [
            "PENDING",
            "CONFIRMED",
            "IN_KITCHEN",
            "READY",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
            "CANCELLED",
          ] as OrderStatus[]
        ).map((s) => (
          <option key={s} value={s}>
            Set to {s.toLowerCase().replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </div>
  );
}
