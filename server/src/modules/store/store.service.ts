import { prisma } from "../../config/db.js";
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

  // 1. Admin kill switch — nukes everything else.
  if (settings?.isSameDayStoreClosed) {
    return { isOpen: false, message: closedMessage, timezone };
  }

  const { dayOfWeek, dateKey, hourMinute } = getWallTimeInZone(now, timezone);

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
