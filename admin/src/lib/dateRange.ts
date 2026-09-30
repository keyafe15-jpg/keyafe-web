/** "YYYY-MM-DD" of a Date in the browser's local timezone. */
export function toInputDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Whole calendar month, `offset` months from the current one (0 = this month). */
export function monthRange(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return {
    from: toInputDate(start),
    to: toInputDate(end),
    label: start.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
  };
}

export function customLabel(from: string, to: string) {
  const fmt = (day: string, withYear: boolean) =>
    new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      ...(withYear && { year: "numeric" }),
    });
  return from === to ? fmt(from, true) : `${fmt(from, false)} – ${fmt(to, true)}`;
}

/** "Thu, 1 Oct" for a "YYYY-MM-DD" day. */
export function formatDayShort(day: string) {
  return new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
