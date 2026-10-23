import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { roundMoney } from "../coupons/coupon.service.js";
import {
  allocateCartDiscount,
  computeLineTax,
  getSellerStateCode,
  gstAddedOnTop,
  sumLineTax,
} from "./order.tax.js";
import { getOrderById } from "./order.service.js";
import { adjustCashLineForAdvance } from "./order-payments.js";
import { cashfreeEnabled } from "../payments/cashfree.client.js";
import {
  keepRefundAfterFailure,
  onlineRefundable,
  refundRecord,
  sendOnlineRefund,
  type SentRefund,
} from "../payments/refund.service.js";
import { MAX_REFERENCE_IMAGES, syncReferenceImages } from "../../lib/referenceImages.js";

/** Defaults for free-form / custom lines (same as offline order-links). */
const CUSTOM_GST_RATE = 5;
const CUSTOM_GST_INCLUSIVE = true;
const CUSTOM_HSN_CODE = "1905";

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
        description: z.string().trim().max(1000).nullable().optional(),
        referenceImageUrl: z
          .union([z.string().url(), z.literal(""), z.null()])
          .optional()
          .transform((v) => (v === "" || v === undefined ? undefined : v)),
        referenceImageUrls: z.array(z.string().url()).max(MAX_REFERENCE_IMAGES).optional(),
        unitPrice: z.coerce.number().nonnegative(),
        qty: z.coerce.number().int().positive(),
      }),
    )
    .min(1, "Order must have at least one item"),
  /** Optional ₹ collected now (added to advance when saving). */
  collectedNow: z.coerce.number().nonnegative().optional().default(0),
  /** Who collects the delivery charge; omit to keep the order's current choice. */
  deliveryPaidToRider: z.boolean().optional(),
  /** Noted delivery charge (even when the customer pays the rider). */
  deliveryFee: z.coerce.number().nonnegative().optional(),
});

export type EditOrderItemsInput = z.infer<typeof editOrderItemsSchema>;

export type EditOrderItemsResult = {
  order: Awaited<ReturnType<typeof getOrderById>>;
  previousTotal: number;
  newTotal: number;
  /** Still to be paid back by hand. */
  refundDue: number;
  /** Sent back to the customer's online payment while saving. */
  refundedOnline: number;
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
    {
      gstRate: number;
      hsnCode: string;
      priceIsGstInclusive: boolean;
      slug: string;
      images: string[];
    }
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
    description: string | null;
    referenceImageUrl: string | null;
    referenceImageUrls: string[];
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

    const images =
      row.referenceImageUrls !== undefined || row.referenceImageUrl !== undefined
        ? syncReferenceImages(row.referenceImageUrls, row.referenceImageUrl ?? null)
        : syncReferenceImages(prev?.referenceImageUrls, prev?.referenceImageUrl ?? null);

    return {
      id: row.id,
      productId,
      productName: row.productName,
      productSlug: meta?.slug ?? prev?.productSlug ?? null,
      productImage: images.referenceImageUrl ?? prev?.productImage ?? meta?.images[0] ?? null,
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
      description:
        row.description !== undefined ? row.description || null : (prev?.description ?? null),
      referenceImageUrl: images.referenceImageUrl,
      referenceImageUrls: images.referenceImageUrls,
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
  const notedDeliveryFee =
    existing.fulfillment === "DELIVERY"
      ? roundMoney(input.deliveryFee ?? Number(existing.deliveryFee))
      : 0;
  const deliveryPaidToRider =
    notedDeliveryFee > 0 && (input.deliveryPaidToRider ?? existing.deliveryPaidToRider);
  const deliveryFee = deliveryPaidToRider ? 0 : notedDeliveryFee;
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
  const gstOnTop = gstAddedOnTop(
    lineTaxes,
    resolved.map((r) => r.inclusive),
  );
  const newTotal = roundMoney(subtotal - appliedDiscount + deliveryFee + gstOnTop);

  const previousTotal = roundMoney(Number(existing.total));
  const paidBefore = roundMoney(Number(existing.advanceAmount));
  const collectedNow = roundMoney(Math.max(0, input.collectedNow ?? 0));
  const refundDue = roundMoney(Math.max(0, paidBefore - newTotal));
  const advanceAfter = roundMoney(Math.min(Math.max(paidBefore + collectedNow, 0), newTotal));
  const paymentStatus =
    advanceAfter <= 0 ? "PENDING" : advanceAfter >= newTotal ? "PAID" : "PARTIAL";

  // Paid online: the overpayment goes back to that payment. Anything beyond
  // what was paid online (e.g. cash collected later) is refunded by hand.
  let sent: SentRefund | null = null;
  if (refundDue > 0 && existing.paymentMethod === "cashfree" && cashfreeEnabled()) {
    const online = Math.min(refundDue, await onlineRefundable(orderId));
    if (online > 0) {
      sent = await sendOnlineRefund(
        orderId,
        online,
        `Keyafe order ${existing.orderNumber}: items changed`,
      );
    }
  }
  const refundedOnline = sent?.amount ?? 0;

  const toDelete = existing.items.filter((it) => !seenIds.has(it.id)).map((it) => it.id);

  const save = () =>
    prisma.$transaction(async (tx) => {
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
          description: r.description,
          referenceImageUrl: r.referenceImageUrl,
          referenceImageUrls: r.referenceImageUrls,
          deliveryDate: r.deliveryDate,
          deliverySlotKey: r.deliverySlotKey,
          deliverySlotLabel: r.deliverySlotLabel,
          unitPrice: r.unitPrice,
          qty: r.qty,
          lineTotal: r.lineTotal,
          sortOrder: i,
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
          deliveryFee: notedDeliveryFee,
          deliveryPaidToRider,
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
      if (existing.paymentMethod !== "cashfree") {
        await adjustCashLineForAdvance(tx, orderId, advanceAfter, newTotal);
      }
      if (sent) await tx.gatewayRefund.create({ data: refundRecord(sent) });
    });

  if (sent) {
    try {
      await save();
    } catch (err) {
      await keepRefundAfterFailure(sent, err);
    }
  } else {
    await save();
  }

  const order = await getOrderById(orderId);
  return {
    order,
    previousTotal,
    newTotal,
    refundDue: roundMoney(refundDue - refundedOnline),
    refundedOnline,
    collectedNow,
  };
}

export const reorderOrderItemsSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1),
});

export async function reorderOrderItems(orderId: string, itemIds: string[]) {
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { select: { id: true } } },
  });
  if (!existing) throw HttpError.notFound("Order not found");
  if (existing.status === "CANCELLED" || existing.status === "DELIVERED") {
    throw HttpError.badRequest("Can't reorder items on a delivered or cancelled order.");
  }

  const known = new Set(existing.items.map((it) => it.id));
  const unique = [...new Set(itemIds)];
  if (unique.length !== itemIds.length || unique.some((id) => !known.has(id))) {
    throw HttpError.badRequest("Item order doesn't match this order.");
  }

  const leftover = existing.items.map((it) => it.id).filter((id) => !unique.includes(id));
  const ordered = [...unique, ...leftover];

  await prisma.$transaction(
    ordered.map((id, sortOrder) => prisma.orderItem.update({ where: { id }, data: { sortOrder } })),
  );

  return getOrderById(orderId);
}
