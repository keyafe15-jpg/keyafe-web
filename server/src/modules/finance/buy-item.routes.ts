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
  isShippingChargeName,
  money,
  normalizeItemName,
  pageJson,
  pageParams,
  qtyNum,
  requireBooksWrite,
} from "./books.shared.js";
import { serializeBuyItem } from "./purchase.service.js";

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
  res.json(pageJson(items.map(serializeBuyItem), total, page, pageSize));
});

adminBuyItemRouter.post("/", async (req, res) => {
  requireBooksWrite(req as AuthenticatedRequest);
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(120),
      unit: z.enum(BUY_ITEM_UNITS),
      packSize: z.coerce.number().int().positive().nullable().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) throw HttpError.badRequest("Invalid item", parsed.error.flatten());
  if (isShippingChargeName(parsed.data.name)) {
    throw HttpError.badRequest("Delivery charge is a field on the buy, not an item");
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
  const created = await prisma.buyItem.create({
    data: {
      name: parsed.data.name.trim(),
      nameNormalized,
      unit: parsed.data.unit,
      packSize: parsed.data.packSize ?? null,
    },
    select: buyItemSelect,
  });
  res.status(201).json(serializeBuyItem(created));
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

function roundDiff(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
