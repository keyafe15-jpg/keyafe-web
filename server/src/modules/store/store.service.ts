import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { getWallTimeInZone, hmBefore } from "../../lib/time.js";

export interface SameDayStatus {
  isOpen: boolean;
  message: string;
  openTime?: string; // "HH:mm" today's opening (undefined if closed all day)
  closeTime?: string;
  timezone: string;
}

const DEFAULT_TIMEZONE = "Asia/Kolkata";
const DEFAULT_OPEN = "11:00";
const DEFAULT_CLOSE = "23:00";
const DEFAULT_CLOSED_MESSAGE =
  "Sorry — we're closed right now. Please check back later.";

function formatHm12(hm: string): string {
  const [rawHour, rawMinute] = hm.split(":");
  const h = Number(rawHour);
  const m = Number(rawMinute ?? 0);

  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return hm;
  }

  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0
    ? `${hour12} ${period}`
    : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export async function computeSameDayStatus(
  now: Date = new Date(),
): Promise<SameDayStatus> {
  const settings = await prisma.businessSettings.findFirst();

  const timezone = settings?.timezone ?? DEFAULT_TIMEZONE;
  const fallbackOpen = settings?.expressStart ?? DEFAULT_OPEN;
  const fallbackClose = settings?.expressEnd ?? DEFAULT_CLOSE;
  const closedMessage =
    settings?.sameDayClosedMessage ?? DEFAULT_CLOSED_MESSAGE;

  const { dayOfWeek, dateKey, hourMinute } = getWallTimeInZone(now, timezone);

  // 0. Whole-shop days off — kitchen is closed, so same-day is too.
  const shopOff = await findClosureCovering(dateKey);
  if (shopOff) {
    return {
      isOpen: false,
      message:
        shopOff.reason?.trim() ||
        "We're taking a few days off. Please order for a later date.",
      timezone,
    };
  }

  // 1. Admin kill switch — nukes same-day only.
  if (settings?.isSameDayStoreClosed) {
    return { isOpen: false, message: closedMessage, timezone };
  }

  // 2. Date-specific exception (highest priority after kill switch).
  const exception = await prisma.sameDayScheduleException.findUnique({
    where: { date: dateKey },
  });

  // 3. Weekly schedule.
  const weekly = await prisma.sameDayScheduleWeekly.findUnique({
    where: { dayOfWeek },
  });

  const rule = exception ?? weekly;

  if (rule?.isClosed) {
    return { isOpen: false, message: closedMessage, timezone };
  }

  const openTime = rule?.openTime ?? fallbackOpen;
  const closeTime = rule?.closeTime ?? fallbackClose;

  const isOpen =
    !hmBefore(hourMinute, openTime) && hmBefore(hourMinute, closeTime);

  if (isOpen) {
    return {
      isOpen: true,
      message: `Open · closes at ${formatHm12(closeTime)}`,
      openTime,
      closeTime,
      timezone,
    };
  }

  // Closed — before or after hours today.
  if (hmBefore(hourMinute, openTime)) {
    return {
      isOpen: false,
      message: `Closed · opens at ${formatHm12(openTime)}`,
      openTime,
      closeTime,
      timezone,
    };
  }
  return {
    isOpen: false,
    message: closedMessage,
    openTime,
    closeTime,
    timezone,
  };
}

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_WEEKLY: Array<{
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
}> = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  isClosed: false,
  openTime: DEFAULT_OPEN,
  closeTime: DEFAULT_CLOSE,
}));

export const weeklyDaySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isClosed: z.boolean(),
  openTime: z
    .string()
    .transform((v) => v.slice(0, 5))
    .refine((v) => HM.test(v), "Use HH:mm"),
  closeTime: z
    .string()
    .transform((v) => v.slice(0, 5))
    .refine((v) => HM.test(v), "Use HH:mm"),
});

export const updateStoreHoursSchema = z.object({
  isSameDayStoreClosed: z.boolean(),
  sameDayClosedMessage: z.string().trim().min(1).max(280),
  weekly: z.array(weeklyDaySchema).length(7),
});

export type UpdateStoreHoursInput = z.infer<typeof updateStoreHoursSchema>;

function mergeWeekly(
  rows: Array<{
    dayOfWeek: number;
    isClosed: boolean;
    openTime: string | null;
    closeTime: string | null;
  }>,
) {
  const byDay = new Map(rows.map((r) => [r.dayOfWeek, r]));
  return DEFAULT_WEEKLY.map((fallback) => {
    const row = byDay.get(fallback.dayOfWeek);
    return {
      dayOfWeek: fallback.dayOfWeek,
      isClosed: row?.isClosed ?? fallback.isClosed,
      openTime: row?.openTime ?? fallback.openTime,
      closeTime: row?.closeTime ?? fallback.closeTime,
    };
  });
}

export async function getStoreHours() {
  const [settings, weeklyRows, status, closures] = await Promise.all([
    prisma.businessSettings.findFirst({
      select: {
        timezone: true,
        isSameDayStoreClosed: true,
        sameDayClosedMessage: true,
      },
    }),
    prisma.sameDayScheduleWeekly.findMany({
      orderBy: { dayOfWeek: "asc" },
      select: {
        dayOfWeek: true,
        isClosed: true,
        openTime: true,
        closeTime: true,
      },
    }),
    computeSameDayStatus(),
    listUpcomingClosures(),
  ]);

  return {
    timezone: settings?.timezone ?? DEFAULT_TIMEZONE,
    isSameDayStoreClosed: settings?.isSameDayStoreClosed ?? false,
    sameDayClosedMessage:
      settings?.sameDayClosedMessage ?? DEFAULT_CLOSED_MESSAGE,
    weekly: mergeWeekly(weeklyRows),
    closures,
    status,
  };
}

export async function updateStoreHours(input: UpdateStoreHoursInput) {
  const seen = new Set<number>();
  for (const day of input.weekly) {
    if (seen.has(day.dayOfWeek)) {
      throw HttpError.badRequest("Each weekday can only appear once");
    }
    seen.add(day.dayOfWeek);
    if (!day.isClosed && !hmBefore(day.openTime, day.closeTime)) {
      throw HttpError.badRequest(
        `Open time must be before close time on day ${day.dayOfWeek}`,
      );
    }
  }
  if (seen.size !== 7) {
    throw HttpError.badRequest("Send a row for every day of the week");
  }

  const settings = await prisma.businessSettings.findFirst({
    select: { id: true },
  });
  if (!settings) throw HttpError.notFound("Business settings not found");

  await prisma.$transaction([
    prisma.businessSettings.update({
      where: { id: settings.id },
      data: {
        isSameDayStoreClosed: input.isSameDayStoreClosed,
        sameDayClosedMessage: input.sameDayClosedMessage,
      },
    }),
    ...input.weekly.map((day) =>
      prisma.sameDayScheduleWeekly.upsert({
        where: { dayOfWeek: day.dayOfWeek },
        create: {
          dayOfWeek: day.dayOfWeek,
          isClosed: day.isClosed,
          openTime: day.openTime,
          closeTime: day.closeTime,
        },
        update: {
          isClosed: day.isClosed,
          openTime: day.openTime,
          closeTime: day.closeTime,
        },
      }),
    ),
  ]);

  return getStoreHours();
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function calendarDateUtc(isoYmd: string): Date {
  const ymd = isoYmd.slice(0, 10);
  if (!YMD.test(ymd)) throw HttpError.badRequest("Invalid date");
  return new Date(`${ymd}T00:00:00.000Z`);
}

function serializeClosure(row: {
  id: string;
  startsOn: Date;
  endsOn: Date;
  reason: string | null;
}) {
  return {
    id: row.id,
    startsOn: row.startsOn.toISOString().slice(0, 10),
    endsOn: row.endsOn.toISOString().slice(0, 10),
    reason: row.reason,
  };
}

export async function findClosureCovering(date: Date) {
  return prisma.shopClosure.findFirst({
    where: {
      startsOn: { lte: date },
      endsOn: { gte: date },
    },
    orderBy: { startsOn: "asc" },
  });
}

export async function assertKitchenOpenOn(isoYmd: string) {
  const covering = await findClosureCovering(calendarDateUtc(isoYmd));
  if (!covering) return;
  throw HttpError.badRequest(
    covering.reason?.trim()
      ? `We're closed that day — ${covering.reason.trim()}`
      : "We're closed on that date. Please pick another day.",
  );
}

export async function listUpcomingClosures() {
  const today = calendarDateUtc(new Date().toISOString());
  const rows = await prisma.shopClosure.findMany({
    where: { endsOn: { gte: today } },
    orderBy: { startsOn: "asc" },
  });
  return rows.map(serializeClosure);
}

export const createClosureSchema = z.object({
  startsOn: z.string().regex(YMD),
  endsOn: z.string().regex(YMD),
  reason: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});

export async function createShopClosure(input: z.infer<typeof createClosureSchema>) {
  const startsOn = calendarDateUtc(input.startsOn);
  const endsOn = calendarDateUtc(input.endsOn);
  if (endsOn < startsOn) {
    throw HttpError.badRequest("End date must be on or after the start date");
  }
  const created = await prisma.shopClosure.create({
    data: {
      startsOn,
      endsOn,
      reason: input.reason,
    },
  });
  return serializeClosure(created);
}

export async function deleteShopClosure(id: string) {
  const existing = await prisma.shopClosure.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw HttpError.notFound("Closure not found");
  await prisma.shopClosure.delete({ where: { id } });
}
