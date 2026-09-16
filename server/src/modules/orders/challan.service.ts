// Delivery challan — the document that travels with the goods and gets signed
// on handover. It is not a tax document: it carries quantities and HSN codes
// but no prices or GST. Corporate orders get both this and a tax invoice, each
// with its own number series, so the two cross-reference each other.
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { gstinStateCode } from "../../lib/gstin.js";
import { normalizeStateCode, stateCodeFromName, stateNameFromCode } from "../../lib/indiaStates.js";
import { FALLBACK_SELLER_STATE_CODE } from "./order.tax.js";
import {
  addressLines,
  asAddress,
  financialYearLabel,
  getSellerSettings,
  type OrderWithItems,
} from "./invoice.service.js";
import type { DocumentParty } from "./pdf.theme.js";
import { renderChallanPdf } from "./challan.pdf.js";

const IST = "Asia/Kolkata";

// Everything we sell is handed over as counted pieces; weight belongs in the
// item description, not the unit column. A per-product unit would only be
// needed if something starts being sold loose by the kilo.
const DEFAULT_UNIT = "Nos";

// Rule 55 wants a reason stated. Every challan we raise accompanies a sale.
const DEFAULT_TRANSPORT_REASON = "Supply of goods";

/**
 * Assigns the order its permanent challan number, or returns the existing one.
 *
 * Mirrors `ensureInvoiceNumber`: the counter is incremented and the order
 * stamped inside one transaction, and the number is assigned lazily on first
 * download so orders that never ship don't consume one. The series is separate
 * from the invoice series, so a corporate order holding both documents has an
 * independent number for each.
 */
export async function ensureChallanNumber(
  orderId: string,
): Promise<{ challanNumber: string; challanDate: Date; reused: boolean }> {
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    select: { challanNumber: true, challanDate: true, status: true },
  });
  if (!existing) throw HttpError.notFound("Order not found");

  // Reprinting is idempotent: the copy the customer signed and our copy must
  // carry the same number.
  if (existing.challanNumber && existing.challanDate) {
    return {
      challanNumber: existing.challanNumber,
      challanDate: existing.challanDate,
      reused: true,
    };
  }

  // Nothing was ever handed over on a cancelled order, so it must not take a
  // number out of the series.
  if (existing.status === "CANCELLED") {
    throw HttpError.badRequest("Cannot issue a delivery challan for a cancelled order");
  }

  const settings = await getSellerSettings();
  const challanDate = new Date();
  const fy = financialYearLabel(challanDate, settings.fyStartMonth);
  const series = `${settings.invoicePrefix}/DC/${fy}`;

  return prisma.$transaction(async (tx) => {
    // Re-check inside the transaction: two concurrent downloads of the same
    // order would otherwise both pass the check above and mint two numbers.
    const fresh = await tx.order.findUnique({
      where: { id: orderId },
      select: { challanNumber: true, challanDate: true },
    });
    if (fresh?.challanNumber && fresh.challanDate) {
      return {
        challanNumber: fresh.challanNumber,
        challanDate: fresh.challanDate,
        reused: true,
      };
    }

    const counter = await tx.invoiceCounter.upsert({
      where: { series },
      create: { series, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
      select: { lastNumber: true },
    });

    const challanNumber = `${series}/${String(counter.lastNumber).padStart(4, "0")}`;
    await tx.order.update({
      where: { id: orderId },
      data: { challanNumber, challanDate },
    });

    return { challanNumber, challanDate, reused: false };
  });
}

// ---------------------------------------------------------------------------
// Challan view model
// ---------------------------------------------------------------------------

export interface ChallanLine {
  slNo: number;
  itemName: string;
  /** Size, flavour, cake message and — on mixed orders — this line's slot. */
  details: string[];
  hsnCode: string | null;
  qty: number;
  unit: string;
}

export interface ChallanData {
  challanNumber: string;
  challanDate: Date;
  orderNumber: string;
  orderDate: Date;
  /** Set once a tax invoice has been issued, so the pair is traceable. */
  invoiceNumber: string | null;
  seller: DocumentParty;
  /** "Delivery Challan For" — the party being billed. */
  party: DocumentParty;
  /** "Shipping To" — where the goods actually go. */
  shipTo: DocumentParty;
  placeOfSupply: { code: string; name: string };
  reasonForTransport: string;
  /** The shared delivery date and slot, or null when lines differ. */
  deliveryTime: string | null;
  isMixedSchedule: boolean;
  isPickup: boolean;
  lines: ChallanLine[];
  totalQty: number;
  terms: string | null;
}

function formatDay(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** "16 Sep 2026 · 10am-1pm", or null for courier lines with no local slot. */
function scheduleLabel(item: {
  deliveryDate: Date | null;
  deliverySlotLabel: string | null;
}): string | null {
  const parts = [
    item.deliveryDate ? formatDay(item.deliveryDate) : null,
    item.deliverySlotLabel,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function sizeText(item: { sizeLabel: string | null; sizeGrams: number | null }): string | null {
  if (item.sizeLabel?.trim()) return item.sizeLabel.trim();
  if (!item.sizeGrams) return null;
  return item.sizeGrams >= 1000
    ? `${(item.sizeGrams / 1000).toFixed(item.sizeGrams % 1000 === 0 ? 0 : 2)} kg`
    : `${item.sizeGrams} g`;
}

/**
 * Builds the printable challan from order snapshots only, never live product
 * data, so a reprint months later is identical to the copy that was signed.
 */
export async function buildChallanData(
  order: OrderWithItems,
  issued: { challanNumber: string; challanDate: Date },
): Promise<ChallanData> {
  const settings = await getSellerSettings();
  const sellerAddr = asAddress(settings.registeredAddress);
  const sellerStateCode = sellerAddr.stateCode?.trim() || FALLBACK_SELLER_STATE_CODE;

  const shipAddr = asAddress(order.deliveryAddress);
  const isPickup = order.fulfillment === "PICKUP";

  // Where the goods physically go. This is NOT the place of supply: a buyer
  // registered elsewhere makes the place of supply their own state, and
  // labelling a Howrah address with it would misdescribe the consignee.
  // Left null when the address never captured a state, rather than guessed.
  const shipStateCode = normalizeStateCode(shipAddr.stateCode) ?? stateCodeFromName(shipAddr.state);

  // Same fallback the invoice uses: older orders predate `placeOfSupply`, and
  // refusing to print a challan for one would be worse than deriving it.
  const placeCode =
    order.placeOfSupply?.trim() ||
    (isPickup
      ? sellerStateCode
      : (normalizeStateCode(shipAddr.stateCode) ??
        stateCodeFromName(shipAddr.state) ??
        sellerStateCode));

  // Per-line dates mean one order can span several slots. When they agree the
  // header states it once; when they don't, each line carries its own.
  const scheduleKey = (i: OrderWithItems["items"][number]) =>
    `${i.deliveryDate?.toISOString() ?? ""}|${i.deliverySlotLabel ?? ""}`;
  const isMixedSchedule = new Set(order.items.map(scheduleKey)).size > 1;

  const lines: ChallanLine[] = order.items.map((item, idx) => {
    const details = [
      sizeText(item),
      item.flavourName,
      item.messageOnCake ? `Message: "${item.messageOnCake}"` : null,
      isMixedSchedule ? scheduleLabel(item) : null,
    ]
      .map((d) => (d ? String(d).trim() : ""))
      .filter(Boolean);

    return {
      slNo: idx + 1,
      itemName: item.productName,
      details,
      hsnCode: item.hsnCode,
      qty: item.qty,
      unit: DEFAULT_UNIT,
    };
  });

  const partyGstStateCode = order.customerGstin ? gstinStateCode(order.customerGstin) : null;

  return {
    challanNumber: issued.challanNumber,
    challanDate: issued.challanDate,
    orderNumber: order.orderNumber,
    orderDate: order.createdAt,
    invoiceNumber: order.invoiceNumber,
    seller: {
      name: settings.legalName,
      legalName: settings.tradeName,
      gstin: settings.gstin,
      addressLines: addressLines(sellerAddr),
      stateName: stateNameFromCode(sellerStateCode),
      stateCode: sellerStateCode,
      phone: settings.supportPhone,
      email: settings.supportEmail,
    },
    party: {
      name: order.customerCompanyName || order.customerName,
      gstin: order.customerGstin,
      // We never capture the buyer's registered address, only where the goods
      // go, and that belongs in the shipping block instead of being repeated
      // here as if it were their office.
      addressLines: [],
      stateName: partyGstStateCode ? stateNameFromCode(partyGstStateCode) : null,
      stateCode: partyGstStateCode,
      phone: order.customerPhone,
      email: order.customerEmail,
    },
    shipTo: {
      name: order.customerName,
      addressLines: isPickup ? ["Collected at the bakery counter"] : addressLines(shipAddr),
      stateName: isPickup || !shipStateCode ? null : stateNameFromCode(shipStateCode),
      stateCode: isPickup ? null : shipStateCode,
      phone: order.customerPhone,
      email: order.customerEmail,
    },
    placeOfSupply: {
      code: placeCode,
      name: stateNameFromCode(placeCode) ?? placeCode,
    },
    reasonForTransport: DEFAULT_TRANSPORT_REASON,
    deliveryTime: !isMixedSchedule && order.items[0] ? scheduleLabel(order.items[0]) : null,
    isMixedSchedule,
    isPickup,
    lines,
    totalQty: order.items.reduce((sum, i) => sum + i.qty, 0),
    terms: settings.challanTerms?.trim() || null,
  };
}

export async function getChallanForOrder(orderId: string): Promise<ChallanData> {
  const issued = await ensureChallanNumber(orderId);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) throw HttpError.notFound("Order not found");
  return buildChallanData(order, issued);
}

export function challanFileName(challanNumber: string): string {
  // Challan numbers contain slashes, which are not legal in filenames.
  return `${challanNumber.replace(/[^A-Za-z0-9-]+/g, "-")}.pdf`;
}

/** Issues (or reuses) the number and renders the PDF. */
export async function buildChallanPdf(orderId: string): Promise<{
  data: ChallanData;
  pdf: Buffer;
  filename: string;
}> {
  const data = await getChallanForOrder(orderId);
  const pdf = await renderChallanPdf(data);
  return { data, pdf, filename: challanFileName(data.challanNumber) };
}
