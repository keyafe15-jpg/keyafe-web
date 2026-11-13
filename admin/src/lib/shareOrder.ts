import { lineDisplayNotes } from "@keyafe/shared/lineExtras";
import { listedItemImages } from "@/components/orders/RefImageStrip";
import { TIME_SLOTS } from "@/content/slots";
import { isZeroExtraCharge } from "@/lib/extraCharge";

const KOLKATA = "Asia/Kolkata";
const MAX_SHARE_IMAGES = 10;

export type ShareableOrderItem = {
  productName: string;
  sizeLabel?: string | null;
  flavourName?: string | null;
  messageOnCake?: string | null;
  instructions?: string | null;
  description?: string | null;
  qty: number;
  unitPrice?: unknown;
  lineTotal?: unknown;
  deliveryDate?: string | null;
  deliverySlotKey?: string | null;
  deliverySlotLabel?: string | null;
  productImage?: string | null;
  referenceImageUrl?: string | null;
  referenceImageUrls?: string[] | null;
};

export type ShareableOrder = {
  items: ShareableOrderItem[];
};

type DateHeader = {
  compact: string;
  readable: string;
  slot: string | null;
};

export function kitchenShareItems(order: ShareableOrder): ShareableOrderItem[] {
  return order.items.filter((item) => !isZeroExtraCharge(item));
}

export function formatOrderShareText(order: ShareableOrder): string {
  const items = kitchenShareItems(order);
  if (items.length === 0) return "";

  const blocks: string[] = [];
  let lastHeader = "";

  items.forEach((item, index) => {
    const header = dateHeader(item);
    const headerKey = header ? `${header.compact}|${header.slot ?? ""}` : "";
    if (header && headerKey !== lastHeader) {
      blocks.push(formatDateHeader(header));
      lastHeader = headerKey;
    }
    blocks.push(formatItem(item, index));
  });

  return blocks.join("\n\n");
}

export async function shareOrder(order: ShareableOrder): Promise<"shared" | "copied" | "cancelled"> {
  const items = kitchenShareItems(order);
  const text = formatOrderShareText(order);
  if (!text) throw new Error("Nothing to share on this order.");

  // Copy the slip in this tap (before photo fetch). Do not copy again after the
  // share sheet — that overwrites the image if they used Copy on the photo.
  const copied = await copyShareText(text);

  const files = await filesForShare(items);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  if (files.length > 0 && canShare) {
    try {
      await navigator.share({ files });
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
  throw new Error("Could not copy the kitchen slip. Use Copy details below.");
}

export async function copyShareText(text: string): Promise<boolean> {
  const syncOk = copyShareTextSync(text);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return syncOk;
  }
}

function copyShareTextSync(text: string): boolean {
  if (typeof document === "undefined") return false;
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.setAttribute("aria-hidden", "true");
  el.style.position = "fixed";
  el.style.top = "0";
  el.style.left = "0";
  el.style.width = "1px";
  el.style.height = "1px";
  el.style.opacity = "0";
  el.style.pointerEvents = "none";
  document.body.appendChild(el);
  el.focus();
  el.select();
  el.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(el);
  return ok;
}

function formatDateHeader(header: DateHeader): string {
  const readable = header.slot ? `${header.readable} · ${header.slot}` : header.readable;
  return `${header.compact}\n${readable}`;
}

function dateHeader(item: ShareableOrderItem): DateHeader | null {
  if (!item.deliveryDate) return null;
  const compact = compactDay(item.deliveryDate);
  const readable = readableDay(item.deliveryDate);
  if (!compact || !readable) return null;
  return { compact, readable, slot: slotWord(item) };
}

function compactDay(iso: string): string | null {
  const parts = kolkataParts(iso, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
  const day = parts.day;
  const month = parts.month;
  const year = parts.year;
  if (!day || !month || !year) return null;
  return `${day}${month}${year}`;
}

function readableDay(iso: string): string | null {
  const parts = kolkataParts(iso, { day: "numeric", month: "short" });
  if (!parts.day || !parts.month) return null;
  return `${parts.day} ${parts.month}`;
}

function kolkataParts(
  iso: string,
  options: Intl.DateTimeFormatOptions,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-GB", {
    timeZone: KOLKATA,
    ...options,
  }).formatToParts(new Date(iso))) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return map;
}

function slotWord(item: ShareableOrderItem): string | null {
  if (item.deliverySlotKey === "SAME_DAY") return "Same day";
  const known = TIME_SLOTS.find((s) => s.key === item.deliverySlotKey);
  if (known) return known.label.split(" · ")[0] ?? known.label;
  const label = item.deliverySlotLabel?.trim();
  if (!label) return null;
  return label.split(" · ")[0]?.trim() || label;
}

function formatItem(item: ShareableOrderItem, index: number): string {
  const size = item.sizeLabel?.trim() ?? "";
  const name = item.productName.trim();
  const title = [size, name].filter(Boolean).join(" ");
  const qty = item.qty || 1;
  const lines = [`${index + 1}. ${title} ×${qty}`];

  const flavour = item.flavourName?.trim();
  if (flavour && flavour.toLowerCase() !== name.toLowerCase()) {
    lines.push(`Flavour: ${flavour}`);
  }

  const parsed = lineDisplayNotes({
    instructions: item.instructions,
    messageOnCake: item.messageOnCake,
  });

  for (const extra of parsed.extras) {
    if (!/^(crust|toppings|condiments)$/i.test(extra.group.trim())) continue;
    if (extra.names.trim()) lines.push(extra.names.trim());
  }

  const description = item.description?.trim();
  if (description) lines.push(description);

  if (parsed.message) lines.push(`Message on cake: ${parsed.message}`);

  const notes = kitchenNotes(parsed.notes);
  if (notes) lines.push(`Notes: ${notes}`);

  for (const extra of parsed.extras) {
    if (/^(crust|toppings|condiments)$/i.test(extra.group.trim())) continue;
    const names = extra.names.trim();
    if (!names) continue;
    if (/^(add-?ons)$/i.test(extra.group.trim())) lines.push(names);
    else lines.push(`${extra.group}: ${names}`);
  }

  return lines.join("\n");
}

/** Drop empty notes and the default “eggless” line the kitchen already assumes. */
function kitchenNotes(notes: string | null): string | null {
  if (!notes) return null;
  const kept = notes
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !/^eggless\.?$/i.test(line));
  return kept.length ? kept.join("\n") : null;
}

async function filesForShare(items: ShareableOrderItem[]): Promise<File[]> {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const url = listedItemImages(item)[0];
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= MAX_SHARE_IMAGES) break;
  }

  const files: File[] = [];
  for (const [i, url] of urls.entries()) {
    const file = await fileFromUrl(url, i + 1);
    if (file) files.push(file);
  }
  return files;
}

async function fileFromUrl(url: string, index: number): Promise<File | null> {
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const type = blob.type.startsWith("image/") ? blob.type : "image/jpeg";
    const ext = extensionFor(type);
    return new File([blob], `${index}.${ext}`, { type });
  } catch {
    return null;
  }
}

function extensionFor(type: string): string {
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  return "jpg";
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
