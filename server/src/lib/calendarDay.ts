import { z } from "zod";

/** A real calendar date as "YYYY-MM-DD". */
export const calendarDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine((value) => {
    const d = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }, "Not a real date");

export const calendarRange = z
  .object({ from: calendarDay, to: calendarDay })
  .refine((r) => r.from <= r.to, "From date must be before or equal to To date.");

export type CalendarRange = z.infer<typeof calendarRange>;

/** UTC midnight of a "YYYY-MM-DD" day — how @db.Date columns round-trip. */
export const dayToDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
