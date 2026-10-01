import PDFDocument from "pdfkit";
import type { InvoiceParty } from "./invoice.service.js";
import type { CreditNoteLine } from "./credit-note.service.js";
import {
  ACCENT,
  brandLogo,
  formatDate,
  INK,
  LOGO_BOX,
  money,
  MUTED,
  PAGE,
  partyBlock,
  RULE,
} from "./pdf.theme.js";

export interface CreditNoteData {
  creditNoteNumber: string;
  creditNoteDate: Date;
  invoiceNumber: string;
  invoiceDate: Date;
  orderNumber: string;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  placeOfSupply: { code: string; name: string };
  isIntraState: boolean;
  /** "Discount after billing" or "Refund (UPI)". */
  kindLabel: string;
  reasonLabel: string;
  note: string | null;
  lines: CreditNoteLine[];
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  amount: number;
  amountInWords: string;
  voided: { at: Date; reason: string | null } | null;
}

export function renderCreditNotePdf(data: CreditNoteData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ ...PAGE, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = PAGE.margin;
    const right = doc.page.width - PAGE.margin;
    const fullWidth = right - left;
    const hr = (y: number) => {
      doc.moveTo(left, y).lineTo(right, y).lineWidth(0.6).strokeColor(RULE).stroke();
    };

    // --- Header -----------------------------------------------------------
    const logo = brandLogo();
    if (logo) {
      doc.image(logo, left, PAGE.margin, { fit: [LOGO_BOX, LOGO_BOX] });
    } else {
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(18);
      doc.text(data.seller.name, left, PAGE.margin, { width: 300 });
    }

    doc.font("Helvetica-Bold").fontSize(15).fillColor(ACCENT);
    doc.text("CREDIT NOTE", left, PAGE.margin + 2, { width: fullWidth, align: "right" });
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED);
    const meta = (text: string) =>
      doc.text(text, left, doc.y, { width: fullWidth, align: "right" });
    meta(`Credit Note No.  ${data.creditNoteNumber}`);
    meta(`Date  ${formatDate(data.creditNoteDate)}`);
    meta(`Against invoice  ${data.invoiceNumber} · ${formatDate(data.invoiceDate)}`);
    meta(`Order  ${data.orderNumber}`);

    doc.y = Math.max(doc.y, PAGE.margin + (logo ? LOGO_BOX : 62));
    hr(doc.y + 6);
    doc.y += 14;

    // --- Seller / buyer ---------------------------------------------------
    const colWidth = (fullWidth - 20) / 2;
    const partyTop = doc.y;
    doc.fontSize(7.5).fillColor(MUTED).font("Helvetica-Bold");
    doc.text("ISSUED BY", left, partyTop);
    doc.y = partyTop + 12;
    partyBlock(
      doc,
      { ...data.seller, name: data.seller.legalName ?? data.seller.name, legalName: undefined },
      left,
      colWidth,
    );
    const sellerBottom = doc.y;

    const buyerX = left + colWidth + 20;
    doc.fontSize(7.5).fillColor(MUTED).font("Helvetica-Bold");
    doc.text("ISSUED TO", buyerX, partyTop);
    doc.y = partyTop + 12;
    partyBlock(doc, data.buyer, buyerX, colWidth);

    doc.y = Math.max(sellerBottom, doc.y) + 10;
    doc.fontSize(8.5).font("Helvetica").fillColor(MUTED);
    doc.text(
      `Place of supply: ${data.placeOfSupply.name} (${data.placeOfSupply.code})` +
        `   ·   ${data.isIntraState ? "Intra-state — CGST + SGST" : "Inter-state — IGST"}` +
        `   ·   Reverse charge: No`,
      left,
      doc.y,
      { width: fullWidth },
    );
    doc.y += 4;
    doc.font("Helvetica-Bold").fillColor(INK).text(`${data.kindLabel} · `, left, doc.y, {
      continued: true,
    });
    doc
      .font("Helvetica")
      .fillColor(MUTED)
      .text(`Reason: ${data.reasonLabel}${data.note ? ` — ${data.note}` : ""}`);
    doc.y += 8;

    // --- Lines ------------------------------------------------------------
    const cols = {
      desc: { x: left, w: 200 },
      hsn: { x: left + 200, w: 56 },
      taxable: { x: 0, w: 72 },
      gst: { x: 0, w: 92 },
      amount: { x: 0, w: 72 },
    };
    cols.amount.x = right - cols.amount.w;
    cols.gst.x = cols.amount.x - cols.gst.w;
    cols.taxable.x = cols.gst.x - cols.taxable.w;

    const headerY = doc.y;
    doc.rect(left, headerY, fullWidth, 16).fill("#faf6ec");
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(7.5);
    const th = (text: string, c: { x: number; w: number }, align: "left" | "right" = "left") =>
      doc.text(text, c.x + 2, headerY + 5, { width: c.w - 4, align });
    th("DESCRIPTION", cols.desc);
    th("HSN", cols.hsn);
    th("TAXABLE", cols.taxable, "right");
    th(data.isIntraState ? "CGST+SGST" : "IGST", cols.gst, "right");
    th("AMOUNT", cols.amount, "right");
    doc.y = headerY + 20;

    for (const line of data.lines) {
      const rowY = doc.y;
      doc.fillColor(INK).font("Helvetica").fontSize(8.5);
      doc.text(line.description, cols.desc.x + 2, rowY, { width: cols.desc.w - 4 });
      const descBottom = doc.y;
      doc.fillColor(MUTED).fontSize(8);
      doc.text(line.hsnCode ?? "—", cols.hsn.x + 2, rowY, { width: cols.hsn.w - 4 });
      doc.text(money(line.taxableValue), cols.taxable.x + 2, rowY, {
        width: cols.taxable.w - 4,
        align: "right",
      });
      const gst = data.isIntraState ? line.cgstAmount + line.sgstAmount : line.igstAmount;
      doc.text(`${money(gst)} @${line.gstRate}%`, cols.gst.x + 2, rowY, {
        width: cols.gst.w - 4,
        align: "right",
      });
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(8.5);
      doc.text(money(line.total), cols.amount.x + 2, rowY, {
        width: cols.amount.w - 4,
        align: "right",
      });
      doc.y = Math.max(descBottom, rowY + 12) + 4;
      hr(doc.y - 2);
    }

    // --- Totals -----------------------------------------------------------
    doc.y += 6;
    const totalsX = right - 210;
    const totalRow = (
      label: string,
      value: string,
      opts: { bold?: boolean; size?: number } = {},
    ) => {
      const y = doc.y;
      doc
        .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(opts.size ?? 8.5)
        .fillColor(opts.bold ? INK : MUTED);
      doc.text(label, totalsX, y, { width: 120 });
      doc.fillColor(INK).text(value, totalsX + 120, y, { width: 90, align: "right" });
      doc.y = y + (opts.size ? opts.size + 5 : 13);
    };
    totalRow("Taxable value", money(data.taxableTotal));
    if (data.isIntraState) {
      totalRow("CGST", money(data.cgstTotal));
      totalRow("SGST", money(data.sgstTotal));
    } else {
      totalRow("IGST", money(data.igstTotal));
    }
    hr(doc.y + 1);
    doc.y += 6;
    totalRow("Credit amount", money(data.amount), { bold: true, size: 11 });

    doc.y += 4;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(INK);
    doc.text("Amount in words: ", left, doc.y, { continued: true });
    doc.font("Helvetica").fillColor(MUTED).text(data.amountInWords);

    if (data.voided) {
      doc.y += 10;
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#b91c1c");
      doc.text(
        `VOID — cancelled on ${formatDate(data.voided.at)}${data.voided.reason ? `: ${data.voided.reason}` : ""}`,
        left,
        doc.y,
        { width: fullWidth },
      );
    }

    // --- Footer -----------------------------------------------------------
    doc.y += 14;
    hr(doc.y);
    doc.y += 6;
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
    doc.text(
      `This credit note reduces the value of tax invoice ${data.invoiceNumber} by the amount above, including the GST shown.`,
      left,
      doc.y,
      { width: fullWidth },
    );
    doc.text(
      "This is a computer-generated credit note and does not require a signature.",
      left,
      doc.y + 3,
      { width: fullWidth },
    );

    doc.end();
  });
}
