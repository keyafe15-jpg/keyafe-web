import PDFDocument from "pdfkit";
import type { ChallanData, ChallanLine } from "./challan.service.js";
import {
  ACCENT,
  brandLogo,
  formatDate,
  INK,
  MUTED,
  RULE,
  type Doc,
} from "./pdf.theme.js";

// Two copies per A4 sheet, each filling an A5 half, so one print gives the
// consignee their copy and us ours with a single cut across the middle.
const COPY_LABELS = [
  "ORIGINAL FOR CONSIGNEE",
  "DUPLICATE FOR CONSIGNOR",
] as const;

const SIDE_PAD = 22;
const BAND_PAD_TOP = 16;
const BAND_PAD_BOTTOM = 14;

// Fixed vertical budget inside one A5 band. Everything that isn't an item row
// is accounted for here, and whatever is left over is what the rows may use.
const HEADER_H = 46;
const META_H = 52;
const PARTIES_H = 58;
const TABLE_HEAD_H = 14;
const TOTALS_H = 16;
const FOOTER_H = 52;

const TABLE_HEADERS = ["SL", "ITEM", "HSN/SAC", "QTY", "UNIT"] as const;

interface Band {
  top: number;
  height: number;
}

interface Columns {
  sl: { x: number; w: number };
  item: { x: number; w: number };
  hsn: { x: number; w: number };
  qty: { x: number; w: number };
  unit: { x: number; w: number };
}

export function renderChallanPdf(data: ChallanData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Margin 0: every coordinate is computed against a band rather than the
    // page, so pdfkit's own margin-driven pagination would only get in the way.
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = SIDE_PAD;
    const right = doc.page.width - SIDE_PAD;
    const contentW = right - left;
    const bandHeight = doc.page.height / 2;

    const cols: Columns = {
      sl: { x: left, w: 22 },
      item: { x: 0, w: 0 },
      hsn: { x: 0, w: 60 },
      qty: { x: 0, w: 44 },
      unit: { x: 0, w: 38 },
    };
    cols.item.x = cols.sl.x + cols.sl.w;
    cols.item.w = contentW - cols.sl.w - cols.hsn.w - cols.qty.w - cols.unit.w;
    cols.hsn.x = cols.item.x + cols.item.w;
    cols.qty.x = cols.hsn.x + cols.hsn.w;
    cols.unit.x = cols.qty.x + cols.qty.w;

    // --- Pagination ------------------------------------------------------
    // Rows are measured up front so a long item name that wraps to three
    // lines is chunked honestly instead of overflowing the band.
    const rowHeight = (line: ChallanLine): number => {
      // Measured in bold throughout, which slightly over-estimates the muted
      // regular-weight detail run and so errs towards fewer rows per band.
      doc.font("Helvetica-Bold").fontSize(7.5);
      const h = doc.heightOfString(itemText(line), { width: cols.item.w - 6 });
      return Math.max(h, 11) + 3;
    };

    const rowsBudget =
      bandHeight -
      BAND_PAD_TOP -
      BAND_PAD_BOTTOM -
      HEADER_H -
      META_H -
      PARTIES_H -
      TABLE_HEAD_H -
      TOTALS_H -
      FOOTER_H;

    const chunksOfLines: ChallanLine[][] = [];
    let current: ChallanLine[] = [];
    let used = 0;
    for (const line of data.lines) {
      const h = rowHeight(line);
      // A single row taller than the budget still has to go somewhere, so it
      // starts a chunk of its own rather than looping forever.
      if (current.length > 0 && used + h > rowsBudget) {
        chunksOfLines.push(current);
        current = [];
        used = 0;
      }
      current.push(line);
      used += h;
    }
    chunksOfLines.push(current);

    const sheets = chunksOfLines.length;

    for (let sheet = 0; sheet < sheets; sheet++) {
      if (sheet > 0) doc.addPage();

      const lines = chunksOfLines[sheet]!;
      const isLastSheet = sheet === sheets - 1;

      COPY_LABELS.forEach((label, copyIndex) => {
        drawCopy(doc, data, {
          band: { top: copyIndex * bandHeight, height: bandHeight },
          left,
          right,
          contentW,
          cols,
          lines,
          copyLabel: label,
          isLastSheet,
          sheet: sheet + 1,
          sheets,
        });
      });

      // Cut guide between the two halves.
      doc.save();
      doc.dash(3, { space: 3 });
      doc
        .moveTo(0, bandHeight)
        .lineTo(doc.page.width, bandHeight)
        .lineWidth(0.5)
        .strokeColor(RULE)
        .stroke();
      doc.restore();

      // Below the line, so it stays clear of the upper copy's sheet marker.
      doc.font("Helvetica").fontSize(5.5).fillColor(MUTED);
      doc.text("cut here", left, bandHeight + 3, {
        width: contentW,
        align: "center",
        lineBreak: false,
      });
    }

    doc.end();
  });
}

function drawCopy(
  doc: Doc,
  data: ChallanData,
  opts: {
    band: Band;
    left: number;
    right: number;
    contentW: number;
    cols: Columns;
    lines: ChallanLine[];
    copyLabel: string;
    isLastSheet: boolean;
    sheet: number;
    sheets: number;
  },
) {
  const { band, left, right, contentW, cols, lines, copyLabel } = opts;
  const bandBottom = band.top + band.height;

  const hr = (y: number) => {
    doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor(RULE).stroke();
  };

  let y = band.top + BAND_PAD_TOP;

  // --- Header -----------------------------------------------------------
  const logo = brandLogo();
  const logoSize = 34;
  if (logo) {
    doc.image(logo, right - logoSize, y, { fit: [logoSize, logoSize] });
  }

  doc.font("Helvetica-Bold").fontSize(11).fillColor(ACCENT);
  doc.text("DELIVERY CHALLAN", left, y, { width: 220, lineBreak: false });

  doc.font("Helvetica-Bold").fontSize(6).fillColor(MUTED);
  doc.text(copyLabel, left, y + 13, { width: 220, lineBreak: false });
  doc.font("Helvetica").fontSize(5.5);
  doc.text("Not a tax invoice", left, y + 21, {
    width: 220,
    lineBreak: false,
  });

  // Seller identity sits to the right of the title, compact enough for A5.
  const sellerX = left + 230;
  const sellerW = right - sellerX - logoSize - 8;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(INK);
  doc.text(data.seller.name, sellerX, y, { width: sellerW, lineBreak: false });
  doc.font("Helvetica").fontSize(6).fillColor(MUTED);
  doc.text(
    [...data.seller.addressLines, data.seller.phone].filter(Boolean).join(" · "),
    sellerX,
    y + 10,
    { width: sellerW, height: 16 },
  );
  if (data.seller.gstin) {
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(INK);
    doc.text(`GSTIN: ${data.seller.gstin}`, sellerX, y + 28, {
      width: sellerW,
      lineBreak: false,
    });
  }

  y = band.top + BAND_PAD_TOP + HEADER_H - 6;
  hr(y);
  y += 5;

  // --- Meta -------------------------------------------------------------
  // Two columns rather than three: the delivery slot label is long enough that
  // a narrower value column clips it mid-word.
  const metaCol = contentW / 2;
  const metaRows: [string, string][][] = [
    [
      ["Challan No.", data.challanNumber],
      ["Date", formatDate(data.challanDate)],
    ],
    [
      ["Order", data.orderNumber],
      ["Tax invoice", data.invoiceNumber ?? "Not issued"],
    ],
    [
      [
        "Place of supply",
        `${data.placeOfSupply.name} (${data.placeOfSupply.code})`,
      ],
      [
        data.isPickup ? "Collection" : "Delivery",
        data.isMixedSchedule
          ? "See items"
          : data.deliveryTime ?? "To be scheduled",
      ],
    ],
    [["Reason", data.reasonForTransport]],
  ];

  metaRows.forEach((row, rowIndex) => {
    const rowY = y + rowIndex * 12;
    row.forEach(([key, value], colIndex) => {
      const x = left + colIndex * metaCol;
      doc.font("Helvetica").fontSize(6).fillColor(MUTED);
      doc.text(`${key}`, x, rowY, { width: 54, lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(INK);
      doc.text(value, x + 56, rowY, {
        width: metaCol - 62,
        height: 10,
        ellipsis: true,
      });
    });
  });

  // Transport is filled in by hand at handover, so it gets a ruled line.
  const transportY = y + 36;
  doc.font("Helvetica").fontSize(6).fillColor(MUTED);
  doc.text("Vehicle / transport", left + metaCol, transportY, {
    width: 68,
    lineBreak: false,
  });
  doc
    .moveTo(left + metaCol + 70, transportY + 7)
    .lineTo(right, transportY + 7)
    .lineWidth(0.4)
    .strokeColor(RULE)
    .stroke();

  y = band.top + BAND_PAD_TOP + HEADER_H + META_H - 8;
  hr(y);
  y += 5;

  // --- Parties ----------------------------------------------------------
  const partyW = (contentW - 16) / 2;
  const shipX = left + partyW + 16;

  compactParty(doc, "DELIVERY CHALLAN FOR", data.party, left, y, partyW);
  compactParty(doc, "SHIPPING TO", data.shipTo, shipX, y, partyW);

  y = band.top + BAND_PAD_TOP + HEADER_H + META_H + PARTIES_H - 6;
  hr(y);
  y += 4;

  // --- Items ------------------------------------------------------------
  doc.rect(left, y, contentW, 12).fill("#faf6ec");
  doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(6);
  const headerCells = [cols.sl, cols.item, cols.hsn, cols.qty, cols.unit];
  TABLE_HEADERS.forEach((text, i) => {
    const c = headerCells[i]!;
    doc.text(text, c.x + 3, y + 3.5, {
      width: c.w - 6,
      align: i >= 3 ? "right" : "left",
      lineBreak: false,
    });
  });
  y += 15;

  for (const line of lines) {
    const rowTop = y;
    // Name and details flow as one run so a row costs a single line, which is
    // what lets a normal corporate order stay on one sheet.
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(INK);
    doc.text(line.itemName, cols.item.x + 3, rowTop, {
      width: cols.item.w - 6,
      continued: line.details.length > 0,
    });
    if (line.details.length > 0) {
      doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
      doc.text(`   ·   ${line.details.join(" · ")}`, { continued: false });
    }
    const rowBottom = doc.y;

    doc.font("Helvetica").fontSize(7).fillColor(MUTED);
    doc.text(String(line.slNo), cols.sl.x + 3, rowTop, {
      width: cols.sl.w - 6,
      lineBreak: false,
    });
    doc.text(line.hsnCode ?? "—", cols.hsn.x + 3, rowTop, {
      width: cols.hsn.w - 6,
      lineBreak: false,
    });
    doc.font("Helvetica-Bold").fontSize(8).fillColor(INK);
    doc.text(String(line.qty), cols.qty.x + 3, rowTop, {
      width: cols.qty.w - 6,
      align: "right",
      lineBreak: false,
    });
    doc.font("Helvetica").fontSize(7).fillColor(MUTED);
    doc.text(line.unit, cols.unit.x + 3, rowTop, {
      width: cols.unit.w - 6,
      align: "right",
      lineBreak: false,
    });

    y = Math.max(rowBottom, rowTop + 11) + 3;
    hr(y - 2);
  }

  // --- Totals -----------------------------------------------------------
  const totalsY = bandBottom - BAND_PAD_BOTTOM - FOOTER_H - TOTALS_H + 4;
  if (opts.isLastSheet) {
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(INK);
    doc.text("Total quantity", cols.item.x + 3, totalsY, {
      width: cols.item.w + cols.hsn.w - 6,
      lineBreak: false,
    });
    doc.fontSize(8.5);
    doc.text(String(data.totalQty), cols.qty.x + 3, totalsY - 1, {
      width: cols.qty.w - 6,
      align: "right",
      lineBreak: false,
    });
    doc.font("Helvetica").fontSize(7).fillColor(MUTED);
    doc.text("Nos", cols.unit.x + 3, totalsY, {
      width: cols.unit.w - 6,
      align: "right",
      lineBreak: false,
    });
  } else {
    doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED);
    doc.text(
      `Continued on sheet ${opts.sheet + 1} of ${opts.sheets}`,
      left,
      totalsY,
      { width: contentW, align: "right", lineBreak: false },
    );
  }
  hr(totalsY + 12);

  // --- Terms and signatures ---------------------------------------------
  const footerY = bandBottom - BAND_PAD_BOTTOM - FOOTER_H + 6;
  const halfW = (contentW - 16) / 2;

  if (data.terms) {
    doc.font("Helvetica-Bold").fontSize(5.5).fillColor(MUTED);
    doc.text("TERMS", left, footerY, { width: halfW, lineBreak: false });
    doc.font("Helvetica").fontSize(5.5);
    doc.text(data.terms, left, footerY + 7, { width: halfW, height: 20 });
  }

  // Receiver's acknowledgement on the left, our authorisation on the right.
  const signTop = footerY + 26;
  doc.font("Helvetica").fontSize(5.5).fillColor(MUTED);

  doc
    .moveTo(left, signTop + 12)
    .lineTo(left + halfW - 20, signTop + 12)
    .lineWidth(0.4)
    .strokeColor(RULE)
    .stroke();
  doc.text("Received by — name, date & signature", left, signTop + 14, {
    width: halfW,
    lineBreak: false,
  });

  doc
    .moveTo(shipXOf(left, halfW), signTop + 12)
    .lineTo(right, signTop + 12)
    .lineWidth(0.4)
    .strokeColor(RULE)
    .stroke();
  doc.text(
    `For ${data.seller.name} — authorised signatory`,
    shipXOf(left, halfW),
    signTop + 14,
    { width: halfW, align: "right", lineBreak: false },
  );

  if (opts.sheets > 1) {
    doc.font("Helvetica").fontSize(5).fillColor(MUTED);
    doc.text(
      `${data.challanNumber} · sheet ${opts.sheet} of ${opts.sheets}`,
      left,
      bandBottom - BAND_PAD_BOTTOM + 2,
      { width: contentW, align: "center", lineBreak: false },
    );
  }
}

function shipXOf(left: number, halfW: number): number {
  return left + halfW + 16;
}

/** The full item-column run, kept in one place so measuring matches drawing. */
function itemText(line: ChallanLine): string {
  if (line.details.length === 0) return line.itemName;
  return `${line.itemName}   ·   ${line.details.join(" · ")}`;
}

/** Party details squeezed into an A5 band: name, GSTIN, state, phone. */
function compactParty(
  doc: Doc,
  caption: string,
  party: ChallanData["party"],
  x: number,
  y: number,
  width: number,
) {
  doc.font("Helvetica-Bold").fontSize(5.5).fillColor(MUTED);
  doc.text(caption, x, y, { width, lineBreak: false });

  doc.font("Helvetica-Bold").fontSize(8).fillColor(INK);
  doc.text(party.name, x, y + 8, { width, height: 11 });

  doc.font("Helvetica").fontSize(6).fillColor(MUTED);
  const detail = [
    ...party.addressLines,
    party.stateName ? `${party.stateName} (${party.stateCode})` : null,
    party.phone,
    party.email,
  ]
    .filter(Boolean)
    .join(" · ");
  doc.text(detail, x, y + 19, { width, height: 20 });

  if (party.gstin) {
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(INK);
    doc.text(`GSTIN: ${party.gstin}`, x, y + 40, { width, lineBreak: false });
  }
}
