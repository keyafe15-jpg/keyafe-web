import { Router } from "express";
import { z } from "zod";
import type { ExpensePurpose } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import {
  BOOKS_PAY_METHODS,
  EXPENSE_PURPOSES,
  expenseInclude,
  money,
  optionalDateKey,
  pageJson,
  pageParams,
  parseDateKey,
  requireBooksWrite,
  VENDOR_CHANNELS,
} from "./books.shared.js";
import {
  expenseListWhere,
  createBooksPayer,
  createExpenseCategory,
  getExpense,
  listBooksPayers,
  resolveCategory,
  resolvePayer,
  resolveVendor,
  serializeCategory,
  serializeExpense,
  voidPurchase,
} from "./purchase.service.js";

export const adminExpenseRouter = Router();

adminExpenseRouter.get("/categories", async (_req, res) => {
  const items = await prisma.expenseCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      sortOrder: true,
      marketing: true,
      requiresNote: true,
    },
  });
  res.json({ items: items.map(serializeCategory) });
});

adminExpenseRouter.post("/categories", async (req, res) => {
  requireBooksWrite(req as AuthenticatedRequest);
  const parsed = z
    .object({ name: z.string().trim().min(1).max(80) })
    .safeParse(req.body);
  if (!parsed.success) throw HttpError.badRequest("Invalid category", parsed.error.flatten());
  const created = await createExpenseCategory(parsed.data.name);
  res.status(201).json(created);
});

adminExpenseRouter.get("/payers", async (_req, res) => {
  res.json(await listBooksPayers());
});

adminExpenseRouter.post("/payers", async (req, res) => {
  requireBooksWrite(req as AuthenticatedRequest);
  const parsed = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(req.body);
  if (!parsed.success) throw HttpError.badRequest("Invalid name", parsed.error.flatten());
  res.status(201).json(await createBooksPayer(parsed.data.name));
});

const expenseBodySchema = z.object({
  date: z.string().trim(),
  amount: z.coerce.number().positive(),
  category: z.string().trim().min(1),
  purpose: z.enum(EXPENSE_PURPOSES).optional(),
  paymentMethod: z.enum(BOOKS_PAY_METHODS),
  paidBy: z.string().trim().min(1).optional().nullable(),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => v || null),
  vendor: z
    .object({
      id: z.string().min(1).optional(),
      name: z.string().trim().min(1).max(160).optional(),
      phone: z
        .string()
        .trim()
        .max(20)
        .optional()
        .nullable()
        .transform((v) => v || null),
      channel: z.enum(VENDOR_CHANNELS).optional(),
    })
    .optional()
    .nullable(),
});

function purposeForCategory(
  category: { marketing: boolean },
  requested?: ExpensePurpose,
): ExpensePurpose {
  if (category.marketing) return "MARKETING";
  return requested ?? "OPS";
}

adminExpenseRouter.get("/", async (req, res) => {
  const { page, pageSize, skip } = pageParams(req.query);
  const kindRaw = typeof req.query.kind === "string" ? req.query.kind : "ALL";
  const kind = kindRaw === "BUYS" || kindRaw === "OTHER" ? kindRaw : "ALL";
  const where = expenseListWhere({
    category: typeof req.query.category === "string" ? req.query.category : undefined,
    purpose: typeof req.query.purpose === "string" ? req.query.purpose : undefined,
    from: optionalDateKey(req.query.from),
    to: optionalDateKey(req.query.to),
    q: typeof req.query.q === "string" ? req.query.q.trim() : undefined,
    kind,
    includeVoided: req.query.includeVoided === "true",
  });
  const [total, rows, agg] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
      include: expenseInclude,
    }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
  ]);
  res.json({
    ...pageJson(rows.map(serializeExpense), total, page, pageSize),
    sum: money(agg._sum.amount ?? 0),
  });
});

adminExpenseRouter.get("/summary", async (req, res) => {
  const from = optionalDateKey(req.query.from);
  const to = optionalDateKey(req.query.to);
  const base = expenseListWhere({ from, to });
  const [all, buys, delivery] = await Promise.all([
    prisma.expense.aggregate({ where: base, _sum: { amount: true }, _count: { id: true } }),
    prisma.expense.aggregate({
      where: { ...base, purchaseId: { not: null } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { ...base, orderId: { not: null } },
      _sum: { amount: true },
    }),
  ]);
  const total = money(all._sum.amount ?? 0);
  const buysSum = money(buys._sum.amount ?? 0);
  const deliverySum = money(delivery._sum.amount ?? 0);
  res.json({
    total,
    count: all._count.id,
    buys: buysSum,
    delivery: deliverySum,
    other: money(total - buysSum - deliverySum),
  });
});

adminExpenseRouter.get("/:id", async (req, res) => {
  res.json(await getExpense(req.params.id ?? ""));
});

adminExpenseRouter.post("/", async (req, res) => {
  const staff = requireBooksWrite(req as AuthenticatedRequest);
  const parsed = expenseBodySchema.safeParse(req.body);
  if (!parsed.success) throw HttpError.badRequest("Invalid expense", parsed.error.flatten());
  const category = await resolveCategory(parsed.data.category);
  const notes = parsed.data.notes;
  if (category.requiresNote && !notes) {
    throw HttpError.badRequest("Add a note for miscellaneous");
  }
  const vendorId = parsed.data.vendor
    ? await resolveVendor(parsed.data.vendor)
    : null;
  const paidById = await resolvePayer(parsed.data.paidBy);
  const created = await prisma.expense.create({
    data: {
      date: parseDateKey(parsed.data.date),
      amount: parsed.data.amount,
      categoryId: category.id,
      purpose: purposeForCategory(category, parsed.data.purpose),
      vendorId,
      paymentMethod: parsed.data.paymentMethod,
      notes,
      createdByUserId: staff.id,
      paidById,
    },
    include: expenseInclude,
  });
  res.status(201).json(serializeExpense(created));
});

adminExpenseRouter.patch("/:id", async (req, res) => {
  requireBooksWrite(req as AuthenticatedRequest);
  const id = req.params.id ?? "";
  if ("purchaseId" in (req.body ?? {})) {
    throw HttpError.badRequest("Edit the buy instead of changing purchaseId");
  }
  const existing = await prisma.expense.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!existing) throw HttpError.notFound("Expense not found");
  if (existing.voidedAt) throw HttpError.badRequest("This expense is voided");
  if (existing.purchaseId) {
    throw HttpError.badRequest("Edit the buy to change this expense");
  }
  if (existing.orderId) {
    throw HttpError.badRequest("Edit the order to change this delivery expense");
  }
  const parsed = expenseBodySchema.partial().safeParse(req.body);
  if (!parsed.success) throw HttpError.badRequest("Invalid expense", parsed.error.flatten());
  const category = parsed.data.category
    ? await resolveCategory(parsed.data.category)
    : existing.category;
  const notes = parsed.data.notes === undefined ? existing.notes : parsed.data.notes;
  if (category.requiresNote && !notes) {
    throw HttpError.badRequest("Add a note for miscellaneous");
  }
  let vendorId: string | null | undefined;
  if (parsed.data.vendor === null) vendorId = null;
  else if (parsed.data.vendor) vendorId = await resolveVendor(parsed.data.vendor);

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      date: parsed.data.date ? parseDateKey(parsed.data.date) : undefined,
      amount: parsed.data.amount,
      categoryId: category.id,
      purpose: purposeForCategory(
        category,
        parsed.data.purpose ?? (existing.purpose as ExpensePurpose),
      ),
      ...(vendorId !== undefined ? { vendorId } : {}),
      paymentMethod: parsed.data.paymentMethod,
      notes,
      ...(parsed.data.paidBy !== undefined
        ? { paidById: parsed.data.paidBy === null ? null : await resolvePayer(parsed.data.paidBy) }
        : {}),
    },
    include: expenseInclude,
  });
  res.json(serializeExpense(updated));
});

adminExpenseRouter.post("/:id/void", async (req, res) => {
  requireBooksWrite(req as AuthenticatedRequest);
  const id = req.params.id ?? "";
  const existing = await prisma.expense.findUnique({
    where: { id },
    select: { id: true, purchaseId: true, orderId: true, voidedAt: true },
  });
  if (!existing) throw HttpError.notFound("Expense not found");
  if (existing.orderId) {
    throw HttpError.badRequest("Clear delivery we paid on the order to drop this expense");
  }
  if (existing.purchaseId) {
    await voidPurchase(existing.purchaseId);
    res.json(await getExpense(id));
    return;
  }
  if (!existing.voidedAt) {
    await prisma.expense.update({ where: { id }, data: { voidedAt: new Date() } });
  }
  res.json(await getExpense(id));
});
