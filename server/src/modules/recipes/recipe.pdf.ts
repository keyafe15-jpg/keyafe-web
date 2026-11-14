import PDFDocument from "pdfkit";
import { kitchenIngredientName, qtyNum, unitLabel } from "./recipe.shared.js";

const A5 = { width: 419.53, height: 595.28 };
const MARGIN_LEFT = 60;
const MARGIN_RIGHT = 42;
const MARGIN_Y = 42;
const GAP = 8;
const INK = "#1e293b";
const MUTED = "#64748b";
const RULE = "#cbd5e1";
const HEAD = "#fde047";
const HEADER_H = 16;
const PAD = 4;

type PrintQtyRow = {
  sizeId: string;
  qty: { toString(): string } | number | null;
};

type PrintVersion = {
  label: string;
  yieldQty: { toString(): string } | number | null;
  yieldUnit: string | null;
  yieldNote: string | null;
  sizes?: { id: string; label: string; sortOrder: number }[];
  ingredients: {
    name: string;
    qty: { toString(): string } | number;
    unit: string;
    buyItem?: { alias?: string | null } | null;
    componentRecipe: { name: string } | null;
    extraQtys?: PrintQtyRow[] | (number | null)[];
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

type Box = { x: number; y: number; w: number; h: number };

type Flow = {
  v: PrintVersion;
  ing: number;
  usage: number;
  step: number;
  wroteMeta: boolean;
  wroteIngHead: boolean;
  wroteUsageHead: boolean;
  wroteStepHead: boolean;
};

function pageBox(): Box {
  return {
    x: MARGIN_LEFT,
    y: MARGIN_Y,
    w: A5.width - MARGIN_LEFT - MARGIN_RIGHT,
    h: A5.height - MARGIN_Y * 2,
  };
}

function quarterBoxes(): Box[] {
  const { x, y, w, h } = pageBox();
  const cw = (w - GAP) / 2;
  const ch = (h - GAP) / 2;
  return [
    { x, y, w: cw, h: ch },
    { x: x + cw + GAP, y, w: cw, h: ch },
    { x, y: y + ch + GAP, w: cw, h: ch },
    { x: x + cw + GAP, y: y + ch + GAP, w: cw, h: ch },
  ];
}

function bandBoxes(): Box[] {
  const { x, y, w, h } = pageBox();
  const bh = (h - GAP * 2) / 3;
  return [0, 1, 2].map((i) => ({
    x,
    y: y + i * (bh + GAP),
    w,
    h: bh,
  }));
}

const KITCHEN_FRACTIONS: [number, string][] = [
  [0.125, "1/8"],
  [0.25, "1/4"],
  [1 / 3, "1/3"],
  [0.375, "3/8"],
  [0.5, "1/2"],
  [0.625, "5/8"],
  [2 / 3, "2/3"],
  [0.75, "3/4"],
  [0.875, "7/8"],
];

function kitchenQtyLabel(qty: number) {
  const n = Math.round(qty * 1000) / 1000;
  const match = (x: number) => KITCHEN_FRACTIONS.find(([v]) => Math.abs(x - v) < 0.0005)?.[1];
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  if (whole > 0 && frac > 0.0005) {
    const f = match(frac);
    if (f) return `${whole} ${f}`;
  }
  return match(n) ?? String(n);
}

function fmtQty(qty: { toString(): string } | number, unit: string) {
  return `${kitchenQtyLabel(qtyNum(qty))} ${unitLabel(unit)}`;
}

function sortedSizes(v: PrintVersion) {
  return [...(v.sizes ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
}

function hasSizeTable(v: PrintVersion) {
  return sortedSizes(v).length >= 2;
}

function qtyCells(v: PrintVersion, line: PrintVersion["ingredients"][number]): (number | null)[] {
  const sizes = sortedSizes(v);
  const first = qtyNum(line.qty);
  if (sizes.length < 2) return [first > 0 ? first : null];
  const extras = line.extraQtys ?? [];
  const bySize = new Map<string, number | null>();
  for (const cell of extras) {
    if (cell != null && typeof cell === "object" && "sizeId" in cell) {
      const n = cell.qty == null ? 0 : qtyNum(cell.qty);
      bySize.set(cell.sizeId, n > 0 ? n : null);
    }
  }
  const rest = sizes.slice(1).map((s, i) => {
    if (bySize.has(s.id)) return bySize.get(s.id) ?? null;
    const cell = extras[i];
    if (typeof cell === "number") return cell > 0 ? cell : null;
    if (cell == null) return null;
    return null;
  });
  return [first > 0 ? first : null, ...rest];
}

function fmtCell(qty: number | null, unit: string) {
  return qty != null && qty > 0 ? fmtQty(qty, unit) : "";
}

function titleOf(v: PrintVersion, cont = false) {
  return (
    v.recipe.name +
    (v.label && v.label !== "v1" ? `  ${v.label}` : "") +
    (cont ? "  (cont.)" : "")
  );
}

function yieldLine(v: PrintVersion) {
  return [
    v.recipe.category.name,
    v.yieldQty != null && v.yieldUnit ? `makes ${fmtQty(v.yieldQty, v.yieldUnit)}` : null,
    v.yieldNote,
  ]
    .filter(Boolean)
    .join(" · ");
}

function startFlow(v: PrintVersion): Flow {
  return {
    v,
    ing: 0,
    usage: 0,
    step: 0,
    wroteMeta: false,
    wroteIngHead: false,
    wroteUsageHead: false,
    wroteStepHead: false,
  };
}

function isCont(flow: Flow) {
  return (
    flow.wroteMeta ||
    flow.ing > 0 ||
    flow.usage > 0 ||
    flow.step > 0 ||
    flow.wroteIngHead ||
    flow.wroteUsageHead ||
    flow.wroteStepHead
  );
}

function measureHeight(doc: PDFKit.PDFDocument, v: PrintVersion, w: number): number {
  const inner = Math.max(8, w - PAD * 2);
  const col = inner * 0.62;
  let h = HEADER_H + PAD;
  const meta = yieldLine(v);
  if (meta) {
    doc.font("Helvetica").fontSize(6.5);
    h += doc.heightOfString(meta, { width: inner }) + 3;
  }
  doc.font("Helvetica").fontSize(7);
  const nameW = hasSizeTable(v) ? inner * 0.46 : col;
  if (hasSizeTable(v)) {
    h += 11;
  }
  for (const line of v.ingredients) {
    const name = kitchenIngredientName(line);
    h += Math.max(10, doc.heightOfString(name, { width: nameW }));
  }
  if (v.usageRows.length) {
    h += 2;
    doc.font("Helvetica-Bold").fontSize(6.5);
    h += doc.heightOfString("Portions", { width: inner }) + 1;
    doc.font("Helvetica").fontSize(6.5);
    for (const u of v.usageRows) {
      const label = [u.axis2, u.axis1].filter(Boolean).join(" · ");
      h += Math.max(9, doc.heightOfString(label, { width: col }));
    }
  }
  if (v.steps.length) {
    h += 2;
    doc.font("Helvetica-Bold").fontSize(6.5);
    h += doc.heightOfString("Process", { width: inner }) + 1;
    doc.font("Helvetica").fontSize(6.5);
    for (const [i, s] of v.steps.entries()) {
      h += doc.heightOfString(`${i + 1}. ${s.text}`, { width: inner }) + 1;
    }
  }
  return h + PAD;
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  v: PrintVersion,
  x: number,
  y: number,
  w: number,
  cont = false,
) {
  doc.rect(x, y, w, HEADER_H).fill(HEAD);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(8);
  doc.text(titleOf(v, cont), x + PAD, y + 4, { width: w - PAD * 2, height: 12, ellipsis: true });
}

/** Draw as much of `flow` as fits in `box`. Returns leftover flow, or null if finished. */
function drawInto(doc: PDFKit.PDFDocument, flow: Flow, box: Box): Flow | null {
  const { x, y, w, h } = box;
  const bottom = y + h;
  const inner = Math.max(8, w - PAD * 2);
  const col = inner * 0.62;
  const { v } = flow;
  let cy = y + HEADER_H + PAD;

  doc.save();
  doc.rect(x, y, w, h).clip();
  drawHeader(doc, v, x, y, w, isCont(flow));

  const fits = (need: number) => cy + need <= bottom - PAD;
  const atTop = () => cy <= y + HEADER_H + PAD + 0.5;

  if (!flow.wroteMeta) {
    const meta = yieldLine(v);
    if (meta) {
      doc.font("Helvetica").fontSize(6.5);
      const mh = doc.heightOfString(meta, { width: inner }) + 3;
      if (!fits(mh) && !atTop()) {
        doc.restore();
        doc.rect(x, y, w, h).lineWidth(0.6).strokeColor(RULE).stroke();
        return flow;
      }
      doc.font("Helvetica").fontSize(6.5).fillColor(MUTED);
      doc.text(meta, x + PAD, cy, { width: inner });
      cy = doc.y + 3;
    }
    flow = { ...flow, wroteMeta: true };
  }

  const table = hasSizeTable(v);
  const sizes = sortedSizes(v);
  const nameW = table ? inner * 0.46 : col;
  const qtyW = table ? (inner - nameW) / sizes.length : inner - col;

  if (table && !flow.wroteIngHead) {
    doc.font("Helvetica-Bold").fontSize(6.5);
    const hh = 11;
    if (!fits(hh) && !atTop()) {
      doc.restore();
      doc.rect(x, y, w, h).lineWidth(0.6).strokeColor(RULE).stroke();
      return flow;
    }
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(MUTED);
    doc.text("Ingredients", x + PAD, cy, { width: nameW });
    sizes.forEach((s, i) => {
      doc.text(s.label, x + PAD + nameW + i * qtyW, cy, { width: qtyW, align: "right" });
    });
    cy += hh;
    flow = { ...flow, wroteIngHead: true };
  }

  doc.font("Helvetica").fontSize(7).fillColor(INK);
  while (flow.ing < v.ingredients.length) {
    const line = v.ingredients[flow.ing]!;
    const name = kitchenIngredientName(line);
    const lineH = Math.max(10, doc.heightOfString(name, { width: nameW }));
    if (!fits(lineH) && !atTop()) break;
    doc.font("Helvetica").fontSize(7).fillColor(INK);
    doc.text(name, x + PAD, cy, { width: nameW });
    if (table) {
      const cells = qtyCells(v, line);
      cells.forEach((q, i) => {
        doc.text(fmtCell(q, line.unit), x + PAD + nameW + i * qtyW, cy, {
          width: qtyW,
          align: "right",
        });
      });
    } else {
      doc.text(fmtQty(line.qty, line.unit), x + PAD + col, cy, {
        width: inner - col,
        align: "right",
      });
    }
    cy += lineH;
    flow = { ...flow, ing: flow.ing + 1 };
  }

  if (flow.ing >= v.ingredients.length && v.usageRows.length) {
    if (!flow.wroteUsageHead) {
      doc.font("Helvetica-Bold").fontSize(6.5);
      const hh = doc.heightOfString("Portions", { width: inner }) + 3;
      if (!fits(hh) && !atTop()) {
        doc.restore();
        doc.rect(x, y, w, h).lineWidth(0.6).strokeColor(RULE).stroke();
        return flow;
      }
      cy += 2;
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(MUTED);
      doc.text("Portions", x + PAD, cy, { width: inner });
      cy = doc.y + 1;
      flow = { ...flow, wroteUsageHead: true };
    }
    while (flow.usage < v.usageRows.length) {
      const u = v.usageRows[flow.usage]!;
      const label = [u.axis2, u.axis1].filter(Boolean).join(" · ");
      doc.font("Helvetica").fontSize(6.5);
      const lineH = Math.max(9, doc.heightOfString(label, { width: col }));
      if (!fits(lineH) && !atTop()) break;
      doc.font("Helvetica").fontSize(6.5).fillColor(INK);
      doc.text(label, x + PAD, cy, { width: col });
      doc.text(fmtQty(u.qty, u.unit), x + PAD + col, cy, {
        width: inner - col,
        align: "right",
      });
      cy += lineH;
      flow = { ...flow, usage: flow.usage + 1 };
    }
  }

  const usageDone = !v.usageRows.length || flow.usage >= v.usageRows.length;
  if (flow.ing >= v.ingredients.length && usageDone && v.steps.length) {
    if (!flow.wroteStepHead) {
      doc.font("Helvetica-Bold").fontSize(6.5);
      const hh = doc.heightOfString("Process", { width: inner }) + 3;
      if (!fits(hh) && !atTop()) {
        doc.restore();
        doc.rect(x, y, w, h).lineWidth(0.6).strokeColor(RULE).stroke();
        return flow;
      }
      cy += 2;
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(MUTED);
      doc.text("Process", x + PAD, cy, { width: inner });
      cy = doc.y + 1;
      flow = { ...flow, wroteStepHead: true };
    }
    while (flow.step < v.steps.length) {
      const s = v.steps[flow.step]!;
      const text = `${flow.step + 1}. ${s.text}`;
      doc.font("Helvetica").fontSize(6.5);
      const lineH = doc.heightOfString(text, { width: inner }) + 1;
      if (!fits(lineH) && !atTop()) break;
      doc.font("Helvetica").fontSize(6.5).fillColor(INK);
      doc.text(text, x + PAD, cy, { width: inner });
      cy = doc.y + 1;
      flow = { ...flow, step: flow.step + 1 };
    }
  }

  doc.restore();
  doc.rect(x, y, w, h).lineWidth(0.6).strokeColor(RULE).stroke();

  const done =
    flow.ing >= v.ingredients.length &&
    (!v.usageRows.length || flow.usage >= v.usageRows.length) &&
    (!v.steps.length || flow.step >= v.steps.length);
  return done ? null : flow;
}

export function renderRecipePdf(versions: PrintVersion[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A5", margin: 0, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const q = quarterBoxes()[0]!;
    const fitsQuarter = (v: PrintVersion) => measureHeight(doc, v, q.w) <= q.h + 0.5;

    let i = 0;
    let pending: Flow | null = null;
    let pageStarted = false;

    const newPage = () => {
      if (pageStarted) doc.addPage({ size: "A5", margin: 0 });
      pageStarted = true;
    };

    while (i < versions.length || pending) {
      if (
        !pending &&
        i + 3 < versions.length &&
        [0, 1, 2, 3].every((k) => fitsQuarter(versions[i + k]!))
      ) {
        newPage();
        const boxes = quarterBoxes();
        for (let k = 0; k < 4; k++) {
          const box = boxes[k];
          const v = versions[i + k];
          if (box && v) drawInto(doc, startFlow(v), box);
        }
        i += 4;
        continue;
      }

      newPage();
      const boxes = bandBoxes();
      for (const box of boxes) {
        if (!pending) {
          if (i >= versions.length) break;
          pending = startFlow(versions[i]!);
          i += 1;
        }
        pending = drawInto(doc, pending, box);
      }
    }

    doc.end();
  });
}
