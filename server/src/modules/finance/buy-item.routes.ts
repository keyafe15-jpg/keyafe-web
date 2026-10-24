import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import {
  BUY_ITEM_UNITS,
  buyItemSelect,
  dateKey,
  isMiscChargeName,
  isShippingChargeName,
  money,
  normalizeItemName,
  pageJson,
  pageParams,
  qtyNum,
  requireBooksWrite,
} from "./books.shared.js";
import { resolveCategory, serializeBuyItem } from "./purchase.service.js";

export const adminBuyItemRouter = Router();

adminBuyItemRouter.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const { page, pageSize, skip } = pageParams(req.query);
  const where: Prisma.BuyItemWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { nameNormalized: { contains: normalizeItemName(q) } },
    ];
  } else {
    where.isActive = true;
  }
  const [total, items] = await Promise.all([
    prisma.buyItem.count({ where }),
    prisma.buyItem.findMany({
      where,
      orderBy: [{ name: "asc" }],
      skip,
      take: pageSize,
      select: buyItemSelect,
    }),
  ]);
  res.json(pageJson(await withItemSummaries(items), total, page, pageSize));
});

adminBuyItemRouter.post("/", async (req, res) => {
  requireBooksWrite(req as AuthenticatedRequest);
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(120),
      unit: z.enum(BUY_ITEM_UNITS),
      packSize: z.coerce.number().int().positive().nullable().optional(),
      category: z.string().trim().min(1).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) throw HttpError.badRequest("Invalid item", parsed.error.flatten());
  if (isShippingChargeName(parsed.data.name)) {
    throw HttpError.badRequest("Delivery charge is a field on the buy, not an item");
  }
  if (isMiscChargeName(parsed.data.name)) {
    throw HttpError.badRequest("Handling and other extras are miscellaneous charges, not an item");
  }
  const nameNormalized = normalizeItemName(parsed.data.name);
  const existing = await prisma.buyItem.findUnique({
    where: { nameNormalized },
    select: buyItemSelect,
  });
  if (existing) {
    if (parsed.data.packSize && !existing.packSize) {
      const updated = await prisma.buyItem.update({
        where: { id: existing.id },
        data: { packSize: parsed.data.packSize },
        select: buyItemSelect,
      });
      res.status(200).json(serializeBuyItem(updated));
      return;
    }
    res.status(200).json(serializeBuyItem(existing));
    return;
  }
  const category = parsed.data.category ? await resolveCategory(parsed.data.category) : null;
  const created = await prisma.buyItem.create({
    data: {
      name: parsed.data.name.trim(),
      nameNormalized,
      unit: parsed.data.unit,
      packSize: parsed.data.packSize ?? null,
      categoryId: category?.id ?? null,
    },
    select: buyItemSelect,
  });
  res.status(201).json(serializeBuyItem(created));
});

adminBuyItemRouter.patch("/:id", async (req, res) => {
  requireBooksWrite(req as AuthenticatedRequest);
  const id = req.params.id ?? "";
  const parsed = z
    .object({
      category: z.string().trim().min(1).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) throw HttpError.badRequest("Invalid item", parsed.error.flatten());
  const existing = await prisma.buyItem.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw HttpError.notFound("Item not found");
  const category = parsed.data.category ? await resolveCategory(parsed.data.category) : undefined;
  const updated = await prisma.buyItem.update({
    where: { id },
    data: category ? { categoryId: category.id } : {},
    select: buyItemSelect,
  });
  res.json(serializeBuyItem(updated));
});

adminBuyItemRouter.get("/:id", async (req, res) => {
  const id = req.params.id ?? "";
  const { page, pageSize, skip } = pageParams(req.query);
  const item = await prisma.buyItem.findUnique({ where: { id }, select: buyItemSelect });
  if (!item) throw HttpError.notFound("Item not found");

  const where: Prisma.PurchaseLineWhereInput = {
    buyItemId: id,
    purchase: { voidedAt: null },
  };
  const [total, lines] = await Promise.all([
    prisma.purchaseLine.count({ where }),
    prisma.purchaseLine.findMany({
      where,
      orderBy: [{ purchase: { date: "desc" } }, { id: "desc" }],
      skip,
      take: pageSize,
      include: {
        purchase: {
          select: {
            id: true,
            date: true,
            purpose: true,
            vendor: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 90);
  const recent = await prisma.purchaseLine.findMany({
    where: {
      buyItemId: id,
      purchase: { voidedAt: null, date: { gte: since } },
    },
    select: { unitPrice: true, purchase: { select: { date: true } } },
  });

  const history = lines.map((line, i) => {
    const older = i < lines.length - 1 ? lines[i + 1] : null;
    const lastRate = older ? money(older.unitPrice) : null;
    const rate = money(line.unitPrice);
    const day = line.purchase.date;
    const windowStart = new Date(day);
    windowStart.setUTCDate(windowStart.getUTCDate() - 90);
    const inWindow = recent.filter((r) => r.purchase.date >= windowStart && r.purchase.date <= day);
    const cheapest90 =
      inWindow.length > 0 ? Math.min(...inWindow.map((r) => money(r.unitPrice))) : rate;
    return {
      id: line.id,
      purchaseId: line.purchase.id,
      date: dateKey(line.purchase.date),
      vendor: line.purchase.vendor,
      qty: qtyNum(line.qty),
      unitPrice: rate,
      amount: money(line.amount),
      purpose: line.purpose ?? line.purchase.purpose,
      vsLast: lastRate === null ? null : roundDiff(rate - lastRate),
      vsCheapest90: roundDiff(rate - cheapest90),
    };
  });

  res.json({
    ...serializeBuyItem(item),
    history: pageJson(history, total, page, pageSize),
  });
});

async function withItemSummaries(items: Parameters<typeof serializeBuyItem>[0][]) {
  const ids = items.map((item) => item.id);
  const lines =
    ids.length === 0
      ? []
      : await prisma.purchaseLine.findMany({
          where: { buyItemId: { in: ids }, purchase: { voidedAt: null } },
          select: {
            buyItemId: true,
            qty: true,
            unitPrice: true,
            amount: true,
            purchase: {
              select: {
                date: true,
                vendor: { select: { name: true } },
              },
            },
          },
          orderBy: [{ purchase: { date: "desc" } }, { id: "desc" }],
        });

  const byItem = new Map<
    string,
    {
      timesBought: number;
      totalQty: number;
      totalSpent: number;
      lastDate: string | null;
      lastVendor: string | null;
      lastRate: number | null;
      vendors: Set<string>;
    }
  >();
  for (const line of lines) {
    let row = byItem.get(line.buyItemId);
    if (!row) {
      row = {
        timesBought: 0,
        totalQty: 0,
        totalSpent: 0,
        lastDate: dateKey(line.purchase.date),
        lastVendor: line.purchase.vendor.name,
        lastRate: money(line.unitPrice),
        vendors: new Set(),
      };
      byItem.set(line.buyItemId, row);
    }
    row.timesBought += 1;
    row.totalQty = qtyNum(row.totalQty + qtyNum(line.qty));
    row.totalSpent = money(row.totalSpent + money(line.amount));
    row.vendors.add(line.purchase.vendor.name);
  }

  return items.map((item) => {
    const row = byItem.get(item.id);
    return {
      ...serializeBuyItem(item),
      timesBought: row?.timesBought ?? 0,
      totalQty: row?.totalQty ?? 0,
      totalSpent: row?.totalSpent ?? 0,
      lastDate: row?.lastDate ?? null,
      lastVendor: row?.lastVendor ?? null,
      lastRate: row?.lastRate ?? null,
      vendorCount: row?.vendors.size ?? 0,
    };
  });
}

function roundDiff(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
