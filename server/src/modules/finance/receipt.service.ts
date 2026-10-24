import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { logger } from "../../utils/logger.js";
import { geminiGenerateText, type SuggestImage } from "../ai/ai.service.js";
import { buildReceiptPrompt, type ReceiptParseKind } from "../ai/prompts/receipt.js";
import {
  BOOKS_PAY_METHODS,
  BUY_ITEM_UNITS,
  gstParts,
  isGstChargeName,
  isMiscChargeName,
  isSalaryCategory,
  isShippingChargeName,
  money,
  normalizeItemName,
  qtyNum,
  VENDOR_CHANNELS,
} from "./books.shared.js";
import { extractAllGstins, normalizeGstin } from "../../lib/gstin.js";
import { phoneLookupVariants } from "../../lib/phone.js";
import {
  cleanVendorAddress,
  cleanVendorPhone,
  resolveVendor,
  vendorNamesClose,
} from "./purchase.service.js";

export type ReceiptDraftLine = {
  buyItemId?: string;
  name: string;
  unit: (typeof BUY_ITEM_UNITS)[number];
  packSize: number | null;
  category: string;
  qty: number;
  unitPrice: number;
};

export type ReceiptDraft = {
  kind: ReceiptParseKind;
  looksLikeBuy: boolean;
  uncertain: boolean;
  date: string | null;
  vendorId: string | null;
  vendorName: string | null;
  vendorChannel: (typeof VENDOR_CHANNELS)[number];
  category: string | null;
  paymentMethod: (typeof BOOKS_PAY_METHODS)[number] | null;
  shipping: number;
  miscCharges: number;
  cgst: number;
  sgst: number;
  igst: number;
  gst: number;
  vendorGstin: string | null;
  vendorPhone: string | null;
  vendorAddress: string | null;
  amount: number | null;
  notes: string | null;
  lines: ReceiptDraftLine[];
};

function asObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fence?.[1] ?? trimmed).trim();
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("not an object");
  }
  return parsed as Record<string, unknown>;
}

function str(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t || null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
  return null;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[,₹]/g, "")) : NaN;
  if (!Number.isFinite(n)) return null;
  return n;
}

function mapUnit(raw: unknown): (typeof BUY_ITEM_UNITS)[number] {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s === "kg" || s === "kilo" || s === "kilos" || s === "kilogram") return "KG";
  if (s === "l" || s === "lt" || s === "ltr" || s === "litre" || s === "liter") return "L";
  if (s === "packet" || s === "pack" || s === "pkt" || s === "box" || s === "boxes") return "PACKET";
  return "PCS";
}

function guessChannel(name: string, hinted?: string | null): (typeof VENDOR_CHANNELS)[number] {
  if (hinted === "ONLINE" || hinted === "OFFLINE") return hinted;
  const s = name.toLowerCase();
  if (/\b(instagram|amazon|flipkart|website|\.in\b|\.com\b|online)\b/.test(s)) return "ONLINE";
  return "OFFLINE";
}

function dateKeyOrNull(raw: unknown): string | null {
  const s = str(raw);
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

async function loadCatalog() {
  const [vendors, items, categories] = await Promise.all([
    prisma.vendor.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: 80,
      select: { id: true, name: true, channel: true, gstin: true },
    }),
    prisma.buyItem.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: 80,
      select: {
        id: true,
        name: true,
        nameNormalized: true,
        unit: true,
        packSize: true,
        category: { select: { slug: true } },
      },
    }),
    prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { slug: true, name: true },
    }),
  ]);
  return { vendors, items, categories };
}

function matchCategory(
  raw: string | null,
  categories: { slug: string; name: string }[],
): string | null {
  if (!raw) return null;
  const n = normalizeItemName(raw);
  const hit = categories.find(
    (c) => c.slug === n || normalizeItemName(c.name) === n || c.slug.includes(n) || n.includes(c.slug),
  );
  return hit?.slug ?? null;
}

function matchItem(
  name: string,
  catalog: {
    id: string;
    name: string;
    nameNormalized: string;
    unit: string;
    packSize: number | null;
    category?: { slug: string } | null;
  }[],
) {
  const n = normalizeItemName(name);
  return (
    catalog.find((i) => i.nameNormalized === n) ??
    catalog.find((i) => i.nameNormalized.includes(n) || n.includes(i.nameNormalized)) ??
    null
  );
}

function pickSellerGstin(
  ownGstin: string | null,
  ...blobs: (string | null | undefined)[]
): string | null {
  const found: string[] = [];
  for (const blob of blobs) {
    for (const gstin of extractAllGstins(blob, { loose: true })) {
      if (gstin !== ownGstin && !found.includes(gstin)) found.push(gstin);
    }
  }
  return found[0] ?? null;
}

export async function parseReceipt(input: {
  kind: ReceiptParseKind;
  image: SuggestImage;
  context?: string | null;
  vendorId?: string | null;
}): Promise<ReceiptDraft> {
  const catalog = await loadCatalog();
  const prompt = buildReceiptPrompt(
    input.kind,
    {
      vendors: catalog.vendors.map((v) => ({ name: v.name, channel: v.channel })),
      items: catalog.items.map((i) => ({ name: i.name, unit: i.unit, packSize: i.packSize })),
      categories: catalog.categories,
    },
    input.context,
  );

  const text = await geminiGenerateText({
    prompt,
    image: input.image,
    temperature: 0.15,
    maxOutputTokens: 1800,
    timeoutMs: 30_000,
  });

  let obj: Record<string, unknown>;
  try {
    obj = asObject(text);
  } catch (err) {
    logger.warn({ err, text: text.slice(0, 200) }, "Receipt Gemini parse failed");
    throw HttpError.badGateway("Could not read that bill. Try a closer photo or add a note.");
  }

  const vendorName = str(obj.vendor);
  const vendorChannel = guessChannel(vendorName ?? "", str(obj.vendorChannel));
  const category = matchCategory(str(obj.category), catalog.categories);
  const shop = await prisma.businessSettings.findFirst({
    select: { gstin: true, supportPhone: true, altPhone: true },
  });
  const ownGstin = shop?.gstin ? normalizeGstin(shop.gstin) : null;
  const ownPhones = [shop?.supportPhone, shop?.altPhone]
    .map((p) => cleanVendorPhone(p))
    .filter((p): p is string => Boolean(p));
  const vendorGstin = pickSellerGstin(
    ownGstin,
    str(obj.vendorGstin),
    str(obj.gstin),
    str(obj.sellerGstin),
    str(obj.vendor),
    str(obj.notes),
    text,
  );
  if (str(obj.vendorGstin) && !vendorGstin) {
    logger.info({ raw: str(obj.vendorGstin) }, "Receipt GSTIN did not look valid");
  }
  const vendorPhoneRaw =
    cleanVendorPhone(str(obj.vendorPhone)) ??
    cleanVendorPhone(str(obj.phone)) ??
    cleanVendorPhone(str(obj.sellerPhone)) ??
    cleanVendorPhone(str(obj.vendor));
  const vendorPhone = vendorPhoneRaw && !ownPhones.includes(vendorPhoneRaw) ? vendorPhoneRaw : null;
  const vendorAddress =
    cleanVendorAddress(str(obj.vendorAddress)) ??
    cleanVendorAddress(str(obj.address)) ??
    cleanVendorAddress(str(obj.sellerAddress));
  let vendorId: string | null = null;
  const hinted = input.vendorId
    ? await prisma.vendor.findUnique({
        where: { id: input.vendorId },
        select: { id: true, name: true },
      })
    : null;
  const vendorNameResolved =
    vendorName ??
    catalog.vendors.find((v) => v.gstin && v.gstin === vendorGstin)?.name ??
    hinted?.name ??
    null;
  const salary = isSalaryCategory(category ?? "");
  const vendorPatch = {
    channel: vendorChannel,
    gstin: vendorGstin,
    phone: vendorPhone,
    address: vendorAddress,
  };
  if (!salary && hinted && (!vendorName || vendorNamesClose(hinted.name, vendorName))) {
    vendorId = await resolveVendor({
      id: hinted.id,
      ...vendorPatch,
    });
  } else if (!salary && vendorNameResolved) {
    vendorId = await resolveVendor({
      name: vendorNameResolved,
      ...vendorPatch,
    });
  } else if (!salary && (vendorGstin || vendorPhone)) {
    const existing = vendorGstin
      ? await prisma.vendor.findFirst({ where: { gstin: vendorGstin }, select: { id: true } })
      : null;
    const byPhone =
      existing ??
      (vendorPhone
        ? await prisma.vendor.findFirst({
            where: { phone: { in: phoneLookupVariants(vendorPhone) } },
            select: { id: true },
          })
        : null);
    if (byPhone) {
      vendorId = await resolveVendor({
        id: byPhone.id,
        ...vendorPatch,
      });
    }
  }

  const rawLines = Array.isArray(obj.lines) ? obj.lines : [];
  const lines: ReceiptDraftLine[] = [];
  let shippingFromLines = 0;
  let miscFromLines = 0;
  let gstFromLines = 0;
  for (const row of rawLines) {
    if (!row || typeof row !== "object") continue;
    const line = row as Record<string, unknown>;
    const name = str(line.name);
    if (!name) continue;
    const qty = num(line.qty);
    const unitPrice = num(line.unitPrice);
    const lineAmt =
      qty != null && qty > 0 && unitPrice != null && unitPrice >= 0 ? money(qty * unitPrice) : num(line.amount);
    if (isShippingChargeName(name)) {
      if (lineAmt != null && lineAmt > 0) shippingFromLines = money(shippingFromLines + lineAmt);
      continue;
    }
    if (isGstChargeName(name)) {
      if (lineAmt != null && lineAmt > 0) gstFromLines = money(gstFromLines + lineAmt);
      continue;
    }
    if (isMiscChargeName(name)) {
      if (lineAmt != null && lineAmt > 0) miscFromLines = money(miscFromLines + lineAmt);
      continue;
    }
    if (qty == null || qty <= 0 || unitPrice == null || unitPrice < 0) continue;
    const matched = matchItem(name, catalog.items);
    const packRaw = num(line.packSize);
    const packSize =
      packRaw && packRaw > 1 ? Math.round(packRaw) : (matched?.packSize ?? null);
    lines.push({
      buyItemId: matched?.id,
      name: matched?.name ?? name,
      unit: matched ? (matched.unit as ReceiptDraftLine["unit"]) : mapUnit(line.unit),
      packSize: packSize && packSize > 1 ? packSize : null,
      category: matched?.category?.slug ?? "raw-materials",
      qty: qtyNum(qty),
      unitPrice: money(unitPrice),
    });
  }

  const shippingField = Math.max(0, money(num(obj.shipping) ?? 0));
  const miscField = Math.max(0, money(num(obj.miscCharges) ?? 0));
  const shipping = shippingField > 0 ? shippingField : shippingFromLines;
  const miscCharges = miscField > 0 ? miscField : miscFromLines;
  const tax = gstParts({
    cgst: num(obj.cgst),
    sgst: num(obj.sgst),
    igst: num(obj.igst),
    gst: num(obj.gst) ?? (gstFromLines > 0 ? gstFromLines : null),
  });
  const amount = num(obj.amount);
  const looksLikeBuy =
    obj.looksLikeBuy === true || (input.kind === "BUY" && lines.length > 0) || lines.length >= 2;

  return {
    kind: input.kind,
    looksLikeBuy,
    uncertain: obj.uncertain === true,
    date: dateKeyOrNull(obj.date),
    vendorId,
    vendorName: vendorName
      ? (catalog.vendors.find((v) => v.id === vendorId)?.name ?? vendorName)
      : null,
    vendorChannel,
    category,
    paymentMethod: BOOKS_PAY_METHODS.includes(str(obj.paymentMethod) as (typeof BOOKS_PAY_METHODS)[number])
      ? (str(obj.paymentMethod) as (typeof BOOKS_PAY_METHODS)[number])
      : null,
    shipping,
    miscCharges,
    cgst: tax.cgst,
    sgst: tax.sgst,
    igst: tax.igst,
    gst: tax.gst,
    vendorGstin,
    vendorPhone,
    vendorAddress,
    amount: amount != null && amount > 0 ? money(amount) : null,
    notes: str(obj.notes),
    lines,
  };
}
