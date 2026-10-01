import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { calendarDay } from "../../lib/calendarDay.js";
import {
  requirePermission,
  staffHasPermission,
  type AuthenticatedRequest,
  type StaffUser,
} from "../../middleware/auth.js";
import {
  closeCounterDay,
  copyMenu,
  createStall,
  daysQuerySchema,
  deleteSale,
  findDayId,
  getDayView,
  getStallSummary,
  istToday,
  listDays,
  listOpenDues,
  listStalls,
  menuItemView,
  parseSaleInput,
  recordSale,
  requireCounterDay,
  requireStall,
  setDayStatus,
  settleDue,
  settleDueSchema,
  updateStall,
} from "./stall.service.js";
import {
  addBreakfast,
  buildBreakfastStatement,
  createBreakfastBill,
  deleteBreakfast,
  getBreakfastMonth,
  monthSchema,
  parseBreakfastInput,
  updateBreakfast,
} from "./stall.breakfast.js";

export const adminStallRouter = Router();

const canSell = requirePermission("stall.sell", "stall.manage");
const canManage = requirePermission("stall.manage");

const staffOf = (req: Request): StaffUser => {
  const staff = (req as AuthenticatedRequest).staff;
  if (!staff) throw HttpError.unauthorized("Authentication required");
  return staff;
};

const param = (req: Request, key: string): string => {
  const value = req.params[key];
  if (!value) throw HttpError.badRequest(`Missing ${key}`);
  return value;
};

async function counterView(stallId: string, date: string) {
  const stall = await requireStall(stallId);
  return getDayView(await findDayId(stallId, date), {
    stall: { id: stall.id, name: stall.name },
    date,
  });
}

/** The counter works on today unless a missed day is picked (`?date=` or body `date`). */
const counterDate = (value: unknown) => {
  if (value == null || value === "") return istToday();
  const date = calendarDay.safeParse(value);
  if (!date.success) throw HttpError.badRequest("Invalid date");
  return date.data;
};

// ---------- Counter ----------

adminStallRouter.get("/", canSell, async (_req, res) => {
  res.json(await listStalls({ counter: true }));
});

adminStallRouter.get("/manage", canManage, async (_req, res) => {
  res.json(await listStalls({ counter: false }));
});

adminStallRouter.get("/days", canManage, async (req, res) => {
  const parsed = daysQuerySchema.safeParse(req.query);
  if (!parsed.success) throw HttpError.badRequest("Invalid date range", parsed.error.flatten());
  if (parsed.data.from > parsed.data.to) {
    throw HttpError.badRequest("From date must be before or equal to To date.");
  }
  res.json(await listDays(parsed.data));
});

adminStallRouter.post("/days/:dayId/close", canManage, async (req, res) => {
  const id = await setDayStatus(param(req, "dayId"), "CLOSED", staffOf(req));
  res.json(await getDayView(id));
});

adminStallRouter.post("/days/:dayId/reopen", canManage, async (req, res) => {
  const id = await setDayStatus(param(req, "dayId"), "OPEN", staffOf(req));
  res.json(await getDayView(id));
});

adminStallRouter.delete("/sales/:saleId", canSell, async (req, res) => {
  const staff = staffOf(req);
  const dayId = await deleteSale(param(req, "saleId"), {
    canManage: staffHasPermission(staff, "stall.manage"),
  });
  res.json(await getDayView(dayId));
});

adminStallRouter.get("/dues", canSell, async (req, res) => {
  const stallId = typeof req.query.stallId === "string" ? req.query.stallId : undefined;
  res.json(await listOpenDues(stallId || undefined));
});

adminStallRouter.post("/sales/:saleId/settle", canSell, async (req, res) => {
  const parsed = settleDueSchema.safeParse(req.body);
  if (!parsed.success) throw HttpError.badRequest("Pick cash or UPI");
  const dayId = await settleDue(param(req, "saleId"), parsed.data.paidVia, staffOf(req));
  res.json(await getDayView(dayId));
});

adminStallRouter.get("/:stallId/today", canSell, async (req, res) => {
  const date = counterDate(req.query.date);
  await requireCounterDay(param(req, "stallId"), date);
  res.json(await counterView(param(req, "stallId"), date));
});

adminStallRouter.post("/:stallId/sales", canSell, async (req, res) => {
  const date = counterDate(req.body?.date);
  const input = parseSaleInput(req.body);
  await requireCounterDay(param(req, "stallId"), date);
  await recordSale(param(req, "stallId"), date, input, staffOf(req), { allowClosed: false });
  res.status(201).json(await counterView(param(req, "stallId"), date));
});

adminStallRouter.post("/:stallId/today/close", canSell, async (req, res) => {
  const date = counterDate(req.body?.date);
  await requireCounterDay(param(req, "stallId"), date);
  const id = await closeCounterDay(param(req, "stallId"), date, staffOf(req));
  res.json(await getDayView(id));
});

// ---------- Office breakfast ----------

adminStallRouter.post("/:stallId/breakfast", canSell, async (req, res) => {
  const staff = staffOf(req);
  const stallId = param(req, "stallId");
  const input = parseBreakfastInput(req.body);
  const entry = await addBreakfast(stallId, input, staff, {
    canManage: staffHasPermission(staff, "stall.manage"),
  });
  res.status(201).json(entry);
});

adminStallRouter.patch("/breakfast/:id", canManage, async (req, res) => {
  await updateBreakfast(param(req, "id"), req.body);
  res.json({ ok: true });
});

adminStallRouter.delete("/breakfast/:id", canSell, async (req, res) => {
  await deleteBreakfast(param(req, "id"), {
    canManage: staffHasPermission(staffOf(req), "stall.manage"),
  });
  res.json({ ok: true });
});

const monthQuery = (value: unknown) => {
  const month = monthSchema.safeParse(value);
  if (!month.success) throw HttpError.badRequest("Pick a month");
  return month.data;
};

adminStallRouter.get("/:stallId/breakfast", canSell, async (req, res) => {
  const data = await getBreakfastMonth(param(req, "stallId"), monthQuery(req.query.month));
  if (staffHasPermission(staffOf(req), "stall.manage")) {
    res.json(data);
    return;
  }
  // Counter staff log plates; the company's details and bills stay with managers.
  res.json({
    ...data,
    stall: {
      ...data.stall,
      billToName: null,
      billToPhone: null,
      billToEmail: null,
      billToGstin: null,
      billToAddress: null,
    },
    bills: [],
  });
});

adminStallRouter.post("/:stallId/breakfast/bill", canManage, async (req, res) => {
  const order = await createBreakfastBill(param(req, "stallId"), monthQuery(req.body?.month));
  res.status(201).json(order);
});

adminStallRouter.get("/:stallId/breakfast/statement", canManage, async (req, res) => {
  const { pdf, filename } = await buildBreakfastStatement(
    param(req, "stallId"),
    monthQuery(req.query.month),
  );
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", pdf.length);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.end(pdf);
});

// ---------- Admin: any day ----------

const pastDay = (req: Request) => {
  const date = calendarDay.safeParse(param(req, "date"));
  if (!date.success) throw HttpError.badRequest("Invalid date");
  if (date.data > istToday()) throw HttpError.badRequest("That date is in the future");
  return date.data;
};

adminStallRouter.get("/:stallId/days/:date", canManage, async (req, res) => {
  const date = pastDay(req);
  const stall = await requireStall(param(req, "stallId"));
  res.json(
    await getDayView(await findDayId(stall.id, date), {
      stall: { id: stall.id, name: stall.name },
      date,
    }),
  );
});

adminStallRouter.post("/:stallId/days/:date/sales", canManage, async (req, res) => {
  const date = pastDay(req);
  const input = parseSaleInput(req.body);
  const dayId = await recordSale(param(req, "stallId"), date, input, staffOf(req), {
    allowClosed: true,
  });
  res.status(201).json(await getDayView(dayId));
});

// ---------- Admin: stalls ----------

adminStallRouter.post("/", canManage, async (req, res) => {
  res.status(201).json(await createStall(req.body));
});

adminStallRouter.get("/:stallId/summary", canManage, async (req, res) => {
  res.json(await getStallSummary(param(req, "stallId")));
});

adminStallRouter.patch("/:stallId", canManage, async (req, res) => {
  await updateStall(param(req, "stallId"), req.body);
  res.json({ ok: true });
});

const copyMenuSchema = z.object({ fromStallId: z.string().min(1) });

adminStallRouter.post("/:stallId/menu/copy", canManage, async (req, res) => {
  const parsed = copyMenuSchema.safeParse(req.body);
  if (!parsed.success) throw HttpError.badRequest("Pick a stall to copy from");
  const stall = await requireStall(param(req, "stallId"));
  res.json({ copied: await copyMenu(parsed.data.fromStallId, stall.id) });
});

adminStallRouter.delete("/:stallId", canManage, async (req, res) => {
  const stall = await prisma.stall.findUnique({
    where: { id: param(req, "stallId") },
    select: { id: true, name: true, _count: { select: { days: true } } },
  });
  if (!stall) throw HttpError.notFound("Stall not found");
  if (stall._count.days > 0) {
    throw HttpError.conflict(
      `“${stall.name}” has sales history, so it can't be deleted. Turn it off instead.`,
    );
  }
  await prisma.stall.delete({ where: { id: stall.id } });
  res.json({ id: stall.id, name: stall.name });
});

// ---------- Admin: menu ----------

const menuItemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  price: z.number().min(0).max(100_000),
  isActive: z.boolean().optional(),
});

adminStallRouter.post("/:stallId/menu", canManage, async (req, res) => {
  const parsed = menuItemSchema.safeParse(req.body);
  if (!parsed.success) throw HttpError.badRequest("Invalid menu item", parsed.error.flatten());
  await requireStall(param(req, "stallId"));
  const last = await prisma.stallMenuItem.aggregate({
    where: { stallId: param(req, "stallId") },
    _max: { sortOrder: true },
  });
  const item = await prisma.stallMenuItem.create({
    data: {
      ...parsed.data,
      stallId: param(req, "stallId"),
      sortOrder: (last._max.sortOrder ?? 0) + 10,
    },
  });
  res.status(201).json(menuItemView(item));
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

adminStallRouter.post("/:stallId/menu/reorder", canManage, async (req, res) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid reorder payload", parsed.error.flatten());
  }
  const { orderedIds } = parsed.data;
  if (new Set(orderedIds).size !== orderedIds.length) {
    throw HttpError.badRequest("Duplicate ids in reorder list");
  }
  const existing = await prisma.stallMenuItem.count({
    where: { id: { in: orderedIds }, stallId: param(req, "stallId") },
  });
  if (existing !== orderedIds.length) {
    throw HttpError.badRequest("One or more menu items were not found");
  }
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.stallMenuItem.update({ where: { id }, data: { sortOrder: (index + 1) * 10 } }),
    ),
  );
  res.json({ ok: true });
});

adminStallRouter.patch("/menu/:itemId", canManage, async (req, res) => {
  const parsed = menuItemSchema.partial().safeParse(req.body);
  if (!parsed.success) throw HttpError.badRequest("Invalid menu item", parsed.error.flatten());
  const exists = await prisma.stallMenuItem.findUnique({
    where: { id: param(req, "itemId") },
    select: { id: true },
  });
  if (!exists) throw HttpError.notFound("Menu item not found");
  const item = await prisma.stallMenuItem.update({
    where: { id: param(req, "itemId") },
    data: parsed.data,
  });
  res.json(menuItemView(item));
});

adminStallRouter.delete("/menu/:itemId", canManage, async (req, res) => {
  const item = await prisma.stallMenuItem.findUnique({
    where: { id: param(req, "itemId") },
    select: { id: true, name: true },
  });
  if (!item) throw HttpError.notFound("Menu item not found");
  await prisma.stallMenuItem.delete({ where: { id: item.id } });
  res.json(item);
});
