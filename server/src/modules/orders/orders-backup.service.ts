import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import type {
  OrderFulfillment,
  OrderSource,
  OrderStatus,
  PaymentMode,
  PaymentStatus,
} from "@prisma/client";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";

export type OrdersBackupFormat = "xlsx" | "csv";

const ORDER_STATUSES = new Set([
  "PENDING",
  "CONFIRMED",
  "IN_KITCHEN",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
]);
const PAYMENT_STATUSES = new Set(["PENDING", "PARTIAL", "PAID", "FAILED", "REFUNDED"]);
const FULFILLMENTS = new Set(["DELIVERY", "PICKUP"]);
const PAYMENT_MODES = new Set(["FULL", "ADVANCE"]);
const SOURCES = new Set(["STOREFRONT", "OFFLINE_LINK", "OFFLINE_DIRECT"]);

const ORDER_HEADERS = [
  "orderId",
  "orderNumber",
  "userId",
  "customerName",
  "customerPhone",
  "customerEmail",
  "recipientName",
  "deliveryPhone",
  "customerCompanyName",
  "customerGstin",
  "fulfillment",
  "deliveryAddressJson",
  "billingAddressJson",
  "isSurpriseGift",
  "subtotal",
  "deliveryFee",
  "discount",
  "couponCode",
  "total",
  "taxableAmount",
  "cgstAmount",
  "sgstAmount",
  "igstAmount",
  "placeOfSupply",
  "invoiceNumber",
  "invoiceDate",
  "challanNumber",
  "challanDate",
  "paymentMethod",
  "paymentStatus",
  "paymentMode",
  "advanceAmount",
  "paymentScreenshotUrl",
  "status",
  "source",
  "customerNotes",
  "adminNotes",
  "createdAt",
  "updatedAt",
] as const;

const ITEM_HEADERS = [
  "itemId",
  "orderNumber",
  "orderId",
  "productId",
  "productName",
  "productSlug",
  "productImage",
  "sizeGrams",
  "sizeLabel",
  "flavourId",
  "flavourName",
  "messageOnCake",
  "instructions",
  "referenceImageUrl",
  "deliveryDate",
  "deliverySlotKey",
  "deliverySlotLabel",
  "unitPrice",
  "qty",
  "lineTotal",
  "hsnCode",
  "gstRate",
  "taxableValue",
  "cgstAmount",
  "sgstAmount",
  "igstAmount",
  "createdAt",
] as const;

function cell(v: unknown): string | number | boolean {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "boolean" || typeof v === "number") return v;
  return String(v);
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v).trim() || null;
}

function bool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

function parseJson(v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (v == null || v === "") return Prisma.JsonNull;
  if (typeof v === "object") return v as Prisma.InputJsonValue;
  const s = String(v).trim();
  if (!s) return Prisma.JsonNull;
  try {
    return JSON.parse(s) as Prisma.InputJsonValue;
  } catch {
    return Prisma.JsonNull;
  }
}

function parseDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  // Excel serial date
  if (typeof v === "number" && Number.isFinite(v)) {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (parsed) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S));
    }
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function istDayStart(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00+05:30`);
}

function istDayEndExclusive(isoDay: string): Date {
  const [y, m, d] = isoDay.split("-").map(Number);
  const next = new Date(Date.UTC(y!, m! - 1, d! + 1));
  const nextIso = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  return istDayStart(nextIso);
}

export interface OrdersBackupParams {
  format: OrdersBackupFormat;
  /** Inclusive calendar day YYYY-MM-DD (IST). Omit with `to` for all orders. */
  from?: string;
  /** Inclusive calendar day YYYY-MM-DD (IST). */
  to?: string;
}

/**
 * Orders backup for disaster recovery. XLSX has Orders + OrderItems sheets;
 * CSV is a single denormalized file (one row per line item) that reimports the same way.
 * Optional from/to filters by order createdAt (IST calendar days).
 */
export async function buildOrdersBackup(params: OrdersBackupParams): Promise<{
  buffer: Buffer;
  contentType: string;
  filename: string;
  meta: { orderCount: number; itemCount: number; label: string };
}> {
  const { format } = params;
  let createdAtFilter: { gte?: Date; lt?: Date } | undefined;
  let rangeLabel = "all";

  if (params.from || params.to) {
    if (!params.from || !params.to) {
      throw HttpError.badRequest("Provide both from and to (YYYY-MM-DD), or neither for all orders");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.from) || !/^\d{4}-\d{2}-\d{2}$/.test(params.to)) {
      throw HttpError.badRequest("from/to must be YYYY-MM-DD");
    }
    if (params.from > params.to) {
      throw HttpError.badRequest("from must be on or before to");
    }
    createdAtFilter = {
      gte: istDayStart(params.from),
      lt: istDayEndExclusive(params.to),
    };
    rangeLabel = `${params.from}_to_${params.to}`;
  }

  const orders = await prisma.order.findMany({
    where: createdAtFilter ? { createdAt: createdAtFilter } : undefined,
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  const orderRows = orders.map((o) => {
    const row: Record<string, string | number | boolean> = {};
    row.orderId = o.id;
    row.orderNumber = o.orderNumber;
    row.userId = o.userId ?? "";
    row.customerName = o.customerName;
    row.customerPhone = o.customerPhone;
    row.customerEmail = o.customerEmail ?? "";
    row.recipientName = o.recipientName ?? "";
    row.deliveryPhone = o.deliveryPhone ?? "";
    row.customerCompanyName = o.customerCompanyName ?? "";
    row.customerGstin = o.customerGstin ?? "";
    row.fulfillment = o.fulfillment;
    row.deliveryAddressJson = o.deliveryAddress ? JSON.stringify(o.deliveryAddress) : "";
    row.billingAddressJson = o.billingAddress ? JSON.stringify(o.billingAddress) : "";
    row.isSurpriseGift = o.isSurpriseGift;
    row.subtotal = num(o.subtotal);
    row.deliveryFee = num(o.deliveryFee);
    row.discount = num(o.discount);
    row.couponCode = o.couponCode ?? "";
    row.total = num(o.total);
    row.taxableAmount = num(o.taxableAmount);
    row.cgstAmount = num(o.cgstAmount);
    row.sgstAmount = num(o.sgstAmount);
    row.igstAmount = num(o.igstAmount);
    row.placeOfSupply = o.placeOfSupply ?? "";
    row.invoiceNumber = o.invoiceNumber ?? "";
    row.invoiceDate = o.invoiceDate?.toISOString() ?? "";
    row.challanNumber = o.challanNumber ?? "";
    row.challanDate = o.challanDate?.toISOString() ?? "";
    row.paymentMethod = o.paymentMethod;
    row.paymentStatus = o.paymentStatus;
    row.paymentMode = o.paymentMode;
    row.advanceAmount = num(o.advanceAmount);
    row.paymentScreenshotUrl = o.paymentScreenshotUrl ?? "";
    row.status = o.status;
    row.source = o.source;
    row.customerNotes = o.customerNotes ?? "";
    row.adminNotes = o.adminNotes ?? "";
    row.createdAt = o.createdAt.toISOString();
    row.updatedAt = o.updatedAt.toISOString();
    return row;
  });

  const itemRows = orders.flatMap((o) =>
    o.items.map((it) => {
      const row: Record<string, string | number | boolean> = {};
      row.itemId = it.id;
      row.orderNumber = o.orderNumber;
      row.orderId = o.id;
      row.productId = it.productId ?? "";
      row.productName = it.productName;
      row.productSlug = it.productSlug ?? "";
      row.productImage = it.productImage ?? "";
      row.sizeGrams = it.sizeGrams ?? "";
      row.sizeLabel = it.sizeLabel ?? "";
      row.flavourId = it.flavourId ?? "";
      row.flavourName = it.flavourName ?? "";
      row.messageOnCake = it.messageOnCake ?? "";
      row.instructions = it.instructions ?? "";
      row.referenceImageUrl = it.referenceImageUrl ?? "";
      row.deliveryDate = it.deliveryDate?.toISOString() ?? "";
      row.deliverySlotKey = it.deliverySlotKey ?? "";
      row.deliverySlotLabel = it.deliverySlotLabel ?? "";
      row.unitPrice = num(it.unitPrice);
      row.qty = it.qty;
      row.lineTotal = num(it.lineTotal);
      row.hsnCode = it.hsnCode ?? "";
      row.gstRate = it.gstRate == null ? "" : num(it.gstRate);
      row.taxableValue = it.taxableValue == null ? "" : num(it.taxableValue);
      row.cgstAmount = num(it.cgstAmount);
      row.sgstAmount = num(it.sgstAmount);
      row.igstAmount = num(it.igstAmount);
      row.createdAt = it.createdAt.toISOString();
      return row;
    }),
  );

  const day = stamp();

  if (format === "csv") {
    // Denormalized: one row per item (or one bare order row if no items).
    const denorm = orders.flatMap((o) => {
      const base = orderRows.find((r) => r.orderNumber === o.orderNumber)!;
      const items = itemRows.filter((r) => r.orderNumber === o.orderNumber);
      if (items.length === 0) {
        return [{ ...Object.fromEntries(ORDER_HEADERS.map((h) => [h, cell(base[h])])), ...Object.fromEntries(ITEM_HEADERS.map((h) => [h, ""])) }];
      }
      return items.map((it) => ({
        ...Object.fromEntries(ORDER_HEADERS.map((h) => [h, cell(base[h])])),
        ...Object.fromEntries(ITEM_HEADERS.map((h) => [h, cell(it[h])])),
      }));
    });
    const sheet = XLSX.utils.json_to_sheet(denorm);
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return {
      buffer: Buffer.from(csv, "utf8"),
      contentType: "text/csv; charset=utf-8",
      filename: `orders-backup-${rangeLabel}-${day}.csv`,
      meta: { orderCount: orders.length, itemCount: itemRows.length, label: rangeLabel },
    };
  }

  const wb = XLSX.utils.book_new();
  const ordersSheet = XLSX.utils.json_to_sheet(
    orderRows.map((r) => Object.fromEntries(ORDER_HEADERS.map((h) => [h, cell(r[h])]))),
  );
  const itemsSheet = XLSX.utils.json_to_sheet(
    itemRows.map((r) => Object.fromEntries(ITEM_HEADERS.map((h) => [h, cell(r[h])]))),
  );
  XLSX.utils.book_append_sheet(wb, ordersSheet, "Orders");
  XLSX.utils.book_append_sheet(wb, itemsSheet, "OrderItems");

  return {
    buffer: Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" })),
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: `orders-backup-${rangeLabel}-${day}.xlsx`,
    meta: { orderCount: orders.length, itemCount: itemRows.length, label: rangeLabel },
  };
}

interface OrderDraft {
  orderId: string | null;
  orderNumber: string;
  userId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  recipientName: string | null;
  deliveryPhone: string | null;
  customerCompanyName: string | null;
  customerGstin: string | null;
  fulfillment: OrderFulfillment;
  deliveryAddress: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  billingAddress: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  isSurpriseGift: boolean;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  couponCode: string | null;
  total: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  placeOfSupply: string | null;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  challanNumber: string | null;
  challanDate: Date | null;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  paymentMode: PaymentMode;
  advanceAmount: number;
  paymentScreenshotUrl: string | null;
  status: OrderStatus;
  source: OrderSource;
  customerNotes: string | null;
  adminNotes: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  items: ItemDraft[];
}

interface ItemDraft {
  itemId: string | null;
  productId: string | null;
  productName: string;
  productSlug: string | null;
  productImage: string | null;
  sizeGrams: number | null;
  sizeLabel: string | null;
  flavourId: string | null;
  flavourName: string | null;
  messageOnCake: string | null;
  instructions: string | null;
  referenceImageUrl: string | null;
  deliveryDate: Date | null;
  deliverySlotKey: string | null;
  deliverySlotLabel: string | null;
  unitPrice: number;
  qty: number;
  lineTotal: number;
  hsnCode: string | null;
  gstRate: number | null;
  taxableValue: number | null;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  createdAt: Date | null;
}

function rowDict(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.trim()] = v;
  }
  return out;
}

function parseOrderFromRow(raw: Record<string, unknown>): Omit<OrderDraft, "items"> | null {
  const r = rowDict(raw);
  const orderNumber = str(r.orderNumber);
  if (!orderNumber) return null;

  const fulfillmentRaw = str(r.fulfillment) ?? "DELIVERY";
  const paymentStatusRaw = str(r.paymentStatus) ?? "PENDING";
  const paymentModeRaw = str(r.paymentMode) ?? "FULL";
  const statusRaw = str(r.status) ?? "PENDING";
  const sourceRaw = str(r.source) ?? "STOREFRONT";

  if (!FULFILLMENTS.has(fulfillmentRaw)) {
    throw HttpError.badRequest(`Invalid fulfillment on ${orderNumber}: ${fulfillmentRaw}`);
  }
  if (!PAYMENT_STATUSES.has(paymentStatusRaw)) {
    throw HttpError.badRequest(`Invalid paymentStatus on ${orderNumber}: ${paymentStatusRaw}`);
  }
  if (!PAYMENT_MODES.has(paymentModeRaw)) {
    throw HttpError.badRequest(`Invalid paymentMode on ${orderNumber}: ${paymentModeRaw}`);
  }
  if (!ORDER_STATUSES.has(statusRaw)) {
    throw HttpError.badRequest(`Invalid status on ${orderNumber}: ${statusRaw}`);
  }
  if (!SOURCES.has(sourceRaw)) {
    throw HttpError.badRequest(`Invalid source on ${orderNumber}: ${sourceRaw}`);
  }

  const customerName = str(r.customerName);
  const customerPhone = str(r.customerPhone);
  if (!customerName || !customerPhone) {
    throw HttpError.badRequest(`Order ${orderNumber} needs customerName and customerPhone`);
  }

  return {
    orderId: str(r.orderId),
    orderNumber,
    userId: str(r.userId),
    customerName,
    customerPhone,
    customerEmail: str(r.customerEmail),
    recipientName: str(r.recipientName),
    deliveryPhone: str(r.deliveryPhone),
    customerCompanyName: str(r.customerCompanyName),
    customerGstin: str(r.customerGstin),
    fulfillment: fulfillmentRaw as OrderFulfillment,
    deliveryAddress: parseJson(r.deliveryAddressJson),
    billingAddress: parseJson(r.billingAddressJson),
    isSurpriseGift: bool(r.isSurpriseGift),
    subtotal: num(r.subtotal),
    deliveryFee: num(r.deliveryFee),
    discount: num(r.discount),
    couponCode: str(r.couponCode),
    total: num(r.total),
    taxableAmount: num(r.taxableAmount),
    cgstAmount: num(r.cgstAmount),
    sgstAmount: num(r.sgstAmount),
    igstAmount: num(r.igstAmount),
    placeOfSupply: str(r.placeOfSupply),
    invoiceNumber: str(r.invoiceNumber),
    invoiceDate: parseDate(r.invoiceDate),
    challanNumber: str(r.challanNumber),
    challanDate: parseDate(r.challanDate),
    paymentMethod: str(r.paymentMethod) ?? "cod",
    paymentStatus: paymentStatusRaw as PaymentStatus,
    paymentMode: paymentModeRaw as PaymentMode,
    advanceAmount: num(r.advanceAmount),
    paymentScreenshotUrl: str(r.paymentScreenshotUrl),
    status: statusRaw as OrderStatus,
    source: sourceRaw as OrderSource,
    customerNotes: str(r.customerNotes),
    adminNotes: str(r.adminNotes),
    createdAt: parseDate(r.createdAt),
    updatedAt: parseDate(r.updatedAt),
  };
}

function optionalNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseItemFromRow(raw: Record<string, unknown>): ItemDraft | null {
  const r = rowDict(raw);
  const productName = str(r.productName);
  if (!productName) return null;

  const sizeGrams = optionalNumber(r.sizeGrams);

  return {
    itemId: str(r.itemId),
    productId: str(r.productId),
    productName,
    productSlug: str(r.productSlug),
    productImage: str(r.productImage),
    sizeGrams: sizeGrams == null ? null : Math.round(sizeGrams),
    sizeLabel: str(r.sizeLabel),
    flavourId: str(r.flavourId),
    flavourName: str(r.flavourName),
    messageOnCake: str(r.messageOnCake),
    instructions: str(r.instructions),
    referenceImageUrl: str(r.referenceImageUrl),
    deliveryDate: parseDate(r.deliveryDate),
    deliverySlotKey: str(r.deliverySlotKey),
    deliverySlotLabel: str(r.deliverySlotLabel),
    unitPrice: num(r.unitPrice),
    qty: Math.max(1, Math.round(num(r.qty)) || 1),
    lineTotal: num(r.lineTotal),
    hsnCode: str(r.hsnCode),
    gstRate: optionalNumber(r.gstRate),
    taxableValue: optionalNumber(r.taxableValue),
    cgstAmount: num(r.cgstAmount),
    sgstAmount: num(r.sgstAmount),
    igstAmount: num(r.igstAmount),
    createdAt: parseDate(r.createdAt),
  };
}

function sheetToObjects(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

function buildDraftsFromWorkbook(wb: XLSX.WorkBook): OrderDraft[] {
  const names = wb.SheetNames.map((n) => n.toLowerCase());
  const ordersName = wb.SheetNames.find((_, i) => names[i] === "orders");
  const itemsName = wb.SheetNames.find(
    (_, i) => names[i] === "orderitems" || names[i] === "order_items" || names[i] === "items",
  );

  // Two-sheet backup (xlsx)
  if (ordersName && itemsName) {
    const orderRows = sheetToObjects(wb.Sheets[ordersName]!);
    const itemRows = sheetToObjects(wb.Sheets[itemsName]!);
    const map = new Map<string, OrderDraft>();

    for (const raw of orderRows) {
      const order = parseOrderFromRow(raw);
      if (!order) continue;
      map.set(order.orderNumber, { ...order, items: [] });
    }

    for (const raw of itemRows) {
      const orderNumber = str(rowDict(raw).orderNumber);
      if (!orderNumber) continue;
      const draft = map.get(orderNumber);
      if (!draft) continue;
      const item = parseItemFromRow(raw);
      if (item) draft.items.push(item);
    }

    return [...map.values()];
  }

  // Single-sheet / CSV denormalized
  const first = wb.SheetNames[0];
  if (!first) return [];
  const rows = sheetToObjects(wb.Sheets[first]!);
  const map = new Map<string, OrderDraft>();

  for (const raw of rows) {
    const order = parseOrderFromRow(raw);
    if (!order) continue;
    let draft = map.get(order.orderNumber);
    if (!draft) {
      draft = { ...order, items: [] };
      map.set(order.orderNumber, draft);
    }
    const item = parseItemFromRow(raw);
    if (item) draft.items.push(item);
  }

  return [...map.values()];
}

/**
 * Restores orders from an XLSX (Orders + OrderItems) or denormalized CSV backup.
 * Upserts by orderNumber; replaces line items. Skips coupon redemptions / order links.
 */
export async function importOrdersBackup(buffer: Buffer): Promise<{
  created: number;
  updated: number;
  itemCount: number;
  skipped: number;
  errors: string[];
}> {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    throw HttpError.badRequest("Could not read this file. Use the XLSX or CSV backup export.");
  }

  const drafts = buildDraftsFromWorkbook(wb);
  if (drafts.length === 0) {
    throw HttpError.badRequest("No orders found in this file.");
  }
  if (drafts.length > 20_000) {
    throw HttpError.badRequest("Backup has too many orders (max 20,000). Split the file.");
  }

  // Resolve which userIds still exist so we don't fail FK checks.
  const userIds = [...new Set(drafts.map((d) => d.userId).filter(Boolean))] as string[];
  const existingUsers =
    userIds.length === 0
      ? new Set<string>()
      : new Set(
          (
            await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true },
            })
          ).map((u) => u.id),
        );

  // Invoice / challan uniqueness across the DB — drop if claimed by another order.
  const invoiceNumbers = drafts.map((d) => d.invoiceNumber).filter(Boolean) as string[];
  const challanNumbers = drafts.map((d) => d.challanNumber).filter(Boolean) as string[];
  const [invoiceOwners, challanOwners] = await Promise.all([
    invoiceNumbers.length === 0
      ? []
      : prisma.order.findMany({
          where: { invoiceNumber: { in: invoiceNumbers } },
          select: { orderNumber: true, invoiceNumber: true },
        }),
    challanNumbers.length === 0
      ? []
      : prisma.order.findMany({
          where: { challanNumber: { in: challanNumbers } },
          select: { orderNumber: true, challanNumber: true },
        }),
  ]);
  const invoiceByNumber = new Map(invoiceOwners.map((o) => [o.invoiceNumber!, o.orderNumber]));
  const challanByNumber = new Map(challanOwners.map((o) => [o.challanNumber!, o.orderNumber]));

  let created = 0;
  let updated = 0;
  let itemCount = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const draft of drafts) {
    try {
      const userId =
        draft.userId && existingUsers.has(draft.userId) ? draft.userId : null;

      let invoiceNumber = draft.invoiceNumber;
      if (invoiceNumber) {
        const owner = invoiceByNumber.get(invoiceNumber);
        if (owner && owner !== draft.orderNumber) invoiceNumber = null;
      }

      let challanNumber = draft.challanNumber;
      if (challanNumber) {
        const owner = challanByNumber.get(challanNumber);
        if (owner && owner !== draft.orderNumber) challanNumber = null;
      }

      const existing = await prisma.order.findUnique({
        where: { orderNumber: draft.orderNumber },
        select: { id: true },
      });

      const orderData = {
        userId,
        customerName: draft.customerName,
        customerPhone: draft.customerPhone,
        customerEmail: draft.customerEmail,
        recipientName: draft.recipientName,
        deliveryPhone: draft.deliveryPhone,
        customerCompanyName: draft.customerCompanyName,
        customerGstin: draft.customerGstin,
        fulfillment: draft.fulfillment,
        deliveryAddress: draft.deliveryAddress,
        billingAddress: draft.billingAddress,
        isSurpriseGift: draft.isSurpriseGift,
        subtotal: draft.subtotal,
        deliveryFee: draft.deliveryFee,
        discount: draft.discount,
        couponCode: draft.couponCode,
        total: draft.total,
        taxableAmount: draft.taxableAmount,
        cgstAmount: draft.cgstAmount,
        sgstAmount: draft.sgstAmount,
        igstAmount: draft.igstAmount,
        placeOfSupply: draft.placeOfSupply,
        invoiceNumber,
        invoiceDate: draft.invoiceDate,
        challanNumber,
        challanDate: draft.challanDate,
        paymentMethod: draft.paymentMethod,
        paymentStatus: draft.paymentStatus,
        paymentMode: draft.paymentMode,
        advanceAmount: draft.advanceAmount,
        paymentScreenshotUrl: draft.paymentScreenshotUrl,
        status: draft.status,
        source: draft.source,
        customerNotes: draft.customerNotes,
        adminNotes: draft.adminNotes,
        ...(draft.createdAt ? { createdAt: draft.createdAt } : {}),
        ...(draft.updatedAt ? { updatedAt: draft.updatedAt } : {}),
      };

      await prisma.$transaction(async (tx) => {
        let orderId: string;

        if (existing) {
          await tx.orderItem.deleteMany({ where: { orderId: existing.id } });
          await tx.order.update({
            where: { id: existing.id },
            data: orderData,
          });
          orderId = existing.id;
          updated += 1;
        } else {
          // Prefer restoring the original id when free.
          let createId = draft.orderId;
          if (createId) {
            const idTaken = await tx.order.findUnique({
              where: { id: createId },
              select: { id: true },
            });
            if (idTaken) createId = null;
          }

          const createdOrder = await tx.order.create({
            data: {
              ...(createId ? { id: createId } : {}),
              orderNumber: draft.orderNumber,
              ...orderData,
            },
            select: { id: true },
          });
          orderId = createdOrder.id;
          created += 1;
        }

        if (draft.items.length > 0) {
          // Drop item ids that collide with other orders' items.
          const wantedIds = draft.items.map((i) => i.itemId).filter(Boolean) as string[];
          const collisions =
            wantedIds.length === 0
              ? []
              : await tx.orderItem.findMany({
                  where: { id: { in: wantedIds } },
                  select: { id: true },
                });
          const taken = new Set(collisions.map((c) => c.id));

          await tx.orderItem.createMany({
            data: draft.items.map((it) => ({
              ...(it.itemId && !taken.has(it.itemId) ? { id: it.itemId } : {}),
              orderId,
              productId: it.productId,
              productName: it.productName,
              productSlug: it.productSlug,
              productImage: it.productImage,
              sizeGrams: it.sizeGrams,
              sizeLabel: it.sizeLabel,
              flavourId: it.flavourId,
              flavourName: it.flavourName,
              messageOnCake: it.messageOnCake,
              instructions: it.instructions,
              referenceImageUrl: it.referenceImageUrl,
              deliveryDate: it.deliveryDate,
              deliverySlotKey: it.deliverySlotKey,
              deliverySlotLabel: it.deliverySlotLabel,
              unitPrice: it.unitPrice,
              qty: it.qty,
              lineTotal: it.lineTotal,
              hsnCode: it.hsnCode,
              gstRate: it.gstRate,
              taxableValue: it.taxableValue,
              cgstAmount: it.cgstAmount,
              sgstAmount: it.sgstAmount,
              igstAmount: it.igstAmount,
              ...(it.createdAt ? { createdAt: it.createdAt } : {}),
            })),
          });
          itemCount += draft.items.length;
        }

        if (invoiceNumber) invoiceByNumber.set(invoiceNumber, draft.orderNumber);
        if (challanNumber) challanByNumber.set(challanNumber, draft.orderNumber);
      });
    } catch (err) {
      skipped += 1;
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (errors.length < 25) errors.push(`${draft.orderNumber}: ${msg}`);
    }
  }

  return { created, updated, itemCount, skipped, errors };
}
