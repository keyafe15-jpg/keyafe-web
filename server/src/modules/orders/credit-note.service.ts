import { z } from "zod";
import type { CreditNote, CreditNoteKind, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { roundMoney } from "../coupons/coupon.service.js";
import { OFFLINE_PAYMENT_METHODS, paymentMethodLabel } from "../../lib/paymentLabel.js";
import {
  amountInWords,
  buildInvoiceData,
  financialYearLabel,
  getSellerSettings,
  invoiceFileName,
} from "./invoice.service.js";
import { renderCreditNotePdf } from "./credit-note.pdf.js";
import {
  keepRefundAfterFailure,
  refundRecord,
  sendOnlineRefund,
} from "../payments/refund.service.js";

export const CREDIT_NOTE_REASONS = [
  "QUALITY",
  "DAMAGED",
  "LATE_DELIVERY",
  "WRONG_ITEM",
  "GOODWILL",
  "OTHER",
] as const;

export const CREDIT_NOTE_REASON_LABEL: Record<(typeof CREDIT_NOTE_REASONS)[number], string> = {
  QUALITY: "Quality issue",
  DAMAGED: "Damaged",
  LATE_DELIVERY: "Late delivery",
  WRONG_ITEM: "Wrong item",
  GOODWILL: "Goodwill",
  OTHER: "Other",
};

export const issueCreditNoteSchema = z
  .object({
    kind: z.enum(["DISCOUNT", "REFUND"]),
    amount: z.coerce.number().positive("Enter an amount"),
    reason: z.enum(CREDIT_NOTE_REASONS),
    note: z.string().trim().max(500).optional().nullable(),
    // "online" sends the money back to the customer's online payment.
    refundMethod: z
      .enum([...OFFLINE_PAYMENT_METHODS, "online"])
      .optional()
      .nullable(),
    proofUrl: z.string().url().optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.reason === "OTHER" && !v.note?.trim()) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "Add a note for the reason" });
    }
    if (v.kind === "REFUND" && !v.refundMethod) {
      ctx.addIssue({
        code: "custom",
        path: ["refundMethod"],
        message: "Choose how the refund was paid",
      });
    }
  });

export type IssueCreditNoteInput = z.infer<typeof issueCreditNoteSchema>;

export const voidCreditNoteSchema = z.object({
  reason: z.string().trim().min(3, "Say why it's being voided").max(300),
});

export interface CreditNoteLine {
  description: string;
  hsnCode: string | null;
  gstRate: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  total: number;
  /** Untaxed delivery share; kept out of the HSN summary. */
  isDelivery?: boolean;
}

type MoneyOrder = {
  total: unknown;
  advanceAmount: unknown;
  paymentStatus: PaymentStatus;
};
type MoneyNote = { kind: CreditNoteKind; amount: unknown; voidedAt: Date | null };

/**
 * What the order is worth after credit notes, and how much of it is in hand.
 * A discount lowers what is owed; a refund hands back money already received.
 */
export function orderMoney(order: MoneyOrder, notes: MoneyNote[]) {
  const total = Number(order.total);
  let discounts = 0;
  let refunds = 0;
  for (const n of notes) {
    if (n.voidedAt) continue;
    if (n.kind === "REFUND") refunds += Number(n.amount);
    else discounts += Number(n.amount);
  }
  const netTotal = roundMoney(Math.max(0, total - discounts - refunds));
  const received =
    order.paymentStatus === "PAID"
      ? netTotal
      : roundMoney(
          Math.max(0, Math.min(Math.max(Number(order.advanceAmount), 0), total) - refunds),
        );
  return {
    discounts: roundMoney(discounts),
    refunds: roundMoney(refunds),
    netTotal,
    received,
    pending: roundMoney(Math.max(0, netTotal - received)),
  };
}

/**
 * Spreads `amount` (GST included) over the invoice lines in proportion to what
 * each line charged, keeping each line's own taxable/CGST/SGST/IGST mix.
 */
export function splitCreditAmount(
  amount: number,
  lines: Omit<CreditNoteLine, "total">[],
): CreditNoteLine[] {
  const gross = lines.map((l) => l.taxableValue + l.cgstAmount + l.sgstAmount + l.igstAmount);
  const grossSum = gross.reduce((s, g) => s + g, 0);
  if (grossSum <= 0) throw HttpError.badRequest("This invoice has no amount to credit");

  const out: CreditNoteLine[] = [];
  let left = roundMoney(amount);
  lines.forEach((line, i) => {
    if (gross[i]! <= 0) return;
    const isLast = gross.slice(i + 1).every((g) => g <= 0);
    const share = isLast ? left : roundMoney((amount * gross[i]!) / grossSum);
    left = roundMoney(left - share);
    const part = (v: number) => roundMoney((share * v) / gross[i]!);
    const cgstAmount = part(line.cgstAmount);
    const sgstAmount = part(line.sgstAmount);
    const igstAmount = part(line.igstAmount);
    out.push({
      description: line.description,
      hsnCode: line.hsnCode,
      gstRate: line.gstRate,
      taxableValue: roundMoney(share - cgstAmount - sgstAmount - igstAmount),
      cgstAmount,
      sgstAmount,
      igstAmount,
      total: share,
      ...(line.isDelivery ? { isDelivery: true } : {}),
    });
  });
  return out;
}

async function loadOrderForCredit(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      creditNotes: { select: { id: true, kind: true, amount: true, voidedAt: true } },
    },
  });
  if (!order) throw HttpError.notFound("Order not found");
  return order;
}

/**
 * A discount can only come off what is still owed; once the money is in hand,
 * giving some back is a refund.
 */
export function creditLimits(order: MoneyOrder, notes: MoneyNote[]) {
  const money = orderMoney(order, notes);
  return {
    maxDiscount: money.pending,
    maxRefund: Math.min(money.netTotal, money.received),
  };
}

export async function issueCreditNote(
  orderId: string,
  input: IssueCreditNoteInput,
  staff?: { name: string | null } | null,
): Promise<CreditNote> {
  const order = await loadOrderForCredit(orderId);
  if (!order.invoiceNumber || !order.invoiceDate) {
    throw HttpError.badRequest(
      "This order has no invoice yet. Edit the items or discount instead of issuing a credit note.",
    );
  }
  if (order.status === "CANCELLED") {
    throw HttpError.badRequest("This order is cancelled.");
  }
  if (order.paymentStatus === "REFUNDED") {
    throw HttpError.badRequest("This order is already fully refunded.");
  }

  const amount = roundMoney(input.amount);
  const { maxDiscount, maxRefund } = creditLimits(order, order.creditNotes);
  if (input.kind === "DISCOUNT" && amount > maxDiscount) {
    throw HttpError.badRequest(
      maxDiscount > 0
        ? `Only ₹${maxDiscount.toFixed(2)} is still owed, so the discount can't be more than that. Record the rest as a refund.`
        : "Nothing is owed on this order, so record it as a refund.",
    );
  }
  if (input.kind === "REFUND" && amount > maxRefund) {
    throw HttpError.badRequest(
      maxRefund > 0
        ? `Only ₹${maxRefund.toFixed(2)} has been received, so the refund can't be more than that.`
        : "No money has been received on this order, so record it as a discount.",
    );
  }
  const refundOnline = input.kind === "REFUND" && input.refundMethod === "online";
  if (refundOnline && order.paymentMethod !== "cashfree") {
    throw HttpError.badRequest("This order wasn't paid online. Refund the customer manually.");
  }

  const invoice = await buildInvoiceData(order, {
    invoiceNumber: order.invoiceNumber,
    invoiceDate: order.invoiceDate,
  });
  const baseLines: Omit<CreditNoteLine, "total">[] = invoice.isLegacyOrder
    ? [
        {
          description: `As per invoice ${order.invoiceNumber}`,
          hsnCode: null,
          gstRate:
            invoice.taxableTotal > 0
              ? roundMoney(
                  ((invoice.cgstTotal + invoice.sgstTotal + invoice.igstTotal) * 100) /
                    invoice.taxableTotal,
                )
              : 0,
          taxableValue: invoice.taxableTotal,
          cgstAmount: invoice.cgstTotal,
          sgstAmount: invoice.sgstTotal,
          igstAmount: invoice.igstTotal,
        },
      ]
    : invoice.lines.map((l) => ({
        description: l.description,
        hsnCode: l.hsnCode,
        gstRate: l.gstRate,
        taxableValue: l.taxableValue,
        cgstAmount: l.cgstAmount,
        sgstAmount: l.sgstAmount,
        igstAmount: l.igstAmount,
      }));
  if (invoice.deliveryFee > 0) {
    baseLines.push({
      description: "Delivery charges",
      hsnCode: null,
      gstRate: 0,
      taxableValue: invoice.deliveryFee,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      isDelivery: true,
    });
  }
  const lines = splitCreditAmount(amount, baseLines);
  const sum = (key: "taxableValue" | "cgstAmount" | "sgstAmount" | "igstAmount") =>
    roundMoney(lines.reduce((s, l) => s + l[key], 0));

  const settings = await getSellerSettings();
  const creditNoteDate = new Date();
  const series = `${settings.invoicePrefix}-CN/${financialYearLabel(creditNoteDate, settings.fyStartMonth)}`;

  const after = orderMoney(order, [
    ...order.creditNotes,
    { kind: input.kind, amount, voidedAt: null },
  ]);
  const settles =
    after.pending <= 0 && (order.paymentStatus === "PENDING" || order.paymentStatus === "PARTIAL");

  // The gateway call goes first: if it fails, no credit note number is used up.
  const sent = refundOnline
    ? await sendOnlineRefund(
        orderId,
        amount,
        `Keyafe order ${order.orderNumber}: ${CREDIT_NOTE_REASON_LABEL[input.reason]}`,
      )
    : null;

  const save = () =>
    prisma.$transaction(async (tx) => {
      const counter = await tx.invoiceCounter.upsert({
        where: { series },
        create: { series, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
        select: { lastNumber: true },
      });
      const note = await tx.creditNote.create({
        data: {
          orderId,
          creditNoteNumber: `${series}/${String(counter.lastNumber).padStart(4, "0")}`,
          creditNoteDate,
          kind: input.kind,
          reason: input.reason,
          note: input.note?.trim() || null,
          amount,
          taxableAmount: sum("taxableValue"),
          cgstAmount: sum("cgstAmount"),
          sgstAmount: sum("sgstAmount"),
          igstAmount: sum("igstAmount"),
          lines: lines as unknown as Prisma.InputJsonArray,
          refundMethod: input.kind === "REFUND" ? (input.refundMethod ?? null) : null,
          proofUrl: input.proofUrl ?? null,
          createdByName: staff?.name ?? null,
        },
      });
      if (sent) {
        await tx.gatewayRefund.create({
          data: refundRecord(sent, { creditNoteId: note.id, createdByName: staff?.name }),
        });
      }
      if (settles) {
        await tx.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID" } });
      }
      return note;
    });

  if (!sent) return save();
  try {
    return await save();
  } catch (err) {
    return keepRefundAfterFailure(sent, err);
  }
}

export async function buildCreditNotePdf(
  orderId: string,
  creditNoteId: string,
): Promise<{ pdf: Buffer; filename: string }> {
  const note = await prisma.creditNote.findFirst({ where: { id: creditNoteId, orderId } });
  if (!note) throw HttpError.notFound("Credit note not found");
  const order = await loadOrderForCredit(orderId);
  if (!order.invoiceNumber || !order.invoiceDate) {
    throw HttpError.badRequest("This order has no invoice.");
  }
  const invoice = await buildInvoiceData(order, {
    invoiceNumber: order.invoiceNumber,
    invoiceDate: order.invoiceDate,
  });
  const amount = Number(note.amount);
  const pdf = await renderCreditNotePdf({
    creditNoteNumber: note.creditNoteNumber,
    creditNoteDate: note.creditNoteDate,
    invoiceNumber: order.invoiceNumber,
    invoiceDate: order.invoiceDate,
    orderNumber: order.orderNumber,
    seller: invoice.seller,
    buyer: invoice.buyer,
    placeOfSupply: invoice.placeOfSupply,
    isIntraState: invoice.isIntraState,
    kindLabel:
      note.kind === "REFUND"
        ? `Refund${note.refundMethod ? ` (${paymentMethodLabel(note.refundMethod)})` : ""}`
        : "Discount after billing",
    reasonLabel: CREDIT_NOTE_REASON_LABEL[note.reason],
    note: note.note,
    lines: note.lines as unknown as CreditNoteLine[],
    taxableTotal: Number(note.taxableAmount),
    cgstTotal: Number(note.cgstAmount),
    sgstTotal: Number(note.sgstAmount),
    igstTotal: Number(note.igstAmount),
    amount,
    amountInWords: amountInWords(amount),
    voided: note.voidedAt ? { at: note.voidedAt, reason: note.voidReason } : null,
  });
  return { pdf, filename: invoiceFileName(note.creditNoteNumber) };
}

export async function voidCreditNote(orderId: string, creditNoteId: string, reason: string) {
  const note = await prisma.creditNote.findFirst({
    where: { id: creditNoteId, orderId },
    include: { gatewayRefund: { select: { status: true } } },
  });
  if (!note) throw HttpError.notFound("Credit note not found");
  if (note.voidedAt) throw HttpError.badRequest("This credit note is already void.");
  if (note.gatewayRefund && note.gatewayRefund.status !== "CANCELLED") {
    throw HttpError.badRequest(
      "This money was already sent back to the customer's online payment, so the credit note can't be voided.",
    );
  }
  const order = await loadOrderForCredit(orderId);

  // Issuing a discount can flip PENDING/PARTIAL to PAID without touching the
  // advance (marking paid by hand sets advance = total), so undo that here.
  let reopenAs: PaymentStatus | null = null;
  const advance = Number(order.advanceAmount);
  if (note.kind === "DISCOUNT" && order.paymentStatus === "PAID" && advance < Number(order.total)) {
    const fallback: PaymentStatus = advance > 0 ? "PARTIAL" : "PENDING";
    const after = orderMoney(
      { ...order, paymentStatus: fallback },
      order.creditNotes.filter((n) => n.id !== note.id),
    );
    if (after.pending > 0) reopenAs = fallback;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.creditNote.update({
      where: { id: note.id },
      data: { voidedAt: new Date(), voidReason: reason },
    });
    if (reopenAs) {
      await tx.order.update({ where: { id: orderId }, data: { paymentStatus: reopenAs } });
    }
    return updated;
  });
}
