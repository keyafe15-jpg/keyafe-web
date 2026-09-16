import PDFDocument from "pdfkit";
import type { InvoiceData, InvoiceParty } from "./invoice.service.js";
import path from "path";

// A4 at 72dpi, with a margin that leaves room for the footer declaration.
const PAGE = { size: "A4" as const, margin: 40 };
const INK = "#2c3540";
const MUTED = "#7d8590";
const RULE = "#d8d2c4";
const ACCENT = "#e31c79";

// Rupee glyph is missing from PDF's built-in Helvetica, so amounts are printed
// with "Rs." rather than a box. Embedding a Unicode font would be the fix if a
// rupee sign is ever required.
function money(v: number): string {
  const sign = v < 0 ? "-" : "";
  return `${sign}Rs. ${Math.abs(v).toFixed(2)}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type Doc = PDFKit.PDFDocument;

function partyBlock(doc: Doc, party: InvoiceParty, x: number, width: number) {
  doc.fillColor(INK).fontSize(9.5).font("Helvetica-Bold");
  doc.text(party.name, x, doc.y, { width });
  doc.font("Helvetica").fillColor(MUTED).fontSize(8.5);

  if (party.legalName && party.legalName !== party.name) {
    doc.text(party.legalName, x, doc.y, { width });
  }
  for (const line of party.addressLines) {
    doc.text(line, x, doc.y, { width });
  }
  if (party.stateName) {
    doc.text(`${party.stateName} (${party.stateCode})`, x, doc.y, { width });
  }
  if (party.phone) doc.text(party.phone, x, doc.y, { width });
  if (party.email) doc.text(party.email, x, doc.y, { width });
  if (party.gstin) {
    doc.font("Helvetica-Bold").fillColor(INK);
    doc.text(`GSTIN: ${party.gstin}`, x, doc.y + 2, { width });
  }
}

export function renderInvoicePdf(data: InvoiceData): Promise<Buffer> {
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
    // Masthead carries the trade name; the registered legal name belongs in
    // the "Sold by" block below, so it isn't printed twice.
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(18);
    const imagePath = path.join(import.meta.dirname, 'images', 'logo.png');
    doc.image( imagePath, 30,30,{
      fit: [70, 70],
    });

    doc.font("Helvetica-Bold").fontSize(15).fillColor(ACCENT);
    doc.text(data.title.toUpperCase(), left, PAGE.margin + 2, {
      width: fullWidth,
      align: "right",
    });
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED);
    doc.text(`Invoice No.  ${data.invoiceNumber}`, left, doc.y, {
      width: fullWidth,
      align: "right",
    });
    doc.text(`Invoice Date  ${formatDate(data.invoiceDate)}`, left, doc.y, {
      width: fullWidth,
      align: "right",
    });
    doc.text(
      `Order  ${data.orderNumber} · ${formatDate(data.orderDate)}`,
      left,
      doc.y,
      { width: fullWidth, align: "right" },
    );

    doc.y = Math.max(doc.y, PAGE.margin + 62);
    hr(doc.y + 6);
    doc.y += 14;

    // --- Seller / buyer ---------------------------------------------------
    const colWidth = (fullWidth - 20) / 2;
    const partyTop = doc.y;

    doc.fontSize(7.5).fillColor(MUTED).font("Helvetica-Bold");
    doc.text("SOLD BY", left, partyTop);
    doc.y = partyTop + 12;
    partyBlock(
      doc,
      // The legal name is the one that matters here; the masthead above
      // already shows the trade name.
      { ...data.seller, name: data.seller.legalName ?? data.seller.name, legalName: undefined },
      left,
      colWidth,
    );
    const sellerBottom = doc.y;

    const buyerX = left + colWidth + 20;
    doc.fontSize(7.5).fillColor(MUTED).font("Helvetica-Bold");
    doc.text("BILLED TO", buyerX, partyTop);
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
    doc.y += 8;

    // --- Line items -------------------------------------------------------
    // Columns are laid out right-to-left from the page edge so the amount
    // column always ends flush with the margin.
    const showGst = !data.isLegacyOrder;
    const cols = {
      desc: { x: left, w: showGst ? 168 : 250 },
      hsn: { x: left + (showGst ? 168 : 250), w: 52 },
      qty: { x: 0, w: 28 },
      rate: { x: 0, w: 58 },
      taxable: { x: 0, w: 62 },
      gst: { x: 0, w: 74 },
      amount: { x: 0, w: 66 },
    };
    cols.qty.x = cols.hsn.x + cols.hsn.w;
    cols.rate.x = cols.qty.x + cols.qty.w;
    cols.taxable.x = cols.rate.x + cols.rate.w;
    cols.gst.x = cols.taxable.x + cols.taxable.w;
    cols.amount.x = right - cols.amount.w;

    const headerY = doc.y;
    doc.rect(left, headerY, fullWidth, 16).fill("#faf6ec");
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(7.5);
    const th = (text: string, c: { x: number; w: number }, align: "left" | "right" = "left") =>
      doc.text(text, c.x + 2, headerY + 5, { width: c.w - 4, align });
    th("DESCRIPTION", cols.desc);
    th("HSN", cols.hsn);
    th("QTY", cols.qty, "right");
    th("RATE", cols.rate, "right");
    if (showGst) {
      th("TAXABLE", cols.taxable, "right");
      th(data.isIntraState ? "CGST+SGST" : "IGST", cols.gst, "right");
    }
    th("AMOUNT", cols.amount, "right");

    doc.y = headerY + 20;

    for (const line of data.lines) {
      const rowY = doc.y;
      doc.fillColor(INK).font("Helvetica").fontSize(8.5);
      doc.text(line.description, cols.desc.x + 2, rowY, {
        width: cols.desc.w - 4,
      });
      const descBottom = doc.y;

      doc.fillColor(MUTED).fontSize(8);
      doc.text(line.hsnCode ?? "—", cols.hsn.x + 2, rowY, {
        width: cols.hsn.w - 4,
      });
      doc.text(String(line.qty), cols.qty.x + 2, rowY, {
        width: cols.qty.w - 4,
        align: "right",
      });
      doc.text(money(line.unitPrice), cols.rate.x + 2, rowY, {
        width: cols.rate.w - 4,
        align: "right",
      });
      if (showGst) {
        doc.text(money(line.taxableValue), cols.taxable.x + 2, rowY, {
          width: cols.taxable.w - 4,
          align: "right",
        });
        const gstAmount = data.isIntraState
          ? line.cgstAmount + line.sgstAmount
          : line.igstAmount;
        doc.text(
          `${money(gstAmount)} @${line.gstRate}%`,
          cols.gst.x + 2,
          rowY,
          { width: cols.gst.w - 4, align: "right" },
        );
      }
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(8.5);
      doc.text(money(line.lineTotal), cols.amount.x + 2, rowY, {
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
      doc.fillColor(INK).text(value, totalsX + 120, y, {
        width: 90,
        align: "right",
      });
      doc.y = y + (opts.size ? opts.size + 5 : 13);
    };

    // Gated on whether GST was charged, not on whether a per-line split
    // exists: legacy orders have no line detail but still carry real tax.
    const hasTax =
      data.cgstTotal > 0 || data.sgstTotal > 0 || data.igstTotal > 0;
    if (hasTax) totalRow("Taxable value", money(data.taxableTotal));
    if (data.discount > 0) {
      totalRow(
        data.couponCode ? `Discount (${data.couponCode})` : "Discount",
        `-${money(data.discount).replace("-", "")}`,
      );
    }
    if (hasTax) {
      if (data.isIntraState) {
        totalRow("CGST", money(data.cgstTotal));
        totalRow("SGST", money(data.sgstTotal));
      } else {
        totalRow("IGST", money(data.igstTotal));
      }
    }
    if (data.deliveryFee > 0) {
      totalRow("Delivery charge", money(data.deliveryFee));
    }
    if (data.roundOff !== 0) totalRow("Round off", money(data.roundOff));

    hr(doc.y + 1);
    doc.y += 6;
    totalRow("Total", money(data.grandTotal), { bold: true, size: 11 });

    if (data.amountPaid > 0 || data.balanceDue > 0) {
      totalRow("Amount paid", money(data.amountPaid));
      if (data.balanceDue > 0) {
        totalRow("Balance due", money(data.balanceDue), { bold: true });
      }
    }

    doc.y += 4;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(INK);
    doc.text("Amount in words: ", left, doc.y, { continued: true });
    doc.font("Helvetica").fillColor(MUTED).text(data.amountInWords);
    doc.y += 6;

    // --- HSN rate-wise summary -------------------------------------------
    if (data.hsnSummary.length > 0) {
      doc.y += 6;
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(MUTED);
      doc.text("HSN / RATE-WISE TAX SUMMARY", left, doc.y);
      doc.y += 6;

      // Inter-state invoices have one tax column instead of two, so the
      // header bar is sized to the columns actually in use.
      const labels = data.isIntraState
        ? ["HSN", "RATE", "TAXABLE", "CGST", "SGST"]
        : ["HSN", "RATE", "TAXABLE", "IGST"];
      const sw = [78, 50, 78, 78, 78].slice(0, labels.length);
      const sx: number[] = [left];
      for (let i = 1; i < sw.length; i++) sx[i] = sx[i - 1]! + sw[i - 1]!;

      const sHeaderY = doc.y;
      doc
        .rect(left, sHeaderY, sw.reduce((a, b) => a + b, 0), 14)
        .fill("#faf6ec");
      doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(7);
      labels.forEach((label, i) => {
        doc.text(label, sx[i]! + 2, sHeaderY + 4, {
          width: sw[i]! - 4,
          align: i === 0 ? "left" : "right",
        });
      });
      doc.y = sHeaderY + 17;

      for (const row of data.hsnSummary) {
        const y = doc.y;
        doc.font("Helvetica").fontSize(8).fillColor(INK);
        const cells = data.isIntraState
          ? [
              row.hsnCode,
              `${row.gstRate}%`,
              money(row.taxableValue),
              money(row.cgstAmount),
              money(row.sgstAmount),
            ]
          : [
              row.hsnCode,
              `${row.gstRate}%`,
              money(row.taxableValue),
              money(row.igstAmount),
            ];
        cells.forEach((cell, i) => {
          doc.text(cell, sx[i]! + 2, y, {
            width: sw[i]! - 4,
            align: i === 0 ? "left" : "right",
          });
        });
        doc.y = y + 12;
      }
    }

    // --- Footer -----------------------------------------------------------
    doc.y += 10;
    hr(doc.y);
    doc.y += 6;
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
    doc.text(
      `Payment: ${data.paymentMethod.toUpperCase()} · ${data.paymentStatus}`,
      left,
      doc.y,
      { width: fullWidth },
    );
    if (data.compositionNote) {
      doc.font("Helvetica-Bold").fillColor(INK);
      doc.text(data.compositionNote, left, doc.y + 3, { width: fullWidth });
      doc.font("Helvetica").fillColor(MUTED);
    }
    if (data.isLegacyOrder) {
      doc.text(
        hasTax
          ? "This order predates per-line tax capture, so the GST above is the order total rather than an HSN-wise split."
          : "This order predates per-line tax capture and no GST was recorded against it.",
        left,
        doc.y + 3,
        { width: fullWidth },
      );
    }
    doc.text(
      data.title === "Tax Invoice"
        ? "Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct."
        : "This is not a tax invoice.",
      left,
      doc.y + 3,
      { width: fullWidth },
    );
    doc.text(
      "This is a computer-generated invoice and does not require a signature.",
      left,
      doc.y + 3,
      { width: fullWidth },
    );

    doc.end();
  });
}
