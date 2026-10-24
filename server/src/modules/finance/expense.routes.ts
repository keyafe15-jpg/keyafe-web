import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import type { ExpensePurpose } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { imageFromUpload, rateLimitSuggest } from "../ai/ai.service.js";
import { parseReceipt } from "./receipt.service.js";
import {
  BOOKS_PAY_METHODS,
  EXPENSE_PURPOSES,
  expenseInclude,
  gstParts,
  money,
  optionalDateKey,
  pageJson,
  pageParams,
  parseDateKey,
  requireBooksWrite,
  isSalaryCategory,
  VENDOR_CHANNELS,
} from "./books.shared.js";
import {
  expenseListWhere,
  booksMaskSalaries,
  createBooksPayer,
  createExpenseCategory,
  getExpense,
  listBooksPayers,
  resolveCategory,
  resolvePayer,
  resolveVendor,
  serializeCategory,
  serializeExpense,
  voidExpense,
} from "./purchase.service.js";

export const adminExpenseRouter = Router();

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_BYTES },
});

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

adminExpenseRouter.post("/parse-receipt", receiptUpload.single("image"), async (req, res) => {
  const staff = requireBooksWrite(req as AuthenticatedRequest);
  rateLimitSuggest(staff.id);
  if (!req.file) throw HttpError.badRequest("Add a photo or screenshot of the bill.");
  const kind = req.body?.kind === "EXPENSE" ? "EXPENSE" : req.body?.kind === "BUY" ? "BUY" : null;
  if (!kind) throw HttpError.badRequest("kind must be BUY or EXPENSE");
  const context =
    typeof req.body?.context === "string" ? req.body.context.trim().slice(0, 400) : null;
  const vendorId =
    typeof req.body?.vendorId === "string" ? req.body.vendorId.trim() || null : null;
  const image = imageFromUpload(req.file);
  res.json(await parseReceipt({ kind, image, context, vendorId }));
});

const expenseBodySchema = z.object({
  date: z.string().trim(),
  amount: z.coerce.number().positive(),
  category: z.string().trim().min(1),
  purpose: z.enum(EXPENSE_PURPOSES).optional(),
  paymentMethod: z.enum(BOOKS_PAY_METHODS),
  paidBy: z.string().trim().min(1).optional().nullable(),
  paidTo: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform((v) => v || null),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => v || null),
  cgst: z.coerce.number().nonnegative().optional(),
  sgst: z.coerce.number().nonnegative().optional(),
  igst: z.coerce.number().nonnegative().optional(),
  gst: z.coerce.number().nonnegative().optional(),
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
      gstin: z.string().trim().max(20).optional().nullable(),
      address: z.string().trim().max(400).optional().nullable(),
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

function paidToForCategory(
  category: { slug: string },
  paidTo: string | null | undefined,
  existing?: string | null,
) {
  const name = (paidTo === undefined ? existing : paidTo)?.trim() || null;
  if (isSalaryCategory(category)) {
    if (!name) throw HttpError.badRequest("Who was this salary paid to?");
    return name;
  }
  return null;
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
  const [total, rows, agg, maskSalaries] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
      include: expenseInclude,
    }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
    booksMaskSalaries(),
  ]);
  const salaryFilter =
    typeof req.query.category === "string" && isSalaryCategory(req.query.category);
  const sumMasked = Boolean(maskSalaries && salaryFilter);
  const sum = sumMasked ? 0 : money(agg._sum.amount ?? 0);
  res.json({
    ...pageJson(
      rows.map((row) => serializeExpense(row, { maskSalaries })),
      total,
      page,
      pageSize,
    ),
    sum,
    sumMasked,
    maskSalaries,
  });
});

adminExpenseRouter.get("/summary", async (req, res) => {
  const from = optionalDateKey(req.query.from);
  const to = optionalDateKey(req.query.to);
  const base = expenseListWhere({ from, to });
  const purchaseDate =
    from || to
      ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {};
  const purchaseWhere = { voidedAt: null, ...purchaseDate };
  const [all, buys, delivery, looseRows, lineRows, chargeAgg, chargeCount, catalog] =
    await Promise.all([
      prisma.expense.aggregate({ where: base, _sum: { amount: true }, _count: { id: true } }),
      prisma.expense.aggregate({
        where: { ...base, purchaseId: { not: null } },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { ...base, orderId: { not: null } },
        _sum: { amount: true },
      }),
      prisma.expense.groupBy({
        by: ["categoryId"],
        where: { ...base, purchaseId: null },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.purchaseLine.groupBy({
        by: ["categoryId"],
        where: { purchase: purchaseWhere },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.purchase.aggregate({
        where: purchaseWhere,
        _sum: { shipping: true, miscCharges: true },
      }),
      prisma.purchase.count({
        where: {
          ...purchaseWhere,
          OR: [{ shipping: { gt: 0 } }, { miscCharges: { gt: 0 } }],
        },
      }),
      prisma.expenseCategory.findMany({
        select: { id: true, slug: true, name: true, sortOrder: true },
      }),
    ]);
  const categoryById = new Map(catalog.map((c) => [c.id, c]));
  const rolled = new Map<string, { total: number; count: number }>();
  const add = (categoryId: string, amount: number, count: number) => {
    if (!(amount > 0) && count <= 0) return;
    const prev = rolled.get(categoryId) ?? { total: 0, count: 0 };
    rolled.set(categoryId, {
      total: money(prev.total + amount),
      count: prev.count + count,
    });
  };
  for (const row of looseRows) add(row.categoryId, money(row._sum.amount ?? 0), row._count.id);
  for (const row of lineRows) add(row.categoryId, money(row._sum.amount ?? 0), row._count.id);
  const misc = catalog.find((c) => c.slug === "miscellaneous");
  const charges = money(chargeAgg._sum.shipping ?? 0) + money(chargeAgg._sum.miscCharges ?? 0);
  if (misc && charges > 0) add(misc.id, charges, chargeCount);
  const maskSalaries = await booksMaskSalaries();
  const byCategory = [...rolled.entries()]
    .map(([id, row]) => {
      const cat = categoryById.get(id);
      if (!cat || row.total <= 0) return null;
      const hide = maskSalaries && isSalaryCategory(cat);
      return {
        id: cat.id,
        slug: cat.slug,
        name: cat.name,
        total: hide ? 0 : row.total,
        count: row.count,
        masked: hide,
        sortOrder: cat.sortOrder,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const total = money(all._sum.amount ?? 0);
  const buysSum = money(buys._sum.amount ?? 0);
  const deliverySum = money(delivery._sum.amount ?? 0);
  res.json({
    total,
    count: all._count.id,
    buys: buysSum,
    delivery: deliverySum,
    other: money(total - buysSum - deliverySum),
    maskSalaries,
    byCategory: byCategory.map(({ sortOrder: _s, ...row }) => row),
  });
});

adminExpenseRouter.get("/salary-payees", async (_req, res) => {
  if (await booksMaskSalaries()) {
    res.json({ items: [] });
    return;
  }
  const rows = await prisma.expense.findMany({
    where: { paidTo: { not: null } },
    select: { paidTo: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  const seen = new Set<string>();
  const items: string[] = [];
  for (const row of rows) {
    const name = row.paidTo?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(name);
  }
  items.sort((a, b) => a.localeCompare(b));
  res.json({ items });
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
    throw HttpError.badRequest("Add a title for this category");
  }
  const salary = isSalaryCategory(category);
  const vendorId = salary
    ? null
    : parsed.data.vendor
      ? await resolveVendor(parsed.data.vendor)
      : null;
  const paidTo = paidToForCategory(category, parsed.data.paidTo);
  const paidById = await resolvePayer(parsed.data.paidBy);
  const tax = gstParts(parsed.data);
  const created = await prisma.expense.create({
    data: {
      date: parseDateKey(parsed.data.date),
      amount: parsed.data.amount,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
      categoryId: category.id,
      purpose: purposeForCategory(category, parsed.data.purpose),
      vendorId,
      paidTo,
      paymentMethod: parsed.data.paymentMethod,
      notes,
      createdByUserId: staff.id,
      paidById,
    },
    include: expenseInclude,
  });
  res.status(201).json(serializeExpense(created, { maskSalaries: await booksMaskSalaries() }));
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
    throw HttpError.badRequest("Add a title for this category");
  }
  const salary = isSalaryCategory(category);
  let vendorId: string | null | undefined;
  if (salary) vendorId = null;
  else if (parsed.data.vendor === null) vendorId = null;
  else if (parsed.data.vendor) vendorId = await resolveVendor(parsed.data.vendor);
  const paidTo = paidToForCategory(
    category,
    parsed.data.paidTo,
    existing.paidTo,
  );

  const tax =
    parsed.data.cgst !== undefined ||
    parsed.data.sgst !== undefined ||
    parsed.data.igst !== undefined ||
    parsed.data.gst !== undefined
      ? gstParts(parsed.data)
      : null;
  const updated = await prisma.expense.update({
    where: { id },
    data: {
      date: parsed.data.date ? parseDateKey(parsed.data.date) : undefined,
      amount: parsed.data.amount,
      ...(tax ? { cgst: tax.cgst, sgst: tax.sgst, igst: tax.igst } : {}),
      categoryId: category.id,
      purpose: purposeForCategory(
        category,
        parsed.data.purpose ?? (existing.purpose as ExpensePurpose),
      ),
      ...(vendorId !== undefined ? { vendorId } : {}),
      paidTo,
      paymentMethod: parsed.data.paymentMethod,
      notes,
      ...(parsed.data.paidBy !== undefined
        ? { paidById: parsed.data.paidBy === null ? null : await resolvePayer(parsed.data.paidBy) }
        : {}),
    },
    include: expenseInclude,
  });
  res.json(serializeExpense(updated, { maskSalaries: await booksMaskSalaries() }));
});

adminExpenseRouter.post("/:id/void", async (req, res) => {
  requireBooksWrite(req as AuthenticatedRequest);
  res.json(await voidExpense(req.params.id ?? ""));
});
