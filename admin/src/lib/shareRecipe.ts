import { copyShareText } from "@/lib/shareOrder";
import {
  formatRecipeQty,
  formatRecipeQtyCell,
  kitchenQtyLabel,
  scaleQty,
} from "@/pages/recipes/recipe-ui";

export type ShareableRecipeIngredient = {
  name: string;
  qty: number;
  unit: string;
  note?: string | null;
  extraQtys?: (number | null)[];
  buyItem?: { alias?: string | null } | null;
  componentRecipe?: { name: string } | null;
};

export type ShareableRecipe = {
  name: string;
  scale: number;
  yieldQty: number | null;
  yieldUnit: string | null;
  yieldNote: string | null;
  sizes: { label: string }[];
  ingredients: ShareableRecipeIngredient[];
  steps: { text: string }[];
  usage: { axis1: string; axis2: string | null; qty: number; unit: string }[];
};

export function ingredientShareName(line: ShareableRecipeIngredient): string {
  const nested = line.componentRecipe?.name?.trim();
  if (nested) return nested;
  const alias = line.buyItem?.alias?.trim();
  if (alias) return alias;
  return line.name;
}

export function formatRecipeShareText(recipe: ShareableRecipe): string {
  const scale = recipe.scale > 0 ? recipe.scale : 1;
  const multi = recipe.sizes.length >= 2;
  const blocks: string[] = [recipe.name.trim() || "Recipe"];
  const scaled = scaleLabel(scale);
  if (scaled) blocks.push(scaled);
  if (recipe.yieldQty != null && recipe.yieldUnit) {
    const yieldLine = `Batch ${formatRecipeQty(scaleQty(recipe.yieldQty, scale), recipe.yieldUnit)}`;
    blocks.push(recipe.yieldNote ? `${yieldLine} · ${recipe.yieldNote}` : yieldLine);
  }

  const ingLines = recipe.ingredients.map((line) => {
    const name = ingredientShareName(line);
    const note = line.note?.trim() ? ` · ${line.note.trim()}` : "";
    if (!multi) {
      return `${name}${note} — ${formatRecipeQty(scaleQty(line.qty, scale), line.unit)}`;
    }
    const qtys = [
      formatRecipeQtyCell(line.qty, line.unit, scale),
      ...recipe.sizes.slice(1).map((_, i) => formatRecipeQtyCell(line.extraQtys?.[i], line.unit, scale)),
    ];
    return `${name}${note} — ${recipe.sizes.map((s, i) => `${s.label} ${qtys[i] || "—"}`).join(", ")}`;
  });
  if (ingLines.length) blocks.push(["Ingredients", ...ingLines].join("\n"));

  if (recipe.usage.length) {
    const rows = recipe.usage.map((u) => {
      const style = u.axis2?.trim() ? ` · ${u.axis2.trim()}` : "";
      return `${u.axis1}${style} — ${formatRecipeQty(scaleQty(u.qty, scale), u.unit)}`;
    });
    blocks.push(["Portions", ...rows].join("\n"));
  }

  const steps = recipe.steps.map((s) => s.text.trim()).filter(Boolean);
  if (steps.length) {
    blocks.push(["Process", ...steps.map((s, i) => `${i + 1}. ${s}`)].join("\n"));
  }

  return blocks.join("\n\n");
}

export async function shareRecipe(recipe: ShareableRecipe): Promise<"shared" | "copied" | "cancelled"> {
  const text = formatRecipeShareText(recipe);
  if (!text) throw new Error("Nothing to share on this recipe.");

  const copied = await copyShareText(text);
  const file = recipePngFile(recipe);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  if (file && canShare) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (err) {
      if (isAbort(err)) return copied ? "copied" : "cancelled";
    }
  }

  if (canShare) {
    try {
      await navigator.share({ text });
      return copied ? "copied" : "shared";
    } catch (err) {
      if (isAbort(err)) return copied ? "copied" : "cancelled";
    }
  }

  if (copied) return "copied";
  if (await copyShareText(text)) return "copied";
  throw new Error("Could not copy the recipe. Use Copy details below.");
}

function scaleLabel(scale: number): string | null {
  if (Math.abs(scale - 1) < 0.0005) return null;
  if (Math.abs(scale - 0.5) < 0.0005) return "½×";
  return `${kitchenQtyLabel(scale)}×`;
}

function fileSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "recipe";
}

const CARD_W = 720;
const PAD = 36;
const INK = "#1e293b";
const MUTED = "#64748b";
const HEAD = "#fde047";
const RULE = "#e2e8f0";
const WHITE = "#ffffff";

function recipePngFile(recipe: ShareableRecipe): File | null {
  if (typeof document === "undefined") return null;
  const canvas = drawRecipeCard(recipe);
  const data = canvas.toDataURL("image/png");
  const comma = data.indexOf(",");
  if (comma < 0) return null;
  const raw = atob(data.slice(comma + 1));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new File([bytes], `${fileSlug(recipe.name)}.png`, { type: "image/png" });
}

function drawRecipeCard(recipe: ShareableRecipe): HTMLCanvasElement {
  const scale = recipe.scale > 0 ? recipe.scale : 1;
  const multi = recipe.sizes.length >= 2;
  const inner = CARD_W - PAD * 2;
  const nameW = multi ? inner * 0.42 : inner * 0.62;
  const qtyW = multi ? (inner - nameW) / recipe.sizes.length : inner - nameW;
  const dpr = 2;

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return document.createElement("canvas");
  measure.font = font(true, 22);
  const title = wrapText(measure, recipe.name.trim() || "Recipe", inner);
  const headerH = Math.max(56, 22 + title.length * 26 + 10);

  const lines: { draw: (ctx: CanvasRenderingContext2D, y: number) => number }[] = [];
  let y = headerH + 20;

  const pushText = (
    text: string,
    opts: { size: number; color: string; bold?: boolean; width?: number; gap?: number },
  ) => {
    measure.font = font(opts.bold ?? false, opts.size);
    const wrapped = wrapText(measure, text, opts.width ?? inner);
    const gap = opts.gap ?? 6;
    const top = y;
    const h = wrapped.length * (opts.size + 4) + gap;
    y += h;
    lines.push({
      draw: (ctx, start) => {
        ctx.font = font(opts.bold ?? false, opts.size);
        ctx.fillStyle = opts.color;
        wrapped.forEach((row, i) => {
          ctx.fillText(row, PAD, start + (i + 1) * (opts.size + 4));
        });
        return start + h;
      },
    });
    return top;
  };

  const scaled = scaleLabel(scale);
  if (scaled) pushText(scaled, { size: 16, color: MUTED, bold: true, gap: 10 });
  if (recipe.yieldQty != null && recipe.yieldUnit) {
    const yieldLine = `Batch ${formatRecipeQty(scaleQty(recipe.yieldQty, scale), recipe.yieldUnit)}`;
    pushText(recipe.yieldNote ? `${yieldLine} · ${recipe.yieldNote}` : yieldLine, {
      size: 14,
      color: MUTED,
      gap: 14,
    });
  }

  if (recipe.ingredients.length) {
    pushText("Ingredients", { size: 13, color: MUTED, bold: true, gap: 8 });
    if (multi) {
      y += 22;
      lines.push({
        draw: (ctx, start) => {
          ctx.font = font(true, 12);
          ctx.fillStyle = MUTED;
          ctx.fillText("Ingredient", PAD, start + 14);
          recipe.sizes.forEach((s, i) => {
            ctx.textAlign = "right";
            ctx.fillText(s.label, PAD + nameW + (i + 1) * qtyW, start + 14);
          });
          ctx.textAlign = "left";
          return start + 22;
        },
      });
    }
    recipe.ingredients.forEach((line) => {
      const name = `${ingredientShareName(line)}${line.note?.trim() ? ` · ${line.note.trim()}` : ""}`;
      measure.font = font(false, 16);
      const wrapped = wrapText(measure, name, nameW - 8);
      const h = Math.max(24, wrapped.length * 20) + 6;
      const qtys = multi
        ? [
            formatRecipeQtyCell(line.qty, line.unit, scale),
            ...recipe.sizes.slice(1).map((_, i) => formatRecipeQtyCell(line.extraQtys?.[i], line.unit, scale)),
          ]
        : [formatRecipeQty(scaleQty(line.qty, scale), line.unit)];
      y += h;
      lines.push({
        draw: (ctx, start) => {
          ctx.font = font(false, 16);
          ctx.fillStyle = INK;
          wrapped.forEach((row, i) => ctx.fillText(row, PAD, start + 16 + i * 20));
          ctx.textAlign = "right";
          qtys.forEach((q, i) => {
            ctx.fillText(q || "—", PAD + nameW + (i + 1) * qtyW, start + 16);
          });
          ctx.textAlign = "left";
          ctx.strokeStyle = RULE;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(PAD, start + h - 1);
          ctx.lineTo(PAD + inner, start + h - 1);
          ctx.stroke();
          return start + h;
        },
      });
    });
    y += 10;
  }

  if (recipe.usage.length) {
    pushText("Portions", { size: 13, color: MUTED, bold: true, gap: 8 });
    recipe.usage.forEach((u) => {
      const label = u.axis2?.trim() ? `${u.axis1} · ${u.axis2.trim()}` : u.axis1;
      const qty = formatRecipeQty(scaleQty(u.qty, scale), u.unit);
      measure.font = font(false, 16);
      const wrapped = wrapText(measure, label, nameW - 8);
      const h = Math.max(24, wrapped.length * 20) + 6;
      y += h;
      lines.push({
        draw: (ctx, start) => {
          ctx.font = font(false, 16);
          ctx.fillStyle = INK;
          wrapped.forEach((row, i) => ctx.fillText(row, PAD, start + 16 + i * 20));
          ctx.textAlign = "right";
          ctx.fillText(qty, PAD + inner, start + 16);
          ctx.textAlign = "left";
          return start + h;
        },
      });
    });
    y += 10;
  }

  const steps = recipe.steps.map((s) => s.text.trim()).filter(Boolean);
  if (steps.length) {
    pushText("Process", { size: 13, color: MUTED, bold: true, gap: 8 });
    steps.forEach((step, i) => {
      const prefix = `${i + 1}. `;
      measure.font = font(false, 16);
      const wrapped = wrapText(measure, `${prefix}${step}`, inner);
      const h = wrapped.length * 22 + 6;
      y += h;
      lines.push({
        draw: (ctx, start) => {
          ctx.font = font(false, 16);
          ctx.fillStyle = INK;
          wrapped.forEach((row, j) => ctx.fillText(row, PAD, start + 16 + j * 22));
          return start + h;
        },
      });
    });
  }

  const height = Math.max(y + PAD, 280);
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, CARD_W, height);
  ctx.fillStyle = HEAD;
  ctx.fillRect(0, 0, CARD_W, headerH);
  ctx.fillStyle = INK;
  ctx.font = font(true, 22);
  title.forEach((row, i) => ctx.fillText(row, PAD, 32 + i * 26));

  let cy = headerH + 20;
  for (const block of lines) cy = block.draw(ctx, cy);
  return canvas;
}

function font(bold: boolean, size: number) {
  return `${bold ? "600" : "400"} ${size}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const out: string[] = [];
  let cur = words[0]!;
  for (const word of words.slice(1)) {
    const next = `${cur} ${word}`;
    if (ctx.measureText(next).width <= maxWidth) {
      cur = next;
    } else {
      out.push(cur);
      cur = word;
    }
  }
  out.push(cur);
  return out;
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
