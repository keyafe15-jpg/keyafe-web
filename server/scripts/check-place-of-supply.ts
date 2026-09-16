// End-to-end check that the place of supply drives the CGST/SGST vs IGST split.
//
// DEV DATABASE ONLY. This calls the real createOrder(), so it also fires the
// order-notification email and the web-push "new order" notification, and it
// creates then deletes real Order rows. Never point it at production.
//
// The probe phone must not belong to a real customer: createOrder() upserts a
// customer profile from the order's name and phone, so a real number would get
// its profile name overwritten.
//
// Run: ./node_modules/.bin/tsx scripts/check-place-of-supply.ts
import { prisma } from "../src/config/db.js";
import {
  createOrder,
  createOrderSchema,
} from "../src/modules/orders/order.service.js";

const PROBE_PHONE = "9999000001";
const PROBE_NAME_PREFIX = "Tax Probe";

const created: string[] = [];
let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "ok  " : "FAIL"}  ${label}` +
      (ok ? "" : `\n        got ${JSON.stringify(actual)}\n        want ${JSON.stringify(expected)}`),
  );
}

async function place(
  label: string,
  stateCode: string,
  state: string,
  pincode: string,
  productId: string,
  unitPrice: number,
  gst?: { companyName: string; gstin: string },
) {
  // Parse through the schema first: normalisation and GSTIN validation live
  // there, exactly as they do for a real HTTP request.
  const input = createOrderSchema.parse({
    customerName: `${PROBE_NAME_PREFIX} ${label}`,
    customerPhone: PROBE_PHONE,
    customerEmail: null,
    customerCompanyName: gst?.companyName ?? null,
    customerGstin: gst?.gstin ?? null,
    fulfillment: "DELIVERY",
    deliveryAddress: {
      line1: "1 Test Lane",
      line2: null,
      landmark: null,
      mapSearchQuery: "Test Lane landmark",
      pincode,
      city: null,
      area: null,
      state,
      stateCode,
    },
    customerNotes: "automated tax check",
    paymentMethod: "cod",
    couponCode: null,
    items: [{ productId, unitPrice, qty: 2 }],
  });
  const order = await createOrder(input);
  created.push(order.id);
  const full = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: { items: true },
  });
  return full;
}

async function main() {
  // Refuse to run if the probe phone belongs to someone real.
  const clash = await prisma.user.findFirst({
    where: { phone: { contains: PROBE_PHONE } },
    select: { id: true, name: true },
  });
  if (clash && !clash.name.startsWith(PROBE_NAME_PREFIX)) {
    throw new Error(
      `PROBE_PHONE ${PROBE_PHONE} belongs to "${clash.name}" — pick an unused number so a real profile is not renamed`,
    );
  }

  const local = await prisma.product.findFirstOrThrow({
    where: { isActive: true, isAvailable: true, canBeDeliveredPanIndia: false },
  });
  const pan = await prisma.product.findFirstOrThrow({
    where: { isActive: true, isAvailable: true, canBeDeliveredPanIndia: true },
  });
  const pin = await prisma.deliveryPincode.findFirstOrThrow({
    where: { isActive: true },
  });

  // 1. Local West Bengal delivery -> CGST + SGST, no IGST.
  const wb = await place("WB", "19", "West Bengal", pin.pincode, local.id, 1000);
  console.log(`\n-- local WB order ${wb.orderNumber}`);
  check("WB placeOfSupply", wb.placeOfSupply, "19");
  check("WB has cgst", Number(wb.cgstAmount) > 0, true);
  check("WB has sgst", Number(wb.sgstAmount) > 0, true);
  check("WB no igst", Number(wb.igstAmount), 0);
  check("WB line hsn persisted", wb.items[0]!.hsnCode, local.hsnCode);
  check("WB line gstRate persisted", Number(wb.items[0]!.gstRate), Number(local.gstRate));
  check(
    "WB line tax sums to order tax",
    {
      taxable: Number(wb.items[0]!.taxableValue),
      cgst: Number(wb.items[0]!.cgstAmount),
      sgst: Number(wb.items[0]!.sgstAmount),
    },
    {
      taxable: Number(wb.taxableAmount),
      cgst: Number(wb.cgstAmount),
      sgst: Number(wb.sgstAmount),
    },
  );

  // 2. Pan-India delivery to Maharashtra -> IGST only.
  const mh = await place("MH", "27", "Maharashtra", "400001", pan.id, 1000);
  console.log(`\n-- pan-India MH order ${mh.orderNumber}`);
  check("MH placeOfSupply", mh.placeOfSupply, "27");
  check("MH no cgst", Number(mh.cgstAmount), 0);
  check("MH no sgst", Number(mh.sgstAmount), 0);
  check("MH has igst", Number(mh.igstAmount) > 0, true);
  check(
    "MH igst equals WB cgst+sgst",
    Number(mh.igstAmount),
    Number(wb.cgstAmount) + Number(wb.sgstAmount),
  );
  check("MH line igst sums to order", Number(mh.items[0]!.igstAmount), Number(mh.igstAmount));

  // 3. Pan-India delivery back into West Bengal -> still intra-state.
  const panWb = await place("PANWB", "19", "West Bengal", "700091", pan.id, 1000);
  console.log(`\n-- pan-India but WB address, order ${panWb.orderNumber}`);
  check("pan-India WB placeOfSupply", panWb.placeOfSupply, "19");
  check("pan-India WB no igst", Number(panWb.igstAmount), 0);
  check("pan-India WB has cgst+sgst", Number(panWb.cgstAmount) + Number(panWb.sgstAmount) > 0, true);

  // 4. B2B order: company name and GSTIN persist, normalised.
  const b2b = await place("B2B", "27", "Maharashtra", "400001", pan.id, 1000, {
    companyName: "Acme Foods Pvt Ltd",
    gstin: " 27aaacr5055k1z7 ",
  });
  console.log(`\n-- B2B order ${b2b.orderNumber}`);
  check("company name persisted", b2b.customerCompanyName, "Acme Foods Pvt Ltd");
  check("gstin normalised and persisted", b2b.customerGstin, "27AAACR5055K1Z7");
  check("B2B still taxed by delivery state", b2b.placeOfSupply, "27");
  check("B2B out-of-state gets igst", Number(b2b.igstAmount) > 0, true);

  // 5. An invalid GSTIN must be rejected at the schema boundary.
  let gstinRejected = false;
  try {
    await place("BADGST", "27", "Maharashtra", "400001", pan.id, 1000, {
      companyName: "Typo Traders",
      gstin: "27AAACR5055K1Z8",
    });
  } catch (err) {
    gstinRejected = true;
    console.log(`\n-- bad GSTIN rejected: ${(err as Error).message}`);
  }
  check("invalid GSTIN is rejected", gstinRejected, true);

  // 6. A missing state must be rejected, never silently taxed as intra-state.
  let rejected = false;
  try {
    await place("NOSTATE", "", "", "400001", pan.id, 1000);
  } catch (err) {
    rejected = true;
    console.log(`\n-- missing state rejected: ${(err as Error).message}`);
  }
  check("missing state is rejected", rejected, true);
}

main()
  .catch((err) => {
    failures++;
    console.error("\nscript error:", err);
  })
  .finally(async () => {
    for (const id of created) {
      await prisma.orderItem.deleteMany({ where: { orderId: id } });
      await prisma.order.delete({ where: { id } });
    }
    // Drop the customer profile createOrder() made for the probe phone.
    const { count } = await prisma.user.deleteMany({
      where: {
        phone: { contains: PROBE_PHONE },
        name: { startsWith: PROBE_NAME_PREFIX },
      },
    });
    console.log(
      `\nCleaned up ${created.length} probe order(s) and ${count} probe profile(s)`,
    );
    console.log(failures === 0 ? "All checks passed" : `${failures} check(s) FAILED`);
    await prisma.$disconnect();
    process.exit(failures === 0 ? 0 : 1);
  });
