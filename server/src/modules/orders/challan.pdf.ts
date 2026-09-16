import PDFDocument from "pdfkit";
import type { ChallanData, ChallanLine } from "./challan.service.js";
import {
  ACCENT,
  brandLogo,
  formatDate,
  INK,
  LOGO_BOX,
  MUTED,
  PAGE,
  partyBlock,
  RULE,
} from "./pdf.theme.js";

// Room kept clear at the foot of every page for the page counter.
const FOOTER_RESERVE = 26;

const TABLE_HEADERS = ["SL", "ITEM", "HSN/SAC", "QTY", "UNIT"] as const;

export function renderChallanPdf(data: ChallanData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ ...PAGE, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = PAGE.margin;
    const right = doc.page.width - PAGE.margin;
    const fullWidth = right - left;
    const bottomLimit = doc.page.height - PAGE.margin - FOOTER_RESERVE;

    const hr = (y: number) => {
      doc.moveTo(left, y).lineTo(right, y).lineWidth(0.6).strokeColor(RULE).stroke();
    };

    const caption = (text: string, x: number, y: number, width: number) => {
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(MUTED);
      doc.text(text, x, y, { width });
    };

    // Column geometry, laid out right-to-left from the page edge so quantity
    // and unit stay flush with the margin however wide the item column gets.
    const cols = {
      sl: { x: left, w: 28 },
      item: { x: 0, w: 0 },
      hsn: { x: 0, w: 70 },
      qty: { x: 0, w: 56 },
      unit: { x: 0, w: 52 },
    };
    cols.item.x = cols.sl.x + cols.sl.w;
    cols.item.w = fullWidth - cols.sl.w - cols.hsn.w - cols.qty.w - cols.unit.w;
    cols.hsn.x = cols.item.x + cols.item.w;
    cols.qty.x = cols.hsn.x + cols.hsn.w;
    cols.unit.x = cols.qty.x + cols.qty.w;

    /**
     * Starts a new page when `needed` points won't fit above the footer.
     * Text would reflow on its own, but the ruled lines in the signature and
     * acknowledgement blocks are drawn with moveTo/lineTo, which silently
     * draw past the page edge instead of paginating.
     */
    const ensureSpace = (needed: number) => {
      if (doc.y + needed <= bottomLimit) return false;
      doc.addPage();
      doc.y = PAGE.margin;
      return true;
    };

    const drawTableHeader = () => {
      const y = doc.y;
      doc.rect(left, y, fullWidth, 16).fill("#faf6ec");
      doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(7.5);
      const cells = [cols.sl, cols.item, cols.hsn, cols.qty, cols.unit];
      TABLE_HEADERS.forEach((headerText, i) => {
        const c = cells[i]!;
        doc.text(headerText, c.x + 3, y + 5, {
          width: c.w - 6,
          align: i >= 3 ? "right" : "left",
        });
      });
      doc.y = y + 20;
    };

    // --- Masthead ---------------------------------------------------------
    // Logo sits right and the seller's details left, following the template.
    const logo = brandLogo();
    if (logo) {
      doc.image(logo, right - LOGO_BOX, PAGE.margin, { fit: [LOGO_BOX, LOGO_BOX] });
    }

    const headWidth = fullWidth - LOGO_BOX - 16;
    doc.font("Helvetica-Bold").fontSize(15).fillColor(ACCENT);
    doc.text("DELIVERY CHALLAN", left, PAGE.margin, { width: headWidth });
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
    doc.text("Not a tax invoice. Issued to accompany the goods.", left, doc.y, {
      width: headWidth,
    });

    doc.y += 8;
    partyBlock(doc, data.seller, left, headWidth);

    doc.y = Math.max(doc.y, PAGE.margin + (logo ? LOGO_BOX : 0));
    hr(doc.y + 6);
    doc.y += 12;

    // --- Document meta ----------------------------------------------------
    // Two columns of key/value pairs. The invoice reference is what ties this
    // challan to the tax invoice raised for the same order.
    const metaPairs: [string, string][] = [
      ["Challan No.", data.challanNumber],
      ["Date", formatDate(data.challanDate)],
      ["Order", `${data.orderNumber} · ${formatDate(data.orderDate)}`],
      [
        "Tax invoice",
        data.invoiceNumber ?? "Not issued yet",
      ],
      [
        data.isPickup ? "Collection time" : "Delivery time",
        data.isMixedSchedule
          ? "Multiple — see items"
          : data.deliveryTime ?? "To be scheduled",
      ],
      [
        "Place of supply",
        `${data.placeOfSupply.name} (${data.placeOfSupply.code})`,
      ],
      ["Reason for transport", data.reasonForTransport],
      ["Vehicle / transport", ""],
    ];

    const metaColWidth = (fullWidth - 20) / 2;
    const metaKeyWidth = 92;
    const metaValueWidth = metaColWidth - metaKeyWidth - 6;

    // Laid out a row at a time with the height measured from its contents.
    // Order references and slot labels are long enough to wrap, and a fixed
    // row height would let them collide with the row underneath.
    let metaY = doc.y;
    for (let i = 0; i < metaPairs.length; i += 2) {
      const row = [metaPairs[i], metaPairs[i + 1]].filter(
        (p): p is [string, string] => Boolean(p),
      );

      let rowHeight = 14;
      for (const [key, value] of row) {
        doc.font("Helvetica").fontSize(8);
        rowHeight = Math.max(
          rowHeight,
          doc.heightOfString(`${key}:`, { width: metaKeyWidth }) + 4,
        );
        if (value) {
          doc.font("Helvetica-Bold").fontSize(8);
          rowHeight = Math.max(
            rowHeight,
            doc.heightOfString(value, { width: metaValueWidth }) + 4,
          );
        }
      }

      row.forEach(([key, value], column) => {
        const x = left + column * (metaColWidth + 20);
        doc.font("Helvetica").fontSize(8).fillColor(MUTED);
        doc.text(`${key}:`, x, metaY, { width: metaKeyWidth });
        if (value) {
          doc.font("Helvetica-Bold").fillColor(INK);
          doc.text(value, x + metaKeyWidth, metaY, { width: metaValueWidth });
        } else {
          // Blank fields are filled in by hand on the printed copy.
          doc
            .moveTo(x + metaKeyWidth, metaY + 9)
            .lineTo(x + metaColWidth - 6, metaY + 9)
            .lineWidth(0.5)
            .strokeColor(RULE)
            .stroke();
        }
      });

      metaY += rowHeight;
    }
    doc.y = metaY + 4;
    hr(doc.y);
    doc.y += 12;

    // --- Parties ----------------------------------------------------------
    const partyWidth = (fullWidth - 20) / 2;
    const partyTop = doc.y;

    caption("DELIVERY CHALLAN FOR", left, partyTop, partyWidth);
    doc.y = partyTop + 12;
    partyBlock(doc, data.party, left, partyWidth);
    const partyBottom = doc.y;

    const shipX = left + partyWidth + 20;
    caption("SHIPPING TO", shipX, partyTop, partyWidth);
    doc.y = partyTop + 12;
    partyBlock(doc, data.shipTo, shipX, partyWidth);

    doc.y = Math.max(partyBottom, doc.y) + 14;

    // --- Items ------------------------------------------------------------
    drawTableHeader();

    const drawRow = (line: ChallanLine) => {
      const rowY = doc.y;
      doc.fillColor(INK).font("Helvetica").fontSize(8.5);
      doc.text(line.itemName, cols.item.x + 3, rowY, { width: cols.item.w - 6 });

      if (line.details.length > 0) {
        doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
        doc.text(line.details.join(" · "), cols.item.x + 3, doc.y, {
          width: cols.item.w - 6,
        });
      }
      const itemBottom = doc.y;

      doc.font("Helvetica").fontSize(8).fillColor(MUTED);
      doc.text(line.hsnCode ?? "—", cols.hsn.x + 3, rowY, {
        width: cols.hsn.w - 6,
      });
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(9);
      doc.text(String(line.qty), cols.qty.x + 3, rowY, {
        width: cols.qty.w - 6,
        align: "right",
      });
      doc.font("Helvetica").fontSize(8).fillColor(MUTED);
      doc.text(line.unit, cols.unit.x + 3, rowY, {
        width: cols.unit.w - 6,
        align: "right",
      });

      doc.fillColor(INK).font("Helvetica").fontSize(8);
      doc.text(String(line.slNo), cols.sl.x + 3, rowY, {
        width: cols.sl.w - 6,
      });

      doc.y = Math.max(itemBottom, rowY + 12) + 4;
      hr(doc.y - 2);
    };

    for (const line of data.lines) {
      // Long orders spill onto a second sheet; the header repeats so the
      // continuation is still readable on its own.
      if (ensureSpace(40)) drawTableHeader();
      drawRow(line);
    }

    // Total quantity — the figure the person receiving the goods counts against.
    // Kept with the table rather than orphaned onto the next page alone.
    if (ensureSpace(34)) drawTableHeader();
    doc.y += 2;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK);
    doc.text("Total quantity", cols.item.x + 3, doc.y, {
      width: cols.item.w + cols.hsn.w - 6,
    });
    const totalY = doc.y - 11;
    doc.text(String(data.totalQty), cols.qty.x + 3, totalY, {
      width: cols.qty.w - 6,
      align: "right",
    });
    doc.y = totalY + 16;
    hr(doc.y);
    doc.y += 12;

    // --- Terms and authorised signature -----------------------------------
    const signWidth = (fullWidth - 20) / 2;
    ensureSpace(96);
    const termsTop = doc.y;

    if (data.terms) {
      caption("TERMS AND CONDITIONS", left, termsTop, signWidth);
      doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
      doc.text(data.terms, left, termsTop + 12, { width: signWidth });
    }

    const signX = left + signWidth + 20;
    doc.font("Helvetica").fontSize(8).fillColor(MUTED);
    doc.text(`For, ${data.seller.name}`, signX, termsTop, {
      width: signWidth,
      align: "center",
    });
    doc
      .moveTo(signX + 20, termsTop + 58)
      .lineTo(signX + signWidth - 20, termsTop + 58)
      .lineWidth(0.5)
      .strokeColor(RULE)
      .stroke();
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
    doc.text("Authorised Signature", signX, termsTop + 62, {
      width: signWidth,
      align: "center",
    });

    doc.y = Math.max(doc.y, termsTop + 78);
    hr(doc.y);
    doc.y += 12;

    // --- Acknowledgement blocks -------------------------------------------
    // Filled in by hand at handover; this is the part that makes the challan
    // proof of delivery rather than just a packing list.
    const ackFields = ["Name", "Comment", "Date", "Signature"];
    const ackBlock = (title: string, x: number, width: number, top: number) => {
      caption(title, x, top, width);
      doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
      ackFields.forEach((field, i) => {
        const y = top + 14 + i * 14;
        doc.text(`${field}:`, x, y, { width: 48 });
        doc
          .moveTo(x + 50, y + 8)
          .lineTo(x + width - 6, y + 8)
          .lineWidth(0.5)
          .strokeColor(RULE)
          .stroke();
      });
    };

    ensureSpace(14 + ackFields.length * 14 + 10);
    const ackTop = doc.y;
    ackBlock("RECEIVED BY", left, signWidth, ackTop);
    ackBlock("DELIVERED BY", signX, signWidth, ackTop);
    doc.y = ackTop + 14 + ackFields.length * 14 + 6;

    // --- Page numbers -----------------------------------------------------
    // Only meaningful once the items have spilled over a page.
    const range = doc.bufferedPageRange();
    if (range.count > 1) {
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.font("Helvetica").fontSize(7).fillColor(MUTED);
        doc.text(
          `${data.challanNumber}  ·  Page ${i + 1} of ${range.count}`,
          left,
          doc.page.height - PAGE.margin - 10,
          { width: fullWidth, align: "right", lineBreak: false },
        );
      }
    }

    doc.end();
  });
}
