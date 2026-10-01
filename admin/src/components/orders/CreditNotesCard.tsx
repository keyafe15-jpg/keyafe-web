import { useEffect, useRef, useState } from "react";
import { Download, ImagePlus, ReceiptText, X } from "lucide-react";
import {
  useDownloadCreditNote,
  useIssueCreditNote,
  useVoidCreditNote,
  type AdminCreditNote,
  type AdminOrder,
  type CreditNoteKind,
  type CreditNoteReason,
  type GatewayRefundStatus,
} from "@/hooks/useAdminOrders";
import { OFFLINE_PAYMENT_METHODS, paymentMethodLabel } from "@/pages/orders/order-ui";
import { inputClass, selectClass } from "@/components/form/Field";
import { ImageLightboxThumb } from "@/components/ui/ImageLightboxThumb";
import { useStaffPermission } from "@/lib/permissions";
import { uploadImage } from "@/lib/uploads";
import { cn } from "@/lib/cn";

export const CREDIT_REASON_LABEL: Record<CreditNoteReason, string> = {
  QUALITY: "Quality issue",
  DAMAGED: "Damaged",
  LATE_DELIVERY: "Late delivery",
  WRONG_ITEM: "Wrong item",
  GOODWILL: "Goodwill",
  OTHER: "Other",
};

const REASONS = Object.keys(CREDIT_REASON_LABEL) as CreditNoteReason[];

export const REFUND_STATUS: Record<GatewayRefundStatus, { label: string; className: string }> = {
  PENDING: { label: "Online refund processing", className: "text-amber-700" },
  ONHOLD: { label: "Online refund on hold", className: "text-amber-700" },
  SUCCESS: { label: "Refunded to their online payment", className: "text-emerald-700" },
  CANCELLED: {
    label: "Online refund failed — pay them back manually, then void this note",
    className: "text-red-700",
  },
};

/** "Credit note KEY-CN/26-27/0001 · Quality issue" or "Refunded · UPI". */
export function creditNoteLabel(note: AdminCreditNote): string {
  return note.kind === "REFUND"
    ? `Refunded${note.refundMethod ? ` · ${paymentMethodLabel(note.refundMethod)}` : ""}`
    : `Discount after bill · ${CREDIT_REASON_LABEL[note.reason]}`;
}

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

const rupees = (n: number) => `₹${n.toFixed(2)}`;

/** GST inside an amount, using the invoice's own tax-to-total ratio. */
function gstShare(order: AdminOrder, amount: number): number {
  const gst = Number(order.cgstAmount) + Number(order.sgstAmount) + Number(order.igstAmount);
  const total = Number(order.total);
  return total > 0 ? Math.round(((amount * gst) / total) * 100) / 100 : 0;
}

export function canAddCreditNote(order: AdminOrder) {
  return (
    Boolean(order.invoiceNumber) &&
    order.status !== "CANCELLED" &&
    order.paymentStatus !== "REFUNDED" &&
    (order.money.maxDiscount > 0 || order.money.maxRefund > 0)
  );
}

export function CreditNotesCard({
  order,
  openRequest = 0,
}: {
  order: AdminOrder;
  /** Bumped by buttons elsewhere on the page to scroll here and open the form. */
  openRequest?: number;
}) {
  const canAdjust = useStaffPermission("orders.adjust");
  const canDownload = useStaffPermission("invoices.read");
  const notes = order.creditNotes ?? [];
  const [adding, setAdding] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const canAdd = canAdjust && canAddCreditNote(order);

  useEffect(() => {
    if (openRequest === 0) return;
    if (canAdd) setAdding(true);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [openRequest, canAdd]);

  return (
    <section ref={sectionRef} className="scroll-mt-4 rounded-card border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <ReceiptText className="h-4 w-4 text-slate-400" />
          Discounts &amp; refunds after billing
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {order.invoiceNumber
            ? `Charged less or paid money back? Record it here with the reason. Each one is a GST credit note against ${order.invoiceNumber}, so GST is paid on the reduced amount.`
            : "This order has no bill yet, so change the price with Edit items instead. Once the tax invoice is issued, discounts and refunds are recorded here with a reason."}
        </p>
      </div>
      <div className="space-y-3 p-4">
        {order.invoiceNumber && notes.length === 0 && !adding && (
          <p className="text-xs text-slate-400">None on this order.</p>
        )}
        {order.invoiceNumber && !canAdjust && (
          <p className="text-xs text-slate-400">
            Your role doesn't have permission to give discounts or refunds after billing.
          </p>
        )}
        {notes.map((note) => (
          <CreditNoteRow
            key={note.id}
            order={order}
            note={note}
            canAdjust={canAdjust}
            canDownload={canDownload}
          />
        ))}

        {adding ? (
          <IssueForm order={order} onDone={() => setAdding(false)} />
        ) : (
          canAdd && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="border-brand-300 hover:bg-brand-50 rounded-md border bg-white px-3 py-1.5 text-xs font-medium text-brand-700"
            >
              Give discount or refund
            </button>
          )
        )}
      </div>
    </section>
  );
}

function CreditNoteRow({
  order,
  note,
  canAdjust,
  canDownload,
}: {
  order: AdminOrder;
  note: AdminCreditNote;
  canAdjust: boolean;
  canDownload: boolean;
}) {
  const download = useDownloadCreditNote();
  const voidNote = useVoidCreditNote();
  const [error, setError] = useState<string | null>(null);
  const gst = Number(note.cgstAmount) + Number(note.sgstAmount) + Number(note.igstAmount);
  const voided = Boolean(note.voidedAt);
  const refund = note.gatewayRefund;

  const onVoid = async () => {
    const reason = window.prompt(
      `Void credit note ${note.creditNoteNumber}? Its number stays used. Say why:`,
    );
    if (!reason?.trim()) return;
    setError(null);
    try {
      await voidNote.mutateAsync({ order, id: note.id, reason: reason.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not void it");
    }
  };

  return (
    <div
      className={cn("rounded-lg border border-slate-200 p-3", voided && "bg-slate-50 opacity-70")}
    >
      <div className="flex items-start gap-3">
        {note.proofUrl && (
          <ImageLightboxThumb src={note.proofUrl} alt="Refund proof" className="h-10 w-10" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-slate-900">
              {note.kind === "REFUND" ? "Refund" : "Discount"}{" "}
              <span className={cn("tabular-nums", voided && "line-through")}>
                {rupees(Number(note.amount))}
              </span>
              {voided && (
                <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
                  Void
                </span>
              )}
            </p>
            <span className="font-mono text-[11px] text-slate-500">{note.creditNoteNumber}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-600">
            {CREDIT_REASON_LABEL[note.reason]}
            {note.note ? ` — ${note.note}` : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            GST {rupees(gst)}
            {note.refundMethod === "online"
              ? " · back to their online payment"
              : note.refundMethod
                ? ` · paid back by ${paymentMethodLabel(note.refundMethod)}`
                : ""}
            {" · "}
            {formatDay(note.creditNoteDate)}
            {note.createdByName ? ` · by ${note.createdByName}` : ""}
          </p>
          {refund && !voided && (
            <p className={cn("mt-0.5 text-[11px]", REFUND_STATUS[refund.status].className)}>
              {REFUND_STATUS[refund.status].label}
            </p>
          )}
          {voided && (
            <p className="mt-0.5 text-[11px] text-red-700">
              Voided {formatDay(note.voidedAt!)}
              {note.voidReason ? `: ${note.voidReason}` : ""}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {canDownload && (
              <button
                type="button"
                disabled={download.isPending}
                onClick={() =>
                  download
                    .mutateAsync({ orderId: order.id, note })
                    .catch((err) =>
                      setError(err instanceof Error ? err.message : "Download failed"),
                    )
                }
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="h-3 w-3" />
                {download.isPending ? "Preparing…" : "Credit note PDF"}
              </button>
            )}
            {canAdjust && !voided && (!refund || refund.status === "CANCELLED") && (
              <button
                type="button"
                disabled={voidNote.isPending}
                onClick={() => void onVoid()}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Void
              </button>
            )}
          </div>
          {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function IssueForm({ order, onDone }: { order: AdminOrder; onDone: () => void }) {
  const issue = useIssueCreditNote();
  const { maxDiscount, maxRefund } = order.money;
  const onlineMax = Math.min(order.money.onlineRefundable ?? 0, maxRefund);
  const paidOnline = order.paymentMethod === "cashfree" && onlineMax > 0;
  const [kind, setKind] = useState<CreditNoteKind>(maxDiscount > 0 ? "DISCOUNT" : "REFUND");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<CreditNoteReason>("QUALITY");
  const [note, setNote] = useState("");
  const [refundMethod, setRefundMethod] = useState<string>(paidOnline ? "online" : "upi");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const online = kind === "REFUND" && refundMethod === "online";
  const max = kind === "REFUND" ? (online ? onlineMax : maxRefund) : maxDiscount;
  const value = Number(amount);
  const amountOk = value > 0 && value <= max;
  const noteOk = reason !== "OTHER" || note.trim().length > 0;
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!proofFile) {
      setProofPreview(null);
      return;
    }
    const url = URL.createObjectURL(proofFile);
    setProofPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [proofFile]);

  const submit = async () => {
    if (
      online &&
      !window.confirm(
        `Send ${rupees(value)} back to the customer's online payment now? This can't be undone.`,
      )
    ) {
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const proofUrl =
        kind === "REFUND" && !online && proofFile
          ? (await uploadImage(proofFile, "payment-screenshot")).publicUrl
          : null;
      await issue.mutateAsync({
        order,
        payload: {
          kind,
          amount: value,
          reason,
          note: note.trim() || null,
          refundMethod: kind === "REFUND" ? refundMethod : null,
          proofUrl,
        },
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const kindButton = (k: CreditNoteKind, label: string, hint: string, disabled: boolean) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setKind(k)}
      className={cn(
        "flex-1 rounded-md border px-3 py-2 text-left text-xs transition disabled:opacity-40",
        kind === k
          ? "bg-brand-50 text-brand-800 border-brand-500"
          : "border-slate-200 text-slate-700 hover:border-slate-300",
      )}
    >
      <span className="block font-medium">{label}</span>
      <span className="block text-[11px] text-slate-500">{hint}</span>
    </button>
  );

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <div className="flex gap-2">
        {kindButton(
          "DISCOUNT",
          "Charged less",
          `Up to ${rupees(maxDiscount)} still owed`,
          maxDiscount <= 0,
        )}
        {kindButton("REFUND", "Refunded", `Up to ${rupees(maxRefund)} received`, maxRefund <= 0)}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Amount (incl. GST)</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="500"
            autoFocus
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Reason</span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as CreditNoteReason)}
            className={selectClass}
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {CREDIT_REASON_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {value > max && (
        <p className="-mt-1 text-xs text-red-700">Can't be more than {rupees(max)}.</p>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">
          Note{reason === "OTHER" ? "" : " (optional)"}
        </span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="e.g. Cream had melted on delivery"
          className={inputClass}
        />
      </label>

      {kind === "REFUND" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Paid back by</span>
            <select
              value={refundMethod}
              onChange={(e) => setRefundMethod(e.target.value)}
              className={selectClass}
            >
              {paidOnline && <option value="online">Back to their online payment</option>}
              {OFFLINE_PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          {online ? (
            <p className="self-end text-[11px] text-slate-500">
              Sent automatically when you save, up to {rupees(onlineMax)}. It can take a few days to
              reach the customer.
            </p>
          ) : (
            <div>
              <span className="mb-1 block text-xs font-medium text-slate-600">
                Proof (optional)
              </span>
              {proofPreview ? (
                <div className="flex items-center gap-2">
                  <img src={proofPreview} alt="" className="h-9 w-9 rounded object-cover" />
                  <button
                    type="button"
                    onClick={() => setProofFile(null)}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove proof"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-slate-300 px-2 text-xs text-slate-500 hover:border-brand-500">
                  <ImagePlus className="h-4 w-4" />
                  Screenshot
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                    onChange={(e) => {
                      setProofFile(e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                    className="sr-only"
                  />
                </label>
              )}
            </div>
          )}
        </div>
      )}

      {amountOk && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Credit note of {rupees(value)} (GST about {rupees(gstShare(order, value))}) against{" "}
          {order.invoiceNumber}. The invoice stays as it is.
          {online && ` ${rupees(value)} goes back to the customer's online payment.`}
        </p>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!amountOk || !noteOk || saving}
          onClick={() => void submit()}
          className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : online ? "Refund and issue credit note" : "Issue credit note"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
