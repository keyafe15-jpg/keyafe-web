import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { logger } from "../../utils/logger.js";

// The admin retypes the order number, so a stale tab or a mis-click on the
// wrong order can't delete anything.
export const deleteOrderSchema = z.object({
  confirmOrderNumber: z.string().trim().min(1),
});

/**
 * Permanently removes an order. Items, payment attempts and the coupon
 * redemption cascade with it. Issued invoice and challan numbers are not
 * reused, so deleting an invoiced order leaves a gap in that series.
 */
export async function deleteOrder(
  orderId: string,
  confirmOrderNumber: string,
  deletedBy: { id: string; name: string } | undefined,
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { select: { productName: true, qty: true } } },
  });
  if (!order) throw HttpError.notFound("Order not found");
  if (confirmOrderNumber.toUpperCase() !== order.orderNumber.toUpperCase()) {
    throw HttpError.badRequest("The order number you typed doesn't match this order.");
  }

  await prisma.$transaction(async (tx) => {
    // Otherwise the link would still read "ordered" with nothing behind it,
    // and reopening it would let the customer place the same order again.
    await tx.orderLink.updateMany({
      where: { linkedOrderId: orderId },
      data: { status: "CANCELLED" },
    });
    await tx.order.delete({ where: { id: orderId } });
  });

  // The only trace left of the order, so it records enough to reconstruct
  // what was deleted.
  logger.warn(
    {
      orderId,
      orderNumber: order.orderNumber,
      deletedBy,
      source: order.source,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      total: order.total.toString(),
      advanceAmount: order.advanceAmount.toString(),
      invoiceNumber: order.invoiceNumber,
      challanNumber: order.challanNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerGstin: order.customerGstin,
      items: order.items.map((i) => `${i.qty} × ${i.productName}`),
    },
    "order permanently deleted",
  );

  return { orderNumber: order.orderNumber };
}
