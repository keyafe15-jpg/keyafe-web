import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { roundMoney } from "../coupons/coupon.service.js";
import {
  allocateCartDiscount,
  computeLineTax,
  getSellerStateCode,
  sumLineTax,
} from "./order.tax.js";
import { getOrderById } from "./order.service.js";

/** Defaults for free-form / custom lines (same as offline order-links). */
const CUSTOM_GST_RATE = 5;
const CUSTOM_GST_INCLUSIVE = true;
const CUSTOM_HSN_CODE = "1905";

/**
 * TODO(razorpay): when paymentMethod === "razorpay" and refundDue > 0,
 * call Razorpay Refunds API for `refundDue` against the original payment.
 * Until then admin refunds manually (UPI/cash) when the UI shows refund due.
 */
function notePendingRazorpayRefund(_args: {
  orderId: string;
  paymentMethod: string;
  refundDue: number;
}): void {
  // no-op stub — keeps the call site explicit for the future integration
}

export const editOrderItemsSchema = z.object({
  items: z
    .array(
      z.object({
        /** Existing OrderItem id — omit to create a new line. */
        id: z.string().min(1).optional(),
        productId: z.string().min(1).nullable().optional(),
        productName: z.string().trim().min(1),
        sizeGrams: z.coerce.number().int().positive().nullable().optional(),
        sizeLabel: z.string().trim().nullable().optional(),
        flavourId: z.string().nullable().optional(),
        flavourName: z.string().trim().nullable().optional(),
        messageOnCake: z.string().trim().max(200).nullable().optional(),
        instructions: z.string().trim().max(500).nullable().optional(),
        referenceImageUrl: z
          .union([z.string().url(), z.literal(""), z.null()])
          .optional()
          .transform((v) => (v === "" || v === undefined ? undefined : v)),
        unitPrice: z.coerce.number().nonnegative(),
        qty: z.coerce.number().int().positive(),
      }),
    )
    .min(1, "Order must have at least one item"),
  /** Optional ₹ collected now (added to advance when saving). */
  collectedNow: z.coerce.number().nonnegative().optional().default(0),
});

export type EditOrderItemsInput = z.infer<typeof editOrderItemsSchema>;

export type EditOrderItemsResult = {
  order: Awaited<ReturnType<typeof getOrderById>>;
  previousTotal: number;
  newTotal: number;
  refundDue: number;
  collectedNow: number;
};

export async function editOrderItems(
  orderId: string,
  input: EditOrderItemsInput,
): Promise<EditOrderItemsResult> {
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!existing) throw HttpError.notFound("Order not found");

  if (existing.status === "CANCELLED" || existing.status === "DELIVERED") {
    throw HttpError.badRequest("Can't edit items on a delivered or cancelled order.");
  }
  if (existing.invoiceNumber) {
    throw HttpError.badRequest(
      "This order already has an invoice number. Cancel and recreate, or adjust via credit note — item amounts can't change on an issued invoice.",
    );
  }
  if (existing.paymentStatus === "REFUNDED") {
    throw HttpError.badRequest("Can't edit items on a refunded order.");
  }

  const knownById = new Map(existing.items.map((it) => [it.id, it]));
  const seenIds = new Set<string>();
  for (const row of input.items) {
    if (!row.id) continue;
    if (!knownById.has(row.id)) {
      throw HttpError.badRequest("Item does not belong to this order");
    }
    if (seenIds.has(row.id)) {
      throw HttpError.badRequest("Duplicate item id in payload");
    }
    seenIds.add(row.id);
  }

  const scheduleFallback = existing.items.find((it) => it.deliveryDate) ?? existing.items[0];

  const catalogIds = [
    ...new Set(
      input.items
        .map((row) => {
          if (row.productId) return row.productId;
          if (row.id) return knownById.get(row.id)?.productId ?? null;
          return null;
        })
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const productMeta = new Map<
    string,
    { gstRate: number; hsnCode: string; priceIsGstInclusive: boolean; slug: string; images: string[] }
  >();
  if (catalogIds.length) {
    const products = await prisma.product.findMany({
      where: { id: { in: catalogIds } },
      select: {
        id: true,
        gstRate: true,
        hsnCode: true,
        priceIsGstInclusive: true,
        slug: true,
        images: true,
      },
    });
    for (const p of products) {
      productMeta.set(p.id, {
        gstRate: Number(p.gstRate),
        hsnCode: p.hsnCode,
        priceIsGstInclusive: p.priceIsGstInclusive,
        slug: p.slug,
        images: p.images,
      });
    }
  }

  const placeOfSupply = existing.placeOfSupply;
  if (!placeOfSupply) {
    throw HttpError.badRequest(
      "This order is missing place of supply; can't recalculate GST. Contact support or recreate the order.",
    );
  }
  const sellerCode = await getSellerStateCode();
  const isIntraState = placeOfSupply === sellerCode;

  type ResolvedLine = {
    id?: string;
    productId: string | null;
    productName: string;
    productSlug: string | null;
    productImage: string | null;
    sizeGrams: number | null;
    sizeLabel: string | null;
    flavourId: string | null;
    flavourName: string | null;
    messageOnCake: string | null;
    instructions: string | null;
    referenceImageUrl: string | null;
    deliveryDate: Date | null;
    deliverySlotKey: string | null;
    deliverySlotLabel: string | null;
    unitPrice: number;
    qty: number;
    lineTotal: number;
    gstRate: number;
    hsnCode: string;
    inclusive: boolean;
  };

  const resolved: ResolvedLine[] = input.items.map((row) => {
    const prev = row.id ? knownById.get(row.id) : undefined;
    const productId = row.productId !== undefined ? row.productId : (prev?.productId ?? null);
    const meta = productId ? productMeta.get(productId) : undefined;

    const gstRate = meta
      ? meta.gstRate
      : prev?.gstRate != null
        ? Number(prev.gstRate)
        : CUSTOM_GST_RATE;
    const hsnCode = meta?.hsnCode ?? prev?.hsnCode ?? CUSTOM_HSN_CODE;
    const inclusive = meta?.priceIsGstInclusive ?? CUSTOM_GST_INCLUSIVE;

    const unitPrice = Number(row.unitPrice);
    const qty = row.qty;
    const lineTotal = roundMoney(unitPrice * qty);

    const referenceImageUrl =
      row.referenceImageUrl !== undefined
        ? (row.referenceImageUrl ?? null)
        : (prev?.referenceImageUrl ?? null);

    return {
      id: row.id,
      productId,
      productName: row.productName,
      productSlug: meta?.slug ?? prev?.productSlug ?? null,
      productImage: referenceImageUrl ?? prev?.productImage ?? meta?.images[0] ?? null,
      sizeGrams: row.sizeGrams !== undefined ? (row.sizeGrams ?? null) : (prev?.sizeGrams ?? null),
      sizeLabel: row.sizeLabel !== undefined ? (row.sizeLabel ?? null) : (prev?.sizeLabel ?? null),
      flavourId: row.flavourId !== undefined ? (row.flavourId ?? null) : (prev?.flavourId ?? null),
      flavourName:
        row.flavourName !== undefined ? (row.flavourName ?? null) : (prev?.flavourName ?? null),
      messageOnCake:
        row.messageOnCake !== undefined
          ? (row.messageOnCake ?? null)
          : (prev?.messageOnCake ?? null),
      instructions:
        row.instructions !== undefined ? (row.instructions ?? null) : (prev?.instructions ?? null),
      referenceImageUrl,
      deliveryDate: prev?.deliveryDate ?? scheduleFallback?.deliveryDate ?? null,
      deliverySlotKey: prev?.deliverySlotKey ?? scheduleFallback?.deliverySlotKey ?? null,
      deliverySlotLabel: prev?.deliverySlotLabel ?? scheduleFallback?.deliverySlotLabel ?? null,
      unitPrice,
      qty,
      lineTotal,
      gstRate,
      hsnCode,
      inclusive,
    };
  });

  const subtotal = roundMoney(resolved.reduce((s, r) => s + r.lineTotal, 0));
  const discount = roundMoney(Number(existing.discount));
  const appliedDiscount = Math.min(discount, subtotal);
  const deliveryFee = roundMoney(Number(existing.deliveryFee));
  const newTotal = roundMoney(subtotal - appliedDiscount + deliveryFee);

  const chargedLines = allocateCartDiscount(
    resolved.map((r) => r.lineTotal),
    appliedDiscount,
  );
  const lineTaxes = resolved.map((r, idx) =>
    computeLineTax({
      lineInclusive: chargedLines[idx] ?? 0,
      gstRate: r.gstRate,
      priceIsGstInclusive: r.inclusive,
      isIntraState,
    }),
  );
  const { taxableAmount, cgstAmount, sgstAmount, igstAmount } = sumLineTax(lineTaxes);

  const previousTotal = roundMoney(Number(existing.total));
  const paidBefore = roundMoney(Number(existing.advanceAmount));
  const collectedNow = roundMoney(Math.max(0, input.collectedNow ?? 0));
  const refundDue = roundMoney(Math.max(0, paidBefore - newTotal));
  const advanceAfter = roundMoney(Math.min(Math.max(paidBefore + collectedNow, 0), newTotal));
  const paymentStatus =
    advanceAfter <= 0 ? "PENDING" : advanceAfter >= newTotal ? "PAID" : "PARTIAL";

  if (refundDue > 0) {
    notePendingRazorpayRefund({
      orderId,
      paymentMethod: existing.paymentMethod,
      refundDue,
    });
  }

  const toDelete = existing.items.filter((it) => !seenIds.has(it.id)).map((it) => it.id);

  await prisma.$transaction(async (tx) => {
    if (toDelete.length) {
      await tx.orderItem.deleteMany({ where: { id: { in: toDelete } } });
    }

    for (let i = 0; i < resolved.length; i++) {
      const r = resolved[i]!;
      const tax = lineTaxes[i]!;
      const data = {
        productId: r.productId,
        productName: r.productName,
        productSlug: r.productSlug,
        productImage: r.productImage,
        sizeGrams: r.sizeGrams,
        sizeLabel: r.sizeLabel,
        flavourId: r.flavourId,
        flavourName: r.flavourName,
        messageOnCake: r.messageOnCake,
        instructions: r.instructions,
        referenceImageUrl: r.referenceImageUrl,
        deliveryDate: r.deliveryDate,
        deliverySlotKey: r.deliverySlotKey,
        deliverySlotLabel: r.deliverySlotLabel,
        unitPrice: r.unitPrice,
        qty: r.qty,
        lineTotal: r.lineTotal,
        hsnCode: r.hsnCode,
        gstRate: r.gstRate,
        taxableValue: tax.taxableValue,
        cgstAmount: tax.cgstAmount,
        sgstAmount: tax.sgstAmount,
        igstAmount: tax.igstAmount,
      };

      if (r.id) {
        await tx.orderItem.update({ where: { id: r.id }, data });
      } else {
        await tx.orderItem.create({
          data: { orderId, ...data },
        });
      }
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        subtotal,
        discount: appliedDiscount,
        total: newTotal,
        taxableAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        advanceAmount: advanceAfter,
        paymentStatus,
        paymentMode:
          advanceAfter > 0 && advanceAfter < newTotal ? "ADVANCE" : existing.paymentMode,
      },
    });
  });

  const order = await getOrderById(orderId);
  return {
    order,
    previousTotal,
    newTotal,
    refundDue,
    collectedNow,
  };
}
