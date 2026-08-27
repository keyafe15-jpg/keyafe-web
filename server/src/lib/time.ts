// Read the wall-clock time in a specific IANA timezone without depending on date-fns-tz.
// Returns weekday index (0=Sun..6=Sat) plus "HH:mm" and a UTC-midnight date key.

export interface WallTimeInZone {
  dayOfWeek: number; // 0=Sun .. 6=Sat
  dateKey: Date; // midnight UTC of the local date — used as SameDayScheduleException.date PK
  hourMinute: string; // "HH:mm" in 24-hour format
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function getWallTimeInZone(now: Date, timezone: string): WallTimeInZone {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";

  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour") === "24" ? "00" : get("hour"); // Node quirk on some locales
  const minute = get("minute");
  const weekday = get("weekday");

  const dayOfWeek = WEEKDAY_INDEX[weekday] ?? 0;
  const dateKey = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  const hourMinute = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;

  return { dayOfWeek, dateKey, hourMinute };
}

// Compare two "HH:mm" strings lexicographically — works because zero-padded.
export function hmBefore(a: string, b: string): boolean {
  return a < b;
}
