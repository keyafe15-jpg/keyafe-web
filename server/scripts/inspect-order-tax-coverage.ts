// Read-only: reports which orders have per-line tax captured and which don't,
// so invoice gaps can be traced to the data rather than the renderer.
//
// Run: ./node_modules/.bin/tsx scripts/inspect-order-tax-coverage.ts
import { prisma } from "../src/config/db.js";

async function main() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      orderNumber: true,
      createdAt: true,
      customerGstin: true,
      taxableAmount: true,
      cgstAmount: true,
      sgstAmount: true,
      igstAmount: true,
      placeOfSupply: true,
      total: true,
      items: {
        select: { productName: true, taxableValue: true, gstRate: true, hsnCode: true },
      },
    },
  });

  const totalOrders = await prisma.order.count();
  const missingLineTax = await prisma.order.count({
    where: { items: { some: { taxableValue: null } } },
  });
  const zeroOrderGst = await prisma.order.count({
    where: { cgstAmount: 0, sgstAmount: 0, igstAmount: 0 },
  });

  console.log(`Orders total: ${totalOrders}`);
  console.log(`  with at least one line missing taxableValue: ${missingLineTax}`);
  console.log(`  with zero GST at the order level: ${zeroOrderGst}`);
  console.log("\nMost recent 15 orders:\n");
  console.log(
    "order            created     b2b  POS  orderGST   lineTax?  gstRate  hsn",
  );

  for (const o of orders) {
    const orderGst =
      Number(o.cgstAmount) + Number(o.sgstAmount) + Number(o.igstAmount);
    const anyNull = o.items.some((i) => i.taxableValue === null);
    const rates = [...new Set(o.items.map((i) => String(i.gstRate)))].join(",");
    const hsns = [...new Set(o.items.map((i) => i.hsnCode ?? "null"))].join(",");
    console.log(
      `${o.orderNumber.padEnd(17)}${o.createdAt.toISOString().slice(0, 10)}  ` +
        `${(o.customerGstin ? "yes" : "no ").padEnd(4)} ` +
        `${(o.placeOfSupply ?? "--").padEnd(4)} ` +
        `${orderGst.toFixed(2).padStart(8)}   ` +
        `${(anyNull ? "MISSING" : "present").padEnd(9)} ` +
        `${rates.padEnd(8)} ${hsns}`,
    );
  }
}

/**
 * B2B orders and how their tax was split. The buyer's GSTIN state is shown
 * beside the place of supply and the delivery state, which is what makes an
 * order taxed under the old delivery-address rule obvious at a glance.
 */
async function b2bReport() {
  const orders = await prisma.order.findMany({
    where: { customerGstin: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      orderNumber: true,
      createdAt: true,
      source: true,
      fulfillment: true,
      customerGstin: true,
      customerCompanyName: true,
      placeOfSupply: true,
      deliveryAddress: true,
      cgstAmount: true,
      sgstAmount: true,
      igstAmount: true,
      items: { select: { productName: true } },
    },
  });

  if (orders.length === 0) {
    console.log("\nNo orders with a buyer GSTIN yet.");
    return;
  }

  console.log("\n=== Orders billed to a GSTIN ===");
  for (const o of orders) {
    const addr = o.deliveryAddress as {
      state?: string;
      stateCode?: string;
      pincode?: string;
      city?: string;
    } | null;
    const gstinState = o.customerGstin?.slice(0, 2);
    const tax =
      Number(o.igstAmount) > 0
        ? "IGST"
        : Number(o.cgstAmount) > 0
          ? "CGST+SGST"
          : "no GST";

    console.log(`\n${o.orderNumber}  ${o.createdAt.toISOString().slice(0, 16)}  (${o.source})`);
    console.log(`  buyer GSTIN state : ${gstinState}  [${o.customerGstin}]`);
    console.log(`  place of supply   : ${o.placeOfSupply ?? "(not set)"}`);
    console.log(
      `  delivery address  : state=${addr?.state ?? "-"} stateCode=${addr?.stateCode ?? "-"} pin=${addr?.pincode ?? "-"}`,
    );
    console.log(`  fulfillment       : ${o.fulfillment}`);
    console.log(`  tax charged       : ${tax}`);
    // Place of supply now follows the buyer's GSTIN, so a mismatch means the
    // order predates that rule and was taxed off its delivery address.
    if (gstinState && o.placeOfSupply && gstinState !== o.placeOfSupply) {
      console.log(
        `  NOTE: placed before place-of-supply followed the GSTIN —` +
          ` billed to ${o.placeOfSupply} as ${tax}, would be IGST (${gstinState}) today`,
      );
    }
  }
}

/** Full detail for one order, to see exactly which fields an invoice can use. */
async function detail(orderNumber: string) {
  const o = await prisma.order.findFirst({
    where: { orderNumber },
    include: { items: true },
  });
  if (!o) {
    console.log(`\n${orderNumber}: not found`);
    return;
  }
  console.log(`\n=== ${o.orderNumber} (${o.createdAt.toISOString().slice(0, 10)})`);
  console.log(
    JSON.stringify(
      {
        subtotal: o.subtotal,
        discount: o.discount,
        deliveryFee: o.deliveryFee,
        total: o.total,
        taxableAmount: o.taxableAmount,
        cgst: o.cgstAmount,
        sgst: o.sgstAmount,
        igst: o.igstAmount,
        placeOfSupply: o.placeOfSupply,
        fulfillment: o.fulfillment,
        addressState: (o.deliveryAddress as { state?: string; stateCode?: string } | null)
          ?.state,
        addressStateCode: (
          o.deliveryAddress as { state?: string; stateCode?: string } | null
        )?.stateCode,
        items: o.items.map((i) => ({
          name: i.productName,
          hasProductId: Boolean(i.productId),
          unitPrice: i.unitPrice,
          qty: i.qty,
          lineTotal: i.lineTotal,
          taxableValue: i.taxableValue,
          gstRate: i.gstRate,
          hsnCode: i.hsnCode,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => b2bReport())
  .then(() => (process.argv[2] ? detail(process.argv[2]) : undefined))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
