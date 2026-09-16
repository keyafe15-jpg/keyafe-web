// Checks tax-invoice numbering, the invoice view model and the rendered PDF.
//
// DEV DATABASE ONLY. This calls the real createOrder(), so it creates (then
// deletes) real Order rows and fires order notifications. It also consumes
// numbers from the live invoice series, so it snapshots InvoiceCounter and
// BusinessSettings up front and restores both at the end.
//
// Run: ./node_modules/.bin/tsx scripts/check-invoice.ts
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "../src/config/db.js";
import { createOrder, createOrderSchema } from "../src/modules/orders/order.service.js";
import {
  amountInWords,
  buildHsnSummary,
  ensureInvoiceNumber,
  financialYearLabel,
  getInvoiceForOrder,
  invoiceFileName,
  type InvoiceLine,
} from "../src/modules/orders/invoice.service.js";
import { LOGO_PATH, renderInvoicePdf } from "../src/modules/orders/invoice.pdf.js";

const PROBE_PHONE = "9999000002";
const PROBE_NAME_PREFIX = "Invoice Probe";

const created: string[] = [];
let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "ok  " : "FAIL"}  ${label}` +
      (ok
        ? ""
        : `\n        got ${JSON.stringify(actual)}\n        want ${JSON.stringify(expected)}`),
  );
}

function section(title: string) {
  console.log(`\n-- ${title}`);
}

// --------------------------------------------------------------------------
// Pure logic — no database involved
// --------------------------------------------------------------------------
function checkPureLogic() {
  section("financial year labels (FY starts April)");
  const fy = (iso: string, start = 4) =>
    financialYearLabel(new Date(iso), start);
  check("mid-FY September", fy("2026-09-16T10:00:00Z"), "26-27");
  check("first day of FY", fy("2026-04-01T06:00:00Z"), "26-27");
  check("last day of previous FY", fy("2026-03-31T12:00:00Z"), "25-26");
  // 19:00 UTC on 31 Mar is already 00:30 IST on 1 Apr, so it is the new FY.
  check("IST midnight rollover", fy("2026-03-31T19:00:00Z"), "26-27");
  check("calendar-year FY", fy("2026-09-16T10:00:00Z", 1), "26-27");
  check("December with calendar-year FY", fy("2026-12-31T10:00:00Z", 1), "26-27");

  section("amount in words");
  check("zero", amountInWords(0), "Rupees Zero Only");
  check("simple", amountInWords(1250), "Rupees One Thousand Two Hundred Fifty Only");
  check(
    "with paise",
    amountInWords(1234.5),
    "Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only",
  );
  check("teens", amountInWords(19), "Rupees Nineteen Only");
  check("lakh", amountInWords(100000), "Rupees One Lakh Only");
  check(
    "crore with remainder",
    amountInWords(12345678),
    "Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only",
  );
  check("single paisa", amountInWords(0.01), "Rupees Zero and One Paise Only");

  section("HSN rate-wise summary");
  const line = (
    hsnCode: string | null,
    gstRate: number,
    taxableValue: number,
    cgst: number,
  ): InvoiceLine => ({
    description: "x",
    hsnCode,
    qty: 1,
    unitPrice: taxableValue,
    taxableValue,
    gstRate,
    cgstAmount: cgst,
    sgstAmount: cgst,
    igstAmount: 0,
    lineTotal: taxableValue + cgst * 2,
  });
  const summary = buildHsnSummary([
    line("1905", 18, 100, 9),
    line("1905", 18, 200, 18),
    line("1905", 5, 100, 2.5),
    line(null, 18, 50, 4.5),
  ]);
  check("groups by hsn + rate", summary.length, 3);
  check(
    "merges same hsn+rate",
    summary.find((r) => r.hsnCode === "1905" && r.gstRate === 18),
    { hsnCode: "1905", gstRate: 18, taxableValue: 300, cgstAmount: 27, sgstAmount: 27, igstAmount: 0 },
  );
  check(
    "missing hsn becomes a dash row",
    summary.find((r) => r.hsnCode === "—")?.taxableValue,
    50,
  );

  section("invoice filenames");
  check("slashes are stripped", invoiceFileName("KEY/26-27/0001"), "KEY-26-27-0001.pdf");
}

// --------------------------------------------------------------------------
// End-to-end against the database
// --------------------------------------------------------------------------
async function placeOrder(
  label: string,
  opts: {
    stateCode: string;
    state: string;
    pincode: string;
    productId: string;
    gst?: { companyName: string; gstin: string };
  },
) {
  const input = createOrderSchema.parse({
    customerName: `${PROBE_NAME_PREFIX} ${label}`,
    customerPhone: PROBE_PHONE,
    customerEmail: null,
    customerCompanyName: opts.gst?.companyName ?? null,
    customerGstin: opts.gst?.gstin ?? null,
    fulfillment: "DELIVERY",
    deliveryAddress: {
      line1: "1 Test Lane",
      line2: null,
      landmark: null,
      mapSearchQuery: "Test Lane landmark",
      pincode: opts.pincode,
      city: null,
      area: null,
      state: opts.state,
      stateCode: opts.stateCode,
    },
    customerNotes: "automated invoice check",
    paymentMethod: "cod",
    couponCode: null,
    items: [{ productId: opts.productId, unitPrice: 1000, qty: 2 }],
  });
  const order = await createOrder(input);
  created.push(order.id);
  return order;
}

async function main() {
  const clash = await prisma.user.findFirst({
    where: { phone: { contains: PROBE_PHONE } },
    select: { name: true },
  });
  if (clash && !clash.name.startsWith(PROBE_NAME_PREFIX)) {
    throw new Error(
      `PROBE_PHONE ${PROBE_PHONE} belongs to "${clash.name}" — pick an unused number`,
    );
  }

  checkPureLogic();

  const settings = await prisma.businessSettings.findFirstOrThrow();
  const local = await prisma.product.findFirstOrThrow({
    where: { isActive: true, isAvailable: true, canBeDeliveredPanIndia: false },
  });
  const pan = await prisma.product.findFirstOrThrow({
    where: { isActive: true, isAvailable: true, canBeDeliveredPanIndia: true },
  });
  const pin = await prisma.deliveryPincode.findFirstOrThrow({
    where: { isActive: true },
  });

  // Give the seller a GSTIN for the duration of the run so the "Tax Invoice"
  // path is exercised even on a dev DB that has none. Restored in finally.
  await prisma.businessSettings.update({
    where: { id: settings.id },
    data: { gstin: "19AAACR5055K1Z4" },
  });

  const fy = financialYearLabel(new Date(), settings.fyStartMonth);
  const series = `${settings.invoicePrefix}/${fy}`;
  // Snapshot where the real series stands, so the finally block can put it
  // back exactly rather than guessing how many numbers this run used.
  const counterBefore = await prisma.invoiceCounter.findUnique({
    where: { series },
  });
  restore = {
    settings: { id: settings.id, gstin: settings.gstin },
    series,
    counterBefore: counterBefore?.lastNumber ?? null,
  };

  section("numbering");
  const wb = await placeOrder("WB", {
    stateCode: "19",
    state: "West Bengal",
    pincode: pin.pincode,
    productId: local.id,
  });
  check("new order starts with no invoice number", wb.invoiceNumber, null);

  const first = await ensureInvoiceNumber(wb.id);
  check("number matches the FY series", first.invoiceNumber.startsWith(`${series}/`), true);
  check("number is zero-padded to 4", /\/\d{4}$/.test(first.invoiceNumber), true);
  check("first issue is not a reuse", first.reused, false);
  console.log(`        issued ${first.invoiceNumber}`);

  const again = await ensureInvoiceNumber(wb.id);
  check("re-issuing returns the same number", again.invoiceNumber, first.invoiceNumber);
  check("re-issue is flagged as reused", again.reused, true);
  check(
    "re-issue keeps the original date",
    again.invoiceDate.toISOString(),
    first.invoiceDate.toISOString(),
  );

  // Concurrent downloads of the same order must not mint two numbers.
  const raced = await Promise.all([
    ensureInvoiceNumber(wb.id),
    ensureInvoiceNumber(wb.id),
    ensureInvoiceNumber(wb.id),
  ]);
  check(
    "concurrent issues agree",
    new Set(raced.map((r) => r.invoiceNumber)).size,
    1,
  );

  const mh = await placeOrder("MH", {
    stateCode: "27",
    state: "Maharashtra",
    pincode: "400001",
    productId: pan.id,
    gst: { companyName: "Acme Foods Pvt Ltd", gstin: "27AAACR5055K1Z7" },
  });
  const second = await ensureInvoiceNumber(mh.id);
  const seqOf = (n: string) => Number(n.split("/").pop());
  check(
    "next order takes the next number, no gap",
    seqOf(second.invoiceNumber) - seqOf(first.invoiceNumber),
    1,
  );

  section("cancelled orders");
  const doomed = await placeOrder("CANCEL", {
    stateCode: "19",
    state: "West Bengal",
    pincode: pin.pincode,
    productId: local.id,
  });
  await prisma.order.update({
    where: { id: doomed.id },
    data: { status: "CANCELLED" },
  });
  let refused = false;
  try {
    await ensureInvoiceNumber(doomed.id);
  } catch (err) {
    refused = true;
    console.log(`        ${(err as Error).message}`);
  }
  check("cancelled order cannot be invoiced", refused, true);
  const counterAfter = await prisma.invoiceCounter.findUnique({ where: { series } });
  check(
    "refusal burned no number",
    counterAfter?.lastNumber,
    seqOf(second.invoiceNumber),
  );

  section("intra-state invoice (CGST + SGST)");
  const wbInvoice = await getInvoiceForOrder(wb.id);
  check("titled as a tax invoice", wbInvoice.title, "Tax Invoice");
  check("is intra-state", wbInvoice.isIntraState, true);
  check("has cgst", wbInvoice.cgstTotal > 0, true);
  check("cgst equals sgst", wbInvoice.cgstTotal, wbInvoice.sgstTotal);
  check("no igst", wbInvoice.igstTotal, 0);
  check("seller gstin present", wbInvoice.seller.gstin, "19AAACR5055K1Z4");
  check("place of supply named", wbInvoice.placeOfSupply.name, "West Bengal");
  check("not flagged legacy", wbInvoice.isLegacyOrder, false);
  check("hsn summary is populated", wbInvoice.hsnSummary.length > 0, true);

  // The printed rows must add up to the amount actually charged, or the
  // invoice contradicts the order.
  const balance = (i: typeof wbInvoice) =>
    Math.round(
      (i.taxableTotal +
        i.cgstTotal +
        i.sgstTotal +
        i.igstTotal +
        i.deliveryFee +
        i.roundOff -
        i.grandTotal) *
        100,
    ) / 100;
  check("invoice balances to the order total", balance(wbInvoice), 0);
  check(
    "hsn summary foots to the taxable total",
    Math.round(
      wbInvoice.hsnSummary.reduce((s, r) => s + r.taxableValue, 0) * 100,
    ) / 100,
    wbInvoice.taxableTotal,
  );
  console.log(`        ${wbInvoice.amountInWords}`);

  section("inter-state B2B invoice (IGST)");
  const mhInvoice = await getInvoiceForOrder(mh.id);
  check("is inter-state", mhInvoice.isIntraState, false);
  check("has igst", mhInvoice.igstTotal > 0, true);
  check("no cgst", mhInvoice.cgstTotal, 0);
  check("buyer gstin on invoice", mhInvoice.buyer.gstin, "27AAACR5055K1Z7");
  check("buyer billed as the company", mhInvoice.buyer.name, "Acme Foods Pvt Ltd");
  check("buyer state is Maharashtra", mhInvoice.buyer.stateName, "Maharashtra");
  check("invoice balances to the order total", balance(mhInvoice), 0);

  // The user-facing case that motivated the GSTIN-wins rule: a Maharashtra
  // business ordering a cake delivered here in West Bengal. The goods never
  // leave the state, but the buyer is billed inter-state so they can claim
  // input tax credit, and the invoice has to show both addresses.
  section("bill-to / ship-to (registered buyer, local delivery)");
  const billTo = await placeOrder("BILLTO", {
    stateCode: "19",
    state: "West Bengal",
    pincode: pin.pincode,
    productId: local.id,
    gst: { companyName: "Acme Foods Pvt Ltd", gstin: "27AAACR5055K1Z7" },
  });
  const billToInvoice = await getInvoiceForOrder(billTo.id);
  check(
    "place of supply follows the buyer's gstin",
    billToInvoice.placeOfSupply.code,
    "27",
  );
  check("charged igst despite a local delivery", billToInvoice.igstTotal > 0, true);
  check("no cgst on a bill-to/ship-to order", billToInvoice.cgstTotal, 0);
  check("ship-to block present", billToInvoice.shipTo !== null, true);
  check("ship-to keeps the real delivery state", billToInvoice.shipTo?.stateCode, "19");
  check(
    "ship-to carries the delivery address",
    (billToInvoice.shipTo?.addressLines.length ?? 0) > 0,
    true,
  );
  // The delivery address is not the buyer's registered address, so it must not
  // be printed under their Maharashtra heading.
  check("billed-to drops the delivery address", billToInvoice.buyer.addressLines, []);
  check("invoice balances to the order total", balance(billToInvoice), 0);
  const billToPdf = await renderInvoicePdf(billToInvoice);
  check("bill-to/ship-to pdf renders", billToPdf.subarray(0, 5).toString(), "%PDF-");
  const billToPath = join(tmpdir(), invoiceFileName(billToInvoice.invoiceNumber));
  writeFileSync(billToPath, billToPdf);
  console.log(`        wrote ${billToPath} — bill-to/ship-to layout`);

  // A same-state GSTIN must not trip the ship-to block.
  const localGst = await placeOrder("LOCALGST", {
    stateCode: "19",
    state: "West Bengal",
    pincode: pin.pincode,
    productId: local.id,
    gst: { companyName: "Howrah Sweets LLP", gstin: "19AAACR5055K1Z4" },
  });
  const localGstInvoice = await getInvoiceForOrder(localGst.id);
  check("same-state gstin stays intra-state", localGstInvoice.isIntraState, true);
  check("same-state gstin needs no ship-to block", localGstInvoice.shipTo, null);
  check(
    "same-state gstin keeps the address on billed-to",
    localGstInvoice.buyer.addressLines.length > 0,
    true,
  );

  section("legacy orders (no per-line tax captured)");
  const legacy = await placeOrder("LEGACY", {
    stateCode: "19",
    state: "West Bengal",
    pincode: pin.pincode,
    productId: local.id,
  });
  // Reproduce a pre-invoicing row: per-line tax and placeOfSupply were added
  // later, so historical orders only have the order-level GST snapshot.
  await prisma.orderItem.updateMany({
    where: { orderId: legacy.id },
    data: {
      taxableValue: null,
      gstRate: null,
      hsnCode: null,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
    },
  });
  await prisma.order.update({
    where: { id: legacy.id },
    data: { placeOfSupply: null },
  });

  const legacyInvoice = await getInvoiceForOrder(legacy.id);
  check("flagged as legacy", legacyInvoice.isLegacyOrder, true);
  check("no hsn table (codes were never captured)", legacyInvoice.hsnSummary.length, 0);
  // The point of the fallback: order-level GST must still reach the invoice.
  check("order-level cgst is shown", legacyInvoice.cgstTotal > 0, true);
  check("order-level sgst is shown", legacyInvoice.sgstTotal > 0, true);
  check(
    "taxable total comes from the order snapshot",
    legacyInvoice.taxableTotal,
    Number(
      (
        await prisma.order.findUniqueOrThrow({
          where: { id: legacy.id },
          select: { taxableAmount: true },
        })
      ).taxableAmount,
    ),
  );
  check("place of supply recovered from the address", legacyInvoice.placeOfSupply.code, "19");
  check("still treated as intra-state", legacyInvoice.isIntraState, true);
  check("invoice still balances", balance(legacyInvoice), 0);
  const legacyPdf = await renderInvoicePdf(legacyInvoice);
  check("legacy pdf renders", legacyPdf.subarray(0, 5).toString(), "%PDF-");

  // An order that genuinely had no GST must not have any invented.
  await prisma.order.update({
    where: { id: legacy.id },
    data: { taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 },
  });
  const noTax = await getInvoiceForOrder(legacy.id);
  check("no GST is invented when none was charged", noTax.cgstTotal, 0);
  check("taxable falls back to the line totals", noTax.taxableTotal > 0, true);
  check("zero-tax invoice still balances", balance(noTax), 0);

  section("plain invoice when the seller has no GSTIN");
  await prisma.businessSettings.update({
    where: { id: settings.id },
    data: { gstin: null },
  });
  const plain = await getInvoiceForOrder(wb.id);
  check("titled as a plain invoice", plain.title, "Invoice");
  check("reuses the same number", plain.invoiceNumber, first.invoiceNumber);
  await prisma.businessSettings.update({
    where: { id: settings.id },
    data: { gstin: "19AAACR5055K1Z4" },
  });

  section("pdf rendering");
  // Lives outside src/ on purpose: `tsc` doesn't copy assets, so an asset
  // under src/ would vanish from dist/ and every invoice would lose its logo.
  check("masthead logo asset is present", existsSync(LOGO_PATH), true);

  const pdf = await renderInvoicePdf(wbInvoice);
  check("is a PDF", pdf.subarray(0, 5).toString(), "%PDF-");
  check("has real content", pdf.length > 2000, true);
  const igstPdf = await renderInvoicePdf(mhInvoice);
  check("igst pdf also renders", igstPdf.subarray(0, 5).toString(), "%PDF-");

  const out = join(tmpdir(), invoiceFileName(wbInvoice.invoiceNumber));
  writeFileSync(out, pdf);
  console.log(`        wrote ${out} (${pdf.length} bytes) — open it to eyeball the layout`);
  console.log(`        and ${join(tmpdir(), invoiceFileName(mhInvoice.invoiceNumber))}`);
  writeFileSync(join(tmpdir(), invoiceFileName(mhInvoice.invoiceNumber)), igstPdf);
}

interface Restore {
  settings: { id: string; gstin: string | null };
  series: string;
  /** null means the series had no row before this run. */
  counterBefore: number | null;
}

let restore: Restore | null = null;

main()
  .catch((err) => {
    failures++;
    console.error("\nscript error:", err);
  })
  .finally(async () => {
    // Give back the invoice numbers this run consumed, so the real series
    // stays gap-free for actual customers.
    if (restore) {
      const counter = await prisma.invoiceCounter.findUnique({
        where: { series: restore.series },
      });
      if (restore.counterBefore === null) {
        await prisma.invoiceCounter.deleteMany({
          where: { series: restore.series },
        });
        console.log(`\nRemoved the ${restore.series} counter this run created`);
      } else if (counter && counter.lastNumber !== restore.counterBefore) {
        await prisma.invoiceCounter.update({
          where: { series: restore.series },
          data: { lastNumber: restore.counterBefore },
        });
        console.log(
          `\nRewound ${restore.series} from ${counter.lastNumber} back to ${restore.counterBefore}`,
        );
      }
      await prisma.businessSettings.update({
        where: { id: restore.settings.id },
        data: { gstin: restore.settings.gstin },
      });
      console.log(
        `Restored BusinessSettings.gstin to ${JSON.stringify(restore.settings.gstin)}`,
      );
    }

    for (const id of created) {
      await prisma.orderItem.deleteMany({ where: { orderId: id } });
      await prisma.order.delete({ where: { id } });
    }
    const { count } = await prisma.user.deleteMany({
      where: {
        phone: { contains: PROBE_PHONE },
        name: { startsWith: PROBE_NAME_PREFIX },
      },
    });
    console.log(`Cleaned up ${created.length} probe order(s) and ${count} profile(s)`);
    console.log(failures === 0 ? "\nAll checks passed" : `\n${failures} check(s) FAILED`);
    await prisma.$disconnect();
    process.exit(failures === 0 ? 0 : 1);
  });
