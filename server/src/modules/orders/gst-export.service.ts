import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { stateNameFromCode } from "../../lib/indiaStates.js";
import { CASH_PAYMENT_METHODS } from "../../lib/paymentLabel.js";
import {
  ensureInvoiceNumber,
  financialYearLabel,
  getSellerSettings,
} from "./invoice.service.js";
import { CREDIT_NOTE_REASON_LABEL, type CreditNoteLine } from "./credit-note.service.js";

const IST = "Asia/Kolkata";

export type GstExportFormat = "xlsx" | "pdf";

export interface GstExportParams {
  /** Inclusive calendar day YYYY-MM-DD (IST). */
  from?: string;
  /** Inclusive calendar day YYYY-MM-DD (IST). */
  to?: string;
  /** FY label e.g. "26-27" or "2026-27". Overrides from/to when set. */
  fy?: string;
  format: GstExportFormat;
}

interface RegisterRow {
  invoiceNumber: string;
  invoiceDate: string;
  financialYear: string;
  orderNumber: string;
  orderDate: string;
  paymentStatus: string;
  orderStatus: string;
  buyerName: string;
  buyerGstin: string;
  placeOfSupplyCode: string;
  placeOfSupplyName: string;
  supplyType: string;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  deliveryFee: number;
  discount: number;
  grandTotal: number;
}

interface LineRow {
  invoiceNumber: string;
  invoiceDate: string;
  orderNumber: string;
  buyerGstin: string;
  hsnCode: string;
  gstRate: number;
  productName: string;
  qty: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
}

interface CreditNoteRow {
  creditNoteNumber: string;
  creditNoteDate: string;
  invoiceNumber: string;
  invoiceDate: string;
  orderNumber: string;
  buyerName: string;
  buyerGstin: string;
  placeOfSupplyCode: string;
  kind: string;
  reason: string;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  amount: number;
}

interface HsnSummaryRow {
  hsnCode: string;
  gstRate: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineCount: number;
}

function num(v: unknown): number {
  return Number(v ?? 0);
}

function formatIstDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Start of IST calendar day → UTC Date. */
function istDayStart(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00+05:30`);
}

/** Exclusive end = start of the IST day after `isoDay`. */
function istDayEndExclusive(isoDay: string): Date {
  const [y, m, d] = isoDay.split("-").map(Number);
  // Date.UTC day overflow rolls into the next month correctly.
  const next = new Date(Date.UTC(y!, m! - 1, d! + 1));
  const nextIso = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  return istDayStart(nextIso);
}

function parseFyLabel(fy: string): { startYear: number; label: string } {
  const cleaned = fy.trim();
  // "26-27" or "2026-27" or "2026-2027"
  const m = /^(\d{2}|\d{4})-(\d{2}|\d{4})$/.exec(cleaned);
  if (!m) throw HttpError.badRequest('Invalid fy. Use "26-27" or "2026-27".');
  let start = Number(m[1]);
  if (start < 100) start += 2000;
  const two = (y: number) => String(y % 100).padStart(2, "0");
  return { startYear: start, label: `${two(start)}-${two(start + 1)}` };
}

function resolveRange(
  params: GstExportParams,
  fyStartMonth: number,
): { from: Date; toExclusive: Date; label: string } {
  if (params.fy) {
    const { startYear, label } = parseFyLabel(params.fy);
    const fromIso = `${startYear}-${String(fyStartMonth).padStart(2, "0")}-01`;
    const endYear = fyStartMonth === 1 ? startYear : startYear + 1;
    const endMonth = fyStartMonth === 1 ? 12 : fyStartMonth - 1;
    // Last day of end month
    const lastDay = new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate();
    const toIso = `${endYear}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return {
      from: istDayStart(fromIso),
      toExclusive: istDayEndExclusive(toIso),
      label: `FY ${label}`,
    };
  }

  if (!params.from || !params.to) {
    throw HttpError.badRequest("Provide from+to (YYYY-MM-DD) or fy (e.g. 26-27)");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.from) || !/^\d{4}-\d{2}-\d{2}$/.test(params.to)) {
    throw HttpError.badRequest("from/to must be YYYY-MM-DD");
  }
  if (params.from > params.to) {
    throw HttpError.badRequest("from must be on or before to");
  }

  return {
    from: istDayStart(params.from),
    toExclusive: istDayEndExclusive(params.to),
    label: `${params.from} to ${params.to}`,
  };
}

function money(n: number): string {
  return n.toFixed(2);
}

/**
 * Builds a GST invoice register for the given period.
 * Issues missing invoice numbers for paid/partial non-cancelled orders
 * placed or delivered in range, then keeps rows by invoiceDate.
 *
 * Cash (COD) sales are intentionally excluded from this register — they still
 * carry GST on the order for invoices, but are left out of the CA export.
 */
export async function buildGstExport(params: GstExportParams): Promise<{
  buffer: Buffer;
  contentType: string;
  filename: string;
  meta: { orderCount: number; creditNoteCount: number; label: string };
}> {
  const settings = await getSellerSettings();
  const range = resolveRange(params, settings.fyStartMonth);

  // Non-cash paid/partial orders placed or delivered in the period that never
  // got an invoice number yet — mint one (dated by delivery) so they land in
  // this return window.
  const inRange = { gte: range.from, lt: range.toExclusive };
  const unnumbered = await prisma.order.findMany({
    where: {
      status: { not: "CANCELLED" },
      paymentStatus: { in: ["PAID", "PARTIAL"] },
      paymentMethod: { notIn: CASH_PAYMENT_METHODS },
      invoiceNumber: null,
      OR: [{ createdAt: inRange }, { items: { some: { deliveryDate: inRange } } }],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  for (const c of unnumbered) {
    await ensureInvoiceNumber(c.id);
  }

  const orders = await prisma.order.findMany({
    where: {
      status: { not: "CANCELLED" },
      paymentMethod: { notIn: CASH_PAYMENT_METHODS },
      invoiceNumber: { not: null },
      invoiceDate: { gte: range.from, lt: range.toExclusive },
    },
    include: { items: true },
    orderBy: [{ invoiceDate: "asc" }, { invoiceNumber: "asc" }],
  });

  const register: RegisterRow[] = [];
  const lines: LineRow[] = [];
  const hsnMap = new Map<string, HsnSummaryRow>();

  for (const order of orders) {
    const invoiceDate = order.invoiceDate!;
    const invoiceNumber = order.invoiceNumber!;
    const fy = financialYearLabel(invoiceDate, settings.fyStartMonth);
    const pos = order.placeOfSupply ?? "";
    const taxable = num(order.taxableAmount);
    const cgst = num(order.cgstAmount);
    const sgst = num(order.sgstAmount);
    const igst = num(order.igstAmount);

    register.push({
      invoiceNumber,
      invoiceDate: formatIstDate(invoiceDate),
      financialYear: fy,
      orderNumber: order.orderNumber,
      orderDate: formatIstDate(order.createdAt),
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
      buyerName: order.customerCompanyName?.trim() || order.customerName,
      buyerGstin: order.customerGstin?.trim() || "",
      placeOfSupplyCode: pos,
      placeOfSupplyName: pos ? (stateNameFromCode(pos) ?? "") : "",
      supplyType: igst > 0 ? "Inter-state (IGST)" : "Intra-state (CGST+SGST)",
      taxableAmount: taxable,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
      deliveryFee: order.deliveryPaidToRider ? 0 : num(order.deliveryFee),
      discount: num(order.discount),
      grandTotal: num(order.total),
    });

    for (const item of order.items) {
      const rate = num(item.gstRate);
      const tv = item.taxableValue != null ? num(item.taxableValue) : num(item.lineTotal);
      const ic = num(item.cgstAmount);
      const is_ = num(item.sgstAmount);
      const ii = num(item.igstAmount);
      const hsn = item.hsnCode?.trim() || "—";

      lines.push({
        invoiceNumber,
        invoiceDate: formatIstDate(invoiceDate),
        orderNumber: order.orderNumber,
        buyerGstin: order.customerGstin?.trim() || "",
        hsnCode: hsn,
        gstRate: rate,
        productName: item.productName,
        qty: item.qty,
        taxableValue: tv,
        cgstAmount: ic,
        sgstAmount: is_,
        igstAmount: ii,
      });

      const key = `${hsn}|${rate}`;
      const agg = hsnMap.get(key) ?? {
        hsnCode: hsn,
        gstRate: rate,
        taxableValue: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        lineCount: 0,
      };
      agg.taxableValue += tv;
      agg.cgstAmount += ic;
      agg.sgstAmount += is_;
      agg.igstAmount += ii;
      agg.lineCount += 1;
      hsnMap.set(key, agg);
    }
  }

  // Credit notes count in the period they were issued, not the invoice's.
  const notes = await prisma.creditNote.findMany({
    where: {
      voidedAt: null,
      creditNoteDate: { gte: range.from, lt: range.toExclusive },
      order: { paymentMethod: { notIn: CASH_PAYMENT_METHODS } },
    },
    include: {
      order: {
        select: {
          orderNumber: true,
          invoiceNumber: true,
          invoiceDate: true,
          customerName: true,
          customerCompanyName: true,
          customerGstin: true,
          placeOfSupply: true,
        },
      },
    },
    orderBy: [{ creditNoteDate: "asc" }, { creditNoteNumber: "asc" }],
  });

  const creditNotes: CreditNoteRow[] = [];
  for (const note of notes) {
    creditNotes.push({
      creditNoteNumber: note.creditNoteNumber,
      creditNoteDate: formatIstDate(note.creditNoteDate),
      invoiceNumber: note.order.invoiceNumber ?? "",
      invoiceDate: note.order.invoiceDate ? formatIstDate(note.order.invoiceDate) : "",
      orderNumber: note.order.orderNumber,
      buyerName: note.order.customerCompanyName?.trim() || note.order.customerName,
      buyerGstin: note.order.customerGstin?.trim() || "",
      placeOfSupplyCode: note.order.placeOfSupply ?? "",
      kind: note.kind === "REFUND" ? "Refund" : "Discount",
      reason: CREDIT_NOTE_REASON_LABEL[note.reason] + (note.note ? ` — ${note.note}` : ""),
      taxableAmount: num(note.taxableAmount),
      cgstAmount: num(note.cgstAmount),
      sgstAmount: num(note.sgstAmount),
      igstAmount: num(note.igstAmount),
      amount: num(note.amount),
    });

    for (const line of note.lines as unknown as CreditNoteLine[]) {
      if (line.isDelivery) continue;
      const hsn = line.hsnCode?.trim() || "—";
      const key = `${hsn}|${line.gstRate}`;
      const agg = hsnMap.get(key) ?? {
        hsnCode: hsn,
        gstRate: line.gstRate,
        taxableValue: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        lineCount: 0,
      };
      agg.taxableValue -= line.taxableValue;
      agg.cgstAmount -= line.cgstAmount;
      agg.sgstAmount -= line.sgstAmount;
      agg.igstAmount -= line.igstAmount;
      hsnMap.set(key, agg);
    }
  }

  const hsnSummary = [...hsnMap.values()].sort(
    (a, b) => a.hsnCode.localeCompare(b.hsnCode) || a.gstRate - b.gstRate,
  );

  const stamp = formatIstDate(new Date()).replace(/-/g, "");
  const safeLabel = range.label.replace(/[^a-zA-Z0-9_-]+/g, "_");

  const meta = {
    orderCount: register.length,
    creditNoteCount: creditNotes.length,
    label: range.label,
  };

  if (params.format === "xlsx") {
    const buffer = buildXlsx(register, lines, creditNotes, hsnSummary, settings, range.label);
    return {
      buffer,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `gst-register-${safeLabel}-${stamp}.xlsx`,
      meta,
    };
  }

  const buffer = await buildSummaryPdf(register, creditNotes, hsnSummary, settings, range.label);
  return {
    buffer,
    contentType: "application/pdf",
    filename: `gst-register-${safeLabel}-${stamp}.pdf`,
    meta,
  };
}

type Totals = { taxable: number; cgst: number; sgst: number; igst: number; total: number };

function periodTotals(register: RegisterRow[], creditNotes: CreditNoteRow[]) {
  const invoices: Totals = {
    taxable: register.reduce((s, r) => s + r.taxableAmount, 0),
    cgst: register.reduce((s, r) => s + r.cgstAmount, 0),
    sgst: register.reduce((s, r) => s + r.sgstAmount, 0),
    igst: register.reduce((s, r) => s + r.igstAmount, 0),
    total: register.reduce((s, r) => s + r.grandTotal, 0),
  };
  const credits: Totals = {
    taxable: creditNotes.reduce((s, r) => s + r.taxableAmount, 0),
    cgst: creditNotes.reduce((s, r) => s + r.cgstAmount, 0),
    sgst: creditNotes.reduce((s, r) => s + r.sgstAmount, 0),
    igst: creditNotes.reduce((s, r) => s + r.igstAmount, 0),
    total: creditNotes.reduce((s, r) => s + r.amount, 0),
  };
  const net: Totals = {
    taxable: invoices.taxable - credits.taxable,
    cgst: invoices.cgst - credits.cgst,
    sgst: invoices.sgst - credits.sgst,
    igst: invoices.igst - credits.igst,
    total: invoices.total - credits.total,
  };
  return { invoices, credits, net };
}

function buildXlsx(
  register: RegisterRow[],
  lines: LineRow[],
  creditNotes: CreditNoteRow[],
  hsnSummary: HsnSummaryRow[],
  settings: Awaited<ReturnType<typeof getSellerSettings>>,
  periodLabel: string,
): Buffer {
  const wb = XLSX.utils.book_new();
  const { invoices, credits, net } = periodTotals(register, creditNotes);
  const totalsRows = (label: string, t: Totals) => [
    [`${label}: taxable`, money(t.taxable)],
    [`${label}: CGST`, money(t.cgst)],
    [`${label}: SGST`, money(t.sgst)],
    [`${label}: IGST`, money(t.igst)],
    [`${label}: total`, money(t.total)],
  ];

  const cover = [
    ["GST invoice register"],
    ["Seller", settings.legalName],
    ["Trade name", settings.tradeName],
    ["GSTIN", settings.gstin ?? ""],
    ["Period", periodLabel],
    ["Generated (IST)", formatIstDate(new Date())],
    ["Invoice count", register.length],
    ["Credit note count", creditNotes.length],
    ["Note", "Cash/COD sales excluded from this register"],
    ["HSN summary", "Net of credit notes issued in the period"],
    [],
    ...totalsRows("Invoices", invoices),
    [],
    ...totalsRows("Credit notes", credits),
    [],
    ...totalsRows("Net", net),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cover), "Summary");

  const registerSheet = XLSX.utils.json_to_sheet(
    register.map((r) => ({
      "Invoice no.": r.invoiceNumber,
      "Invoice date": r.invoiceDate,
      FY: r.financialYear,
      "Order no.": r.orderNumber,
      "Order date": r.orderDate,
      "Payment status": r.paymentStatus,
      "Order status": r.orderStatus,
      "Buyer name": r.buyerName,
      "Buyer GSTIN": r.buyerGstin,
      "Place of supply": r.placeOfSupplyCode,
      "POS name": r.placeOfSupplyName,
      "Supply type": r.supplyType,
      Taxable: r.taxableAmount,
      CGST: r.cgstAmount,
      SGST: r.sgstAmount,
      IGST: r.igstAmount,
      "Delivery fee": r.deliveryFee,
      Discount: r.discount,
      "Grand total": r.grandTotal,
    })),
  );
  XLSX.utils.book_append_sheet(wb, registerSheet, "Invoices");

  const linesSheet = XLSX.utils.json_to_sheet(
    lines.map((r) => ({
      "Invoice no.": r.invoiceNumber,
      "Invoice date": r.invoiceDate,
      "Order no.": r.orderNumber,
      "Buyer GSTIN": r.buyerGstin,
      HSN: r.hsnCode,
      "GST %": r.gstRate,
      Product: r.productName,
      Qty: r.qty,
      Taxable: r.taxableValue,
      CGST: r.cgstAmount,
      SGST: r.sgstAmount,
      IGST: r.igstAmount,
    })),
  );
  XLSX.utils.book_append_sheet(wb, linesSheet, "Line items");

  const creditSheet = XLSX.utils.json_to_sheet(
    creditNotes.map((r) => ({
      "Credit note no.": r.creditNoteNumber,
      "Credit note date": r.creditNoteDate,
      "Invoice no.": r.invoiceNumber,
      "Invoice date": r.invoiceDate,
      "Order no.": r.orderNumber,
      "Buyer name": r.buyerName,
      "Buyer GSTIN": r.buyerGstin,
      "Place of supply": r.placeOfSupplyCode,
      Type: r.kind,
      Taxable: r.taxableAmount,
      CGST: r.cgstAmount,
      SGST: r.sgstAmount,
      IGST: r.igstAmount,
      Total: r.amount,
      Reason: r.reason,
    })),
  );
  XLSX.utils.book_append_sheet(wb, creditSheet, "Credit notes");

  const hsnSheet = XLSX.utils.json_to_sheet(
    hsnSummary.map((r) => ({
      HSN: r.hsnCode,
      "GST %": r.gstRate,
      Taxable: Number(r.taxableValue.toFixed(2)),
      CGST: Number(r.cgstAmount.toFixed(2)),
      SGST: Number(r.sgstAmount.toFixed(2)),
      IGST: Number(r.igstAmount.toFixed(2)),
      Lines: r.lineCount,
    })),
  );
  XLSX.utils.book_append_sheet(wb, hsnSheet, "HSN summary");

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

function buildSummaryPdf(
  register: RegisterRow[],
  creditNotes: CreditNoteRow[],
  hsnSummary: HsnSummaryRow[],
  settings: Awaited<ReturnType<typeof getSellerSettings>>,
  periodLabel: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text("GST invoice register", { continued: false });
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor("#333");
    doc.text(settings.legalName);
    if (settings.gstin) doc.text(`GSTIN: ${settings.gstin}`);
    doc.text(`Period: ${periodLabel}`);
    doc.text(`Invoices: ${register.length}   Credit notes: ${creditNotes.length}`);
    doc.moveDown();

    const { invoices, credits, net } = periodTotals(register, creditNotes);
    const totalsBlock = (label: string, t: Totals) => {
      doc.fontSize(11).fillColor("#000").text(label, { underline: true });
      doc.fontSize(10).fillColor("#333");
      doc.text(`Taxable: Rs. ${money(t.taxable)}`);
      doc.text(`CGST: Rs. ${money(t.cgst)}   SGST: Rs. ${money(t.sgst)}   IGST: Rs. ${money(t.igst)}`);
      doc.text(`Total: Rs. ${money(t.total)}`);
      doc.moveDown();
    };
    if (creditNotes.length > 0) {
      totalsBlock("Invoices", invoices);
      totalsBlock("Less credit notes", credits);
      totalsBlock("Net for the period", net);
    } else {
      totalsBlock("Period totals", invoices);
    }

    doc.fontSize(11).fillColor("#000").text("Invoices", { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(8).fillColor("#333");

    for (const row of register) {
      if (doc.y > 740) doc.addPage();
      doc.text(
        `${row.invoiceDate}  ${row.invoiceNumber}  ${row.buyerName.slice(0, 28)}  ` +
          `${row.buyerGstin || "B2C"}  Rs. ${money(row.grandTotal)}`,
        { width: 520 },
      );
    }

    if (creditNotes.length > 0) {
      doc.moveDown();
      doc.fontSize(11).fillColor("#000").text("Credit notes", { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(8).fillColor("#333");
      for (const row of creditNotes) {
        if (doc.y > 740) doc.addPage();
        doc.text(
          `${row.creditNoteDate}  ${row.creditNoteNumber}  against ${row.invoiceNumber}  ` +
            `${row.buyerGstin || "B2C"}  -Rs. ${money(row.amount)}  ${row.reason.slice(0, 40)}`,
          { width: 520 },
        );
      }
    }

    if (hsnSummary.length > 0) {
      doc.addPage();
      doc
        .fontSize(11)
        .fillColor("#000")
        .text(creditNotes.length > 0 ? "HSN summary (net of credit notes)" : "HSN summary", {
          underline: true,
        });
      doc.moveDown(0.3);
      doc.fontSize(8).fillColor("#333");
      for (const h of hsnSummary) {
        doc.text(
          `HSN ${h.hsnCode} @ ${h.gstRate}%  taxable Rs. ${money(h.taxableValue)}  ` +
            `CGST Rs. ${money(h.cgstAmount)}  SGST Rs. ${money(h.sgstAmount)}  IGST Rs. ${money(h.igstAmount)}`,
        );
      }
    }

    doc.moveDown();
    doc.fontSize(8).fillColor("#666").text(
      "This is a summary register for GST filing support — not a substitute for individual tax invoices.",
    );

    doc.end();
  });
}
