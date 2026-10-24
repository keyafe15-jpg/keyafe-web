import PDFDocument from "pdfkit";
import { qtyNum, unitLabel } from "./recipe.shared.js";

const A5 = { width: 419.53, height: 595.28 };
const MARGIN = 16;
const GAP = 8;
const INK = "#1e293b";
const MUTED = "#64748b";
const RULE = "#cbd5e1";
const HEAD = "#fde047";

type PrintVersion = {
  label: string;
  yieldQty: { toString(): string } | number | null;
  yieldUnit: string | null;
  yieldNote: string | null;
  ingredients: {
    name: string;
    qty: { toString(): string } | number;
    unit: string;
    componentRecipe: { name: string } | null;
  }[];
  steps: { text: string }[];
  usageRows: {
    axis1: string;
    axis2: string | null;
    qty: { toString(): string } | number;
    unit: string;
  }[];
  recipe: { name: string; category: { name: string } };
};

export type SlotSize = "quarter" | "half" | "full";

export function cardScore(v: PrintVersion): number {
  const longStep = v.steps.some((s) => s.text.length > 80);
  return v.ingredients.length + v.steps.length + v.usageRows.length + (longStep ? 8 : 0);
}

export function slotFor(v: PrintVersion): SlotSize {
  const score = cardScore(v);
  if (score <= 12 && !v.steps.some((s) => s.text.length > 80)) return "quarter";
  if (score <= 24) return "half";
  return "full";
}

function fmtQty(qty: { toString(): string } | number, unit: string) {
  const n = qtyNum(qty);
  const shown =
    n === 0.25 ? "¼" : n === 0.5 ? "½" : n === 0.75 ? "¾" : String(n);
  return `${shown} ${unitLabel(unit)}`;
}

function packPages(items: { version: PrintVersion; slot: SlotSize }[]): PrintVersion[][] {
  const pages: PrintVersion[][] = [];
  let i = 0;
  while (i < items.length) {
    const slot = items[i]!.slot;
    const take = slot === "full" ? 1 : slot === "half" ? 2 : 4;
    const page: PrintVersion[] = [];
    while (page.length < take && i < items.length && items[i]!.slot === slot) {
      page.push(items[i]!.version);
      i += 1;
    }
    pages.push(page);
  }
  return pages;
}

function drawCard(
  doc: PDFKit.PDFDocument,
  v: PrintVersion,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  doc.save();
  doc.rect(x, y, w, h).lineWidth(0.6).strokeColor(RULE).stroke();
  doc.rect(x, y, w, 16).fill(HEAD);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(8);
  const title = v.recipe.name + (v.label && v.label !== "v1" ? `  ${v.label}` : "");
  doc.text(title, x + 4, y + 4, { width: w - 8, height: 12, ellipsis: true });
  let cy = y + 20;
  doc.font("Helvetica").fontSize(6.5).fillColor(MUTED);
  const yieldBits = [
    v.recipe.category.name,
    v.yieldQty != null && v.yieldUnit ? `makes ${fmtQty(v.yieldQty, v.yieldUnit)}` : null,
    v.yieldNote,
  ].filter(Boolean);
  if (yieldBits.length) {
    doc.text(yieldBits.join(" · "), x + 4, cy, { width: w - 8 });
    cy = doc.y + 3;
  }

  const col = (w - 8) * 0.62;
  doc.font("Helvetica").fontSize(7).fillColor(INK);
  for (const line of v.ingredients) {
    if (cy > y + h - 10) break;
    const name = line.componentRecipe?.name ?? line.name;
    doc.text(name, x + 4, cy, { width: col, ellipsis: true });
    doc.text(fmtQty(line.qty, line.unit), x + 4 + col, cy, { width: w - 12 - col, align: "right" });
    cy += 10;
  }

  if (v.usageRows.length && cy < y + h - 16) {
    cy += 2;
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(MUTED);
    doc.text("Portions", x + 4, cy, { width: w - 8 });
    cy = doc.y + 1;
    doc.font("Helvetica").fontSize(6.5).fillColor(INK);
    for (const u of v.usageRows) {
      if (cy > y + h - 10) break;
      const label = [u.axis2, u.axis1].filter(Boolean).join(" · ");
      doc.text(label, x + 4, cy, { width: col, ellipsis: true });
      doc.text(fmtQty(u.qty, u.unit), x + 4 + col, cy, { width: w - 12 - col, align: "right" });
      cy += 9;
    }
  }

  if (v.steps.length && cy < y + h - 16) {
    cy += 2;
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(MUTED);
    doc.text("Process", x + 4, cy, { width: w - 8 });
    cy = doc.y + 1;
    doc.font("Helvetica").fontSize(6.5).fillColor(INK);
    for (const [i, s] of v.steps.entries()) {
      if (cy > y + h - 10) break;
      doc.text(`${i + 1}. ${s.text}`, x + 4, cy, { width: w - 8, ellipsis: true, height: 18 });
      cy = doc.y + 1;
    }
  }
  doc.restore();
}

function layoutFor(count: number, slot: SlotSize): { x: number; y: number; w: number; h: number }[] {
  const usableW = A5.width - MARGIN * 2;
  const usableH = A5.height - MARGIN * 2;
  if (slot === "full") {
    return [{ x: MARGIN, y: MARGIN, w: usableW, h: usableH }];
  }
  if (slot === "half") {
    const h = (usableH - GAP) / 2;
    return [0, 1].slice(0, count).map((i) => ({
      x: MARGIN,
      y: MARGIN + i * (h + GAP),
      w: usableW,
      h,
    }));
  }
  const w = (usableW - GAP) / 2;
  const h = (usableH - GAP) / 2;
  return [
    { x: MARGIN, y: MARGIN, w, h },
    { x: MARGIN + w + GAP, y: MARGIN, w, h },
    { x: MARGIN, y: MARGIN + h + GAP, w, h },
    { x: MARGIN + w + GAP, y: MARGIN + h + GAP, w, h },
  ].slice(0, count);
}

export function renderRecipePdf(versions: PrintVersion[]): Promise<Buffer> {
  const tagged = versions.map((v) => ({ version: v, slot: slotFor(v) }));
  const pages = packPages(tagged);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A5", margin: 0, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    pages.forEach((page, i) => {
      if (i > 0) doc.addPage({ size: "A5", margin: 0 });
      const slots = page.map((v) => slotFor(v));
      const dominant: SlotSize = slots.includes("full")
        ? "full"
        : slots.includes("half")
          ? "half"
          : "quarter";
      const boxes = layoutFor(page.length, dominant);
      page.forEach((v, idx) => {
        const box = boxes[idx];
        if (box) drawCard(doc, v, box.x, box.y, box.w, box.h);
      });
    });

    doc.end();
  });
}
