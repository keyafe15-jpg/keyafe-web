import type { GstScheme, Order, OrderItem } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { logger } from "../../utils/logger.js";
import { roundMoney } from "../coupons/coupon.service.js";
import { normalizeStateCode, stateCodeFromName, stateNameFromCode } from "../../lib/indiaStates.js";
import { FALLBACK_SELLER_STATE_CODE } from "./order.tax.js";
import { renderInvoicePdf } from "./invoice.pdf.js";
import type { DocumentParty } from "./pdf.theme.js";
import { renderInvoiceEmail } from "../email/templates.js";
import { sendEmail, type EmailAttachment } from "../email/email.service.js";

const IST = "Asia/Kolkata";

export type OrderWithItems = Order & { items: OrderItem[] };

/**
 * Financial-year label for an invoice date, e.g. "26-27" for 16 Sep 2026 when
 * the FY starts in April. Evaluated in IST, because an order placed at 01:00
 * IST on 1 April belongs to the new FY even though it is still March in UTC.
 */
export function financialYearLabel(date: Date, fyStartMonth: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);

  const startYear = month >= fyStartMonth ? year : year - 1;
  const two = (y: number) => String(y % 100).padStart(2, "0");
  return `${two(startYear)}-${two(startYear + 1)}`;
}

export interface SellerSettings {
  legalName: string;
  tradeName: string;
  gstin: string | null;
  gstScheme: GstScheme;
  registeredAddress: unknown;
  invoicePrefix: string;
  fyStartMonth: number;
  supportEmail: string;
  supportPhone: string;
  /** Printed on delivery challans only; the invoice has its own declaration. */
  challanTerms: string | null;
}

export async function getSellerSettings(): Promise<SellerSettings> {
  const settings = await prisma.businessSettings.findFirst({
    select: {
      legalName: true,
      tradeName: true,
      gstin: true,
      gstScheme: true,
      registeredAddress: true,
      invoicePrefix: true,
      fyStartMonth: true,
      supportEmail: true,
      supportPhone: true,
      challanTerms: true,
    },
  });
  if (!settings) throw HttpError.notFound("Business settings not found");
  return settings;
}

/**
 * Assigns the order its permanent invoice number, or returns the existing one.
 *
 * GST requires numbers to be consecutive with no gaps and never reused, so the
 * counter is incremented inside a transaction and the order is stamped in the
 * same transaction — if stamping fails, the increment rolls back with it.
 *
 * Numbers are assigned lazily (on first download/email) rather than at order
 * creation, so abandoned and cancelled orders never consume one.
 */
export async function ensureInvoiceNumber(
  orderId: string,
): Promise<{ invoiceNumber: string; invoiceDate: Date; reused: boolean }> {
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    select: { invoiceNumber: true, invoiceDate: true, status: true },
  });
  if (!existing) throw HttpError.notFound("Order not found");

  // Re-issuing is idempotent: the same order always keeps its first number, so
  // a second download can never mint a duplicate.
  if (existing.invoiceNumber && existing.invoiceDate) {
    return {
      invoiceNumber: existing.invoiceNumber,
      invoiceDate: existing.invoiceDate,
      reused: true,
    };
  }

  // A cancelled order was never supplied, so it must not take a number out of
  // the series. Already-numbered cancellations are returned above and should be
  // handled with a credit note instead.
  if (existing.status === "CANCELLED") {
    throw HttpError.badRequest("Cannot issue a tax invoice for a cancelled order");
  }

  const settings = await getSellerSettings();
  const invoiceDate = new Date();
  const fy = financialYearLabel(invoiceDate, settings.fyStartMonth);
  const series = `${settings.invoicePrefix}/${fy}`;

  return prisma.$transaction(async (tx) => {
    // Re-check inside the transaction: two concurrent downloads of the same
    // order would otherwise both pass the check above and mint two numbers.
    const fresh = await tx.order.findUnique({
      where: { id: orderId },
      select: { invoiceNumber: true, invoiceDate: true },
    });
    if (fresh?.invoiceNumber && fresh.invoiceDate) {
      return {
        invoiceNumber: fresh.invoiceNumber,
        invoiceDate: fresh.invoiceDate,
        reused: true,
      };
    }

    const counter = await tx.invoiceCounter.upsert({
      where: { series },
      create: { series, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
      select: { lastNumber: true },
    });

    const invoiceNumber = `${series}/${String(counter.lastNumber).padStart(4, "0")}`;
    await tx.order.update({
      where: { id: orderId },
      data: { invoiceNumber, invoiceDate },
    });

    return { invoiceNumber, invoiceDate, reused: false };
  });
}

// ---------------------------------------------------------------------------
// Invoice view model
// ---------------------------------------------------------------------------

// Same shape the challan uses, so the two documents render parties identically.
export type InvoiceParty = DocumentParty;

export interface InvoiceLine {
  description: string;
  hsnCode: string | null;
  qty: number;
  unitPrice: number;
  /** Line value after any discount allocated to it, excluding GST. */
  taxableValue: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineTotal: number;
}

export interface HsnSummaryRow {
  hsnCode: string;
  gstRate: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
}

export interface InvoiceData {
  /** "Tax Invoice" only when the seller has a GSTIN and is not on composition. */
  title: string;
  invoiceNumber: string;
  invoiceDate: Date;
  orderNumber: string;
  orderDate: Date;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  /** Set only on bill-to/ship-to orders, where the goods left the billed state. */
  shipTo: {
    addressLines: string[];
    stateName?: string;
    stateCode: string;
  } | null;
  placeOfSupply: { code: string; name: string };
  isIntraState: boolean;
  isReverseCharge: false;
  lines: InvoiceLine[];
  hsnSummary: HsnSummaryRow[];
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  discount: number;
  couponCode: string | null;
  deliveryFee: number;
  /** Balances the printed rows against the amount actually charged. */
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
  paymentMethod: string;
  paymentStatus: string;
  amountPaid: number;
  balanceDue: number;
  /** Composition dealers must print this and cannot collect GST. */
  compositionNote: string | null;
  /** True when per-line tax is missing, so lines are shown without a GST split. */
  isLegacyOrder: boolean;
}

export interface AddressShape {
  line1?: string | null;
  line2?: string | null;
  landmark?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  stateCode?: string | null;
  pincode?: string | null;
}

export function asAddress(value: unknown): AddressShape {
  return value && typeof value === "object" ? (value as AddressShape) : {};
}

// State is deliberately left out: a GST invoice has to state the name *and*
// code, so it gets its own line rather than being buried in the address.
export function addressLines(addr: AddressShape): string[] {
  const cityLine = [addr.area, addr.city].filter(Boolean).join(", ");
  const lastLine = [cityLine, addr.pincode].filter((p) => p && String(p).trim()).join(" · ");
  return [addr.line1, addr.line2, lastLine].map((l) => (l ? String(l).trim() : "")).filter(Boolean);
}

/** Indian-system words for a rupee amount, e.g. "One Lakh Twenty". */
function wordsForInteger(n: number): string {
  const ONES = [
    "Zero",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const TENS = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const under100 = (v: number): string => {
    if (v < 20) return ONES[v]!;
    const t = TENS[Math.floor(v / 10)]!;
    const o = v % 10;
    return o ? `${t} ${ONES[o]}` : t;
  };

  const under1000 = (v: number): string => {
    const h = Math.floor(v / 100);
    const rest = v % 100;
    if (!h) return under100(rest);
    return rest ? `${ONES[h]} Hundred ${under100(rest)}` : `${ONES[h]} Hundred`;
  };

  if (n === 0) return "Zero";

  // Indian grouping: crore, lakh, thousand, then the last three digits.
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;

  if (crore) parts.push(`${under1000(crore)} Crore`);
  if (lakh) parts.push(`${under1000(lakh)} Lakh`);
  if (thousand) parts.push(`${under1000(thousand)} Thousand`);
  if (rest) parts.push(under1000(rest));
  return parts.join(" ");
}

export function amountInWords(amount: number): string {
  const safe = Math.max(0, roundMoney(amount));
  const rupees = Math.floor(safe);
  const paise = Math.round((safe - rupees) * 100);
  const head = `Rupees ${wordsForInteger(rupees)}`;
  return paise > 0 ? `${head} and ${wordsForInteger(paise)} Paise Only` : `${head} Only`;
}

function itemDescription(item: OrderItem): string {
  const meta = [item.sizeLabel, item.flavourName].filter(Boolean).join(", ");
  return meta ? `${item.productName} (${meta})` : item.productName;
}

/** Groups lines by HSN + rate, as required on the face of a tax invoice. */
export function buildHsnSummary(lines: InvoiceLine[]): HsnSummaryRow[] {
  const map = new Map<string, HsnSummaryRow>();
  for (const line of lines) {
    const hsnCode = line.hsnCode ?? "—";
    const key = `${hsnCode}|${line.gstRate}`;
    const row = map.get(key) ?? {
      hsnCode,
      gstRate: line.gstRate,
      taxableValue: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
    };
    row.taxableValue = roundMoney(row.taxableValue + line.taxableValue);
    row.cgstAmount = roundMoney(row.cgstAmount + line.cgstAmount);
    row.sgstAmount = roundMoney(row.sgstAmount + line.sgstAmount);
    row.igstAmount = roundMoney(row.igstAmount + line.igstAmount);
    map.set(key, row);
  }
  return [...map.values()].sort(
    (a, b) => a.hsnCode.localeCompare(b.hsnCode) || a.gstRate - b.gstRate,
  );
}

function addressKey(addr: {
  line1?: string | null;
  line2?: string | null;
  pincode?: string | null;
  stateCode?: string | null;
} | null): string {
  if (!addr) return "";
  return [addr.line1, addr.line2, addr.pincode, addr.stateCode]
    .map((v) => (v ?? "").trim().toLowerCase())
    .join("|");
}

/**
 * Assembles everything the PDF prints. Reads only stored snapshots, never
 * live product data, so a reprint years later is identical to the original.
 */
export async function buildInvoiceData(
  order: OrderWithItems,
  issued: { invoiceNumber: string; invoiceDate: Date },
): Promise<InvoiceData> {
  const settings = await getSellerSettings();
  const sellerAddr = asAddress(settings.registeredAddress);
  const sellerStateCode = sellerAddr.stateCode?.trim() || FALLBACK_SELLER_STATE_CODE;

  const deliveryAddr = asAddress(order.deliveryAddress);
  // Prefer snapshotted billing; legacy rows fall back to delivery.
  const billingAddr = asAddress(order.billingAddress) ?? deliveryAddr;

  // `placeOfSupply` was added with invoicing, so older orders fall back to the
  // snapshotted delivery address. Unlike resolvePlaceOfSupply this must never
  // throw: refusing to render an invoice for an old order is worse than
  // printing the seller's state for a counter pickup.
  const placeCode =
    order.placeOfSupply?.trim() ||
    (order.fulfillment === "PICKUP"
      ? sellerStateCode
      : (normalizeStateCode(billingAddr.stateCode) ??
        stateCodeFromName(billingAddr.state) ??
        normalizeStateCode(deliveryAddr.stateCode) ??
        stateCodeFromName(deliveryAddr.state) ??
        sellerStateCode));

  const deliveryStateCode =
    normalizeStateCode(deliveryAddr.stateCode) ?? stateCodeFromName(deliveryAddr.state);

  // For a GST-registered buyer the place of supply follows their GSTIN, so the
  // goods can land in a different state from the one being billed. Also show
  // ship-to when billing and delivery addresses diverge (gift / dual address).
  const shipToDiffers =
    order.fulfillment === "DELIVERY" &&
    !!deliveryAddr &&
    ((!!deliveryStateCode && deliveryStateCode !== placeCode) ||
      addressKey(billingAddr) !== addressKey(deliveryAddr) ||
      Boolean(order.recipientName && order.recipientName !== order.customerName));

  const orderTaxable = Number(order.taxableAmount);
  const orderCgst = Number(order.cgstAmount);
  const orderSgst = Number(order.sgstAmount);
  const orderIgst = Number(order.igstAmount);
  const orderGstTotal = roundMoney(orderCgst + orderSgst + orderIgst);

  // Which tax applied is decided by what was actually charged, falling back to
  // the state codes only when no GST was collected at all. An invoice that
  // labels the tax differently from the money taken is worse than useless.
  const isIntraState =
    orderIgst > 0 ? false : orderCgst > 0 || orderSgst > 0 ? true : placeCode === sellerStateCode;

  // Orders placed before per-line tax existed cannot be split by line or HSN,
  // but most of them still have the order-level GST recorded, so the breakup
  // is taken from there rather than dropped.
  const hasLineTax = order.items.every((i) => i.taxableValue !== null);
  const isLegacyOrder = !hasLineTax;

  const lines: InvoiceLine[] = order.items.map((item) => {
    const lineTotal = Number(item.lineTotal);
    return {
      description: itemDescription(item),
      hsnCode: item.hsnCode,
      qty: item.qty,
      unitPrice: Number(item.unitPrice),
      // Legacy rows fall back to the charged amount so the column still foots.
      taxableValue: item.taxableValue === null ? lineTotal : Number(item.taxableValue),
      gstRate: item.gstRate === null ? 0 : Number(item.gstRate),
      cgstAmount: Number(item.cgstAmount),
      sgstAmount: Number(item.sgstAmount),
      igstAmount: Number(item.igstAmount),
      lineTotal,
    };
  });

  // Per-line values when we have them; otherwise the order-level snapshot.
  const lineTaxableSum = roundMoney(lines.reduce((s, l) => s + l.taxableValue, 0));
  const useOrderLevelTax = !hasLineTax && orderGstTotal > 0 && orderTaxable > 0;

  const taxableTotal = hasLineTax
    ? lineTaxableSum
    : useOrderLevelTax
      ? orderTaxable
      : lineTaxableSum;
  const cgstTotal = hasLineTax
    ? roundMoney(lines.reduce((s, l) => s + l.cgstAmount, 0))
    : useOrderLevelTax
      ? orderCgst
      : 0;
  const sgstTotal = hasLineTax
    ? roundMoney(lines.reduce((s, l) => s + l.sgstAmount, 0))
    : useOrderLevelTax
      ? orderSgst
      : 0;
  const igstTotal = hasLineTax
    ? roundMoney(lines.reduce((s, l) => s + l.igstAmount, 0))
    : useOrderLevelTax
      ? orderIgst
      : 0;
  const deliveryFee = Number(order.deliveryFee);
  const grandTotal = roundMoney(Number(order.total));

  // Delivery is charged without GST today, so it is shown as its own untaxed
  // row. Any paise left between the printed rows and the amount actually
  // charged becomes the round-off, so the invoice always balances.
  const printedSum = roundMoney(taxableTotal + cgstTotal + sgstTotal + igstTotal + deliveryFee);
  const roundOff = roundMoney(grandTotal - printedSum);

  const amountPaid = order.paymentStatus === "PAID" ? grandTotal : Number(order.advanceAmount);

  const isTaxInvoice = Boolean(settings.gstin) && settings.gstScheme !== "COMPOSITE";

  return {
    title: isTaxInvoice ? "Tax Invoice" : "Invoice",
    invoiceNumber: issued.invoiceNumber,
    invoiceDate: issued.invoiceDate,
    orderNumber: order.orderNumber,
    orderDate: order.createdAt,
    seller: {
      name: settings.tradeName,
      legalName: settings.legalName,
      gstin: settings.gstin,
      addressLines: addressLines(sellerAddr),
      stateName: stateNameFromCode(sellerStateCode),
      stateCode: sellerStateCode,
      phone: settings.supportPhone,
      email: settings.supportEmail,
    },
    buyer: {
      name: order.customerCompanyName || order.customerName,
      legalName: order.customerCompanyName ?? undefined,
      gstin: order.customerGstin,
      addressLines:
        order.fulfillment === "PICKUP"
          ? ["Collected at the bakery counter"]
          : addressLines(billingAddr),
      stateName: stateNameFromCode(placeCode),
      stateCode: placeCode,
      phone: order.customerPhone,
      email: order.customerEmail,
    },
    shipTo: shipToDiffers
      ? {
          addressLines: [
            ...(order.recipientName && order.recipientName !== order.customerName
              ? [order.recipientName]
              : []),
            ...addressLines(deliveryAddr),
          ],
          stateName: stateNameFromCode(deliveryStateCode!) ?? undefined,
          stateCode: deliveryStateCode!,
        }
      : null,
    placeOfSupply: {
      code: placeCode,
      name: stateNameFromCode(placeCode) ?? placeCode,
    },
    isIntraState,
    isReverseCharge: false,
    lines,
    // No HSN codes were captured on legacy lines, and inventing them would be
    // worse than omitting the table.
    hsnSummary: hasLineTax ? buildHsnSummary(lines) : [],
    taxableTotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    discount: Number(order.discount),
    couponCode: order.couponCode,
    deliveryFee,
    roundOff,
    grandTotal,
    amountInWords: amountInWords(grandTotal),
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    amountPaid,
    balanceDue: roundMoney(grandTotal - amountPaid),
    compositionNote:
      settings.gstScheme === "COMPOSITE"
        ? "Composition taxable person, not eligible to collect tax on supplies."
        : null,
    isLegacyOrder,
  };
}

/** Issues (or reuses) the number and returns the full printable invoice. */
export async function getInvoiceForOrder(orderId: string): Promise<InvoiceData> {
  const issued = await ensureInvoiceNumber(orderId);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) throw HttpError.notFound("Order not found");
  return buildInvoiceData(order, issued);
}

export function invoiceFileName(invoiceNumber: string): string {
  // Invoice numbers contain slashes, which are not legal in filenames.
  return `${invoiceNumber.replace(/[^A-Za-z0-9-]+/g, "-")}.pdf`;
}

/** Issues (or reuses) the number and renders the PDF. */
export async function buildInvoicePdf(orderId: string): Promise<{
  data: InvoiceData;
  pdf: Buffer;
  filename: string;
}> {
  const data = await getInvoiceForOrder(orderId);
  const pdf = await renderInvoicePdf(data);
  return { data, pdf, filename: invoiceFileName(data.invoiceNumber) };
}

/**
 * Emails the invoice PDF to the customer. Returns what happened so the admin
 * UI can say "sent to ..." or explain why it couldn't.
 */
export async function sendInvoiceEmail(orderId: string): Promise<{
  sent: boolean;
  to: string | null;
  invoiceNumber: string;
}> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) throw HttpError.notFound("Order not found");

  if (!order.customerEmail) {
    throw HttpError.badRequest(
      "This order has no email address on it, so the invoice can't be emailed. Download the PDF instead.",
    );
  }

  const issued = await ensureInvoiceNumber(orderId);
  const data = await buildInvoiceData(order, issued);
  const pdf = await renderInvoicePdf(data);

  const { subject, html } = renderInvoiceEmail({
    order,
    title: data.title,
    invoiceNumber: data.invoiceNumber,
    tradeName: data.seller.name,
    supportPhone: data.seller.phone ?? "",
  });

  const sent = await sendEmail({
    to: order.customerEmail,
    subject,
    html,
    replyTo: data.seller.email ?? undefined,
    attachments: [
      {
        filename: invoiceFileName(data.invoiceNumber),
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });

  return { sent, to: order.customerEmail, invoiceNumber: data.invoiceNumber };
}

/**
 * Invoice attachment for the order-confirmation email, but only once the order
 * is fully paid — an unpaid order hasn't been supplied yet, and attaching a
 * numbered invoice to it would burn a number the order may never deserve.
 *
 * Returns null (and logs) on any failure, so a PDF problem can never stop the
 * confirmation email itself from going out.
 */
export async function invoiceAttachmentIfPaid(
  order: OrderWithItems,
): Promise<EmailAttachment | null> {
  if (order.paymentStatus !== "PAID") return null;
  try {
    const { pdf, filename } = await buildInvoicePdf(order.id);
    return { filename, content: pdf, contentType: "application/pdf" };
  } catch (err) {
    logger.error(
      { err, orderId: order.id, orderNumber: order.orderNumber },
      "could not attach invoice to confirmation email",
    );
    return null;
  }
}
