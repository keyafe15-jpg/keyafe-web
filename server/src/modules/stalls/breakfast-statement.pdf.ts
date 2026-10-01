import PDFDocument from "pdfkit";
import {
  ACCENT,
  brandLogo,
  formatDate,
  INK,
  money,
  MUTED,
  PAGE,
  partyBlock,
  RULE,
  type Doc,
  type DocumentParty,
} from "../orders/pdf.theme.js";

export interface BreakfastStatementData {
  seller: DocumentParty;
  billTo: DocumentParty;
  stallName: string;
  monthLabel: string;
  invoiceNumbers: string[];
  rows: { date: string; items: string; plates: number; rate: number; amount: number }[];
  totalPlates: number;
  totalAmount: number;
}

const HEADERS = ["DATE", "ON THE PLATE", "PLATES", "RATE", "AMOUNT"] as const;

/** Day-by-day breakdown sent with the month's tax invoice. Not itself an invoice. */
export function renderBreakfastStatementPdf(data: BreakfastStatementData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: PAGE.size, margin: PAGE.margin, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = PAGE.margin;
    const right = doc.page.width - PAGE.margin;
    const contentW = right - left;
    const bottom = doc.page.height - PAGE.margin - 30;

    const widths = [60, 0, 50, 70, 80];
    widths[1] = contentW - widths.reduce((s, w) => s + w, 0);
    const xs = widths.map((_, i) => left + widths.slice(0, i).reduce((s, w) => s + w, 0));

    const hr = (y: number) =>
      doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor(RULE).stroke();

    // --- Header ---------------------------------------------------------
    const logo = brandLogo();
    if (logo) doc.image(logo, right - 54, left, { fit: [54, 54] });
    doc.font("Helvetica-Bold").fontSize(15).fillColor(ACCENT);
    doc.text("BREAKFAST STATEMENT", left, left, { width: contentW - 70 });
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED);
    doc.text(`${data.monthLabel} · ${data.stallName}`, left, doc.y + 2, { width: contentW - 70 });
    doc.text(
      data.invoiceNumbers.length > 0
        ? `Tax invoice ${data.invoiceNumbers.join(", ")} · statement dated ${formatDate(new Date())}`
        : `Not a tax invoice · statement dated ${formatDate(new Date())}`,
      left,
      doc.y + 1,
      { width: contentW - 70 },
    );

    let y = Math.max(doc.y, left + 58) + 10;
    hr(y);
    y += 10;

    // --- Parties --------------------------------------------------------
    const half = (contentW - 20) / 2;
    doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED);
    doc.text("FROM", left, y, { width: half });
    doc.text("BILL TO", left + half + 20, y, { width: half });
    doc.y = y + 11;
    partyBlock(doc, data.seller, left, half);
    const sellerBottom = doc.y;
    doc.y = y + 11;
    partyBlock(doc, data.billTo, left + half + 20, half);
    y = Math.max(sellerBottom, doc.y) + 12;
    hr(y);
    y += 8;

    // --- Table ----------------------------------------------------------
    const drawHead = () => {
      doc.rect(left, y, contentW, 16).fill("#faf6ec");
      doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED);
      HEADERS.forEach((h, i) => {
        doc.text(h, xs[i]! + 4, y + 5, {
          width: widths[i]! - 8,
          align: i >= 2 ? "right" : "left",
          lineBreak: false,
        });
      });
      y += 20;
    };
    drawHead();

    for (const row of data.rows) {
      doc.font("Helvetica").fontSize(8.5);
      const h = Math.max(doc.heightOfString(row.items, { width: widths[1]! - 8 }), 11) + 6;
      if (y + h > bottom) {
        doc.addPage();
        y = PAGE.margin;
        drawHead();
      }
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(INK);
      doc.text(row.date, xs[0]! + 4, y, { width: widths[0]! - 8, lineBreak: false });
      doc.font("Helvetica").fillColor(INK);
      doc.text(row.items, xs[1]! + 4, y, { width: widths[1]! - 8 });
      doc.text(String(row.plates), xs[2]! + 4, y, {
        width: widths[2]! - 8,
        align: "right",
        lineBreak: false,
      });
      doc.fillColor(MUTED);
      doc.text(money(row.rate), xs[3]! + 4, y, {
        width: widths[3]! - 8,
        align: "right",
        lineBreak: false,
      });
      doc.font("Helvetica-Bold").fillColor(INK);
      doc.text(money(row.amount), xs[4]! + 4, y, {
        width: widths[4]! - 8,
        align: "right",
        lineBreak: false,
      });
      y += h;
      hr(y - 3);
    }

    // --- Totals ---------------------------------------------------------
    if (y + 60 > bottom) {
      doc.addPage();
      y = PAGE.margin;
    }
    y += 4;
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK);
    doc.text(`Total · ${data.rows.length} entries`, xs[1]! + 4, y, {
      width: widths[1]! - 8,
      lineBreak: false,
    });
    doc.text(String(data.totalPlates), xs[2]! + 4, y, {
      width: widths[2]! - 8,
      align: "right",
      lineBreak: false,
    });
    doc.fontSize(10.5);
    doc.text(money(data.totalAmount), xs[3]! + 4, y - 1, {
      width: widths[3]! + widths[4]! - 8,
      align: "right",
      lineBreak: false,
    });
    y += 22;
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
    doc.text(
      "Plate prices include GST. The GST breakup is on the tax invoice for this month.",
      left,
      y,
      { width: contentW },
    );

    footer(doc, data, left, contentW);
    doc.end();
  });
}

function footer(doc: Doc, data: BreakfastStatementData, left: number, contentW: number) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    // Writing inside the bottom margin would otherwise make pdfkit add a page.
    doc.page.margins.bottom = 0;
    doc.font("Helvetica").fontSize(7).fillColor(MUTED);
    doc.text(
      `${data.seller.name} · ${data.monthLabel} breakfast · page ${i + 1} of ${range.count}`,
      left,
      doc.page.height - PAGE.margin - 8,
      { width: contentW, align: "center", lineBreak: false },
    );
  }
}
