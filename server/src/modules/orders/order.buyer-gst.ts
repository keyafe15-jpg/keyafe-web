import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { logger } from "../../utils/logger.js";
import { roundMoney } from "../coupons/coupon.service.js";
import { buyerGstFields } from "../../lib/gstin.js";
import { getSellerStateCode, resolvePlaceOfSupply, type AddressLike } from "./order.tax.js";
import { getOrderById } from "./order.service.js";

export const updateBuyerGstSchema = z
  .object(buyerGstFields)
  .refine((v) => !v.customerGstin || !!v.customerCompanyName, {
    message: "Enter the registered business name for this GSTIN",
    path: ["customerCompanyName"],
  });

export type UpdateBuyerGstInput = z.infer<typeof updateBuyerGstSchema>;

type TaxSplit = { cgstAmount: number; sgstAmount: number; igstAmount: number };

/**
 * Moves GST already charged between CGST+SGST and IGST. The rate and taxable
 * value don't depend on the place of supply, so only the split changes and
 * the order total stays put.
 */
function resplit(
  amounts: { cgstAmount: unknown; sgstAmount: unknown; igstAmount: unknown },
  isIntraState: boolean,
): TaxSplit {
  const gst = roundMoney(
    Number(amounts.cgstAmount) + Number(amounts.sgstAmount) + Number(amounts.igstAmount),
  );
  if (!isIntraState) return { cgstAmount: 0, sgstAmount: 0, igstAmount: gst };
  const half = roundMoney(gst / 2);
  return { cgstAmount: half, sgstAmount: roundMoney(gst - half), igstAmount: 0 };
}

/**
 * Adds, changes or removes the buyer's GSTIN on an existing order. The GSTIN
 * decides the place of supply, so the stored tax split is recomputed with it;
 * invoices are rendered from these fields, so a re-download picks them up
 * under the same invoice number.
 */
export async function updateBuyerGst(orderId: string, input: UpdateBuyerGstInput) {
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!existing) throw HttpError.notFound("Order not found");
  if (existing.status === "CANCELLED") {
    throw HttpError.badRequest("Can't change GST details on a cancelled order.");
  }

  const customerGstin = input.customerGstin;
  const customerCompanyName = customerGstin ? input.customerCompanyName : null;

  const sellerStateCode = await getSellerStateCode();
  const placeOfSupply = resolvePlaceOfSupply({
    fulfillment: existing.fulfillment,
    deliveryAddress: existing.deliveryAddress as AddressLike | null,
    sellerStateCode,
    // Offline local orders don't always snapshot a state; every local zone is
    // in the seller's state.
    localZoneStateCode: sellerStateCode,
    buyerGstin: customerGstin,
  });
  const isIntraState = placeOfSupply === sellerStateCode;
  const previousPlaceOfSupply = existing.placeOfSupply;

  const itemSplits = existing.items.map((item) => ({
    id: item.id,
    split: resplit(item, isIntraState),
  }));
  // Order totals are the sum of the lines, matching how orders are created and
  // how the invoice foots. Legacy orders without per-line tax only have the
  // order-level amounts, so those are re-split directly.
  const hasLineTax = existing.items.every((i) => i.taxableValue !== null);
  const orderSplit = hasLineTax
    ? itemSplits.reduce<TaxSplit>(
        (acc, { split }) => ({
          cgstAmount: roundMoney(acc.cgstAmount + split.cgstAmount),
          sgstAmount: roundMoney(acc.sgstAmount + split.sgstAmount),
          igstAmount: roundMoney(acc.igstAmount + split.igstAmount),
        }),
        { cgstAmount: 0, sgstAmount: 0, igstAmount: 0 },
      )
    : resplit(existing, isIntraState);

  await prisma.$transaction(async (tx) => {
    for (const { id, split } of itemSplits) {
      await tx.orderItem.update({ where: { id }, data: split });
    }
    await tx.order.update({
      where: { id: orderId },
      data: { customerGstin, customerCompanyName, placeOfSupply, ...orderSplit },
    });
  });

  logger.info(
    {
      orderId,
      orderNumber: existing.orderNumber,
      from: existing.customerGstin,
      to: customerGstin,
      placeOfSupply: { from: previousPlaceOfSupply, to: placeOfSupply },
      invoiced: Boolean(existing.invoiceNumber),
    },
    "buyer GST details updated",
  );

  return {
    order: await getOrderById(orderId),
    placeOfSupplyChanged: previousPlaceOfSupply !== placeOfSupply,
  };
}
