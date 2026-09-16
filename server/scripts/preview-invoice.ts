// Renders an existing order's invoice to a PDF in /tmp for eyeballing.
//
// Read-only apart from the invoice number: it uses a throwaway number instead
// of calling ensureInvoiceNumber, so previewing never consumes one from the
// real series or stamps the order.
//
// Run: ./node_modules/.bin/tsx scripts/preview-invoice.ts KEY-260914-PBCSHY
import { writeFileSync } from "node:fs";
import { prisma } from "../src/config/db.js";
import { buildInvoiceData } from "../src/modules/orders/invoice.service.js";
import { renderInvoicePdf } from "../src/modules/orders/invoice.pdf.js";

async function main() {
  const orderNumber = process.argv[2];
  if (!orderNumber) throw new Error("usage: preview-invoice.ts <orderNumber>");

  const order = await prisma.order.findFirst({
    where: { orderNumber },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) throw new Error(`order ${orderNumber} not found`);

  const data = await buildInvoiceData(order, {
    invoiceNumber: order.invoiceNumber ?? "PREVIEW/NOT-ISSUED",
    invoiceDate: order.invoiceDate ?? new Date(),
  });

  console.log(
    JSON.stringify(
      {
        title: data.title,
        isLegacyOrder: data.isLegacyOrder,
        isIntraState: data.isIntraState,
        placeOfSupply: data.placeOfSupply,
        taxableTotal: data.taxableTotal,
        cgstTotal: data.cgstTotal,
        sgstTotal: data.sgstTotal,
        igstTotal: data.igstTotal,
        deliveryFee: data.deliveryFee,
        roundOff: data.roundOff,
        grandTotal: data.grandTotal,
        hsnRows: data.hsnSummary.length,
        amountInWords: data.amountInWords,
      },
      null,
      2,
    ),
  );

  const balance =
    Math.round(
      (data.taxableTotal +
        data.cgstTotal +
        data.sgstTotal +
        data.igstTotal +
        data.deliveryFee +
        data.roundOff -
        data.grandTotal) *
        100,
    ) / 100;
  console.log(`balances: ${balance === 0 ? "yes" : `NO (off by ${balance})`}`);

  const out = `/tmp/preview-${orderNumber}.pdf`;
  writeFileSync(out, await renderInvoicePdf(data));
  console.log(`wrote ${out}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
