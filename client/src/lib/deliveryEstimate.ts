// Pure helpers for the same-day delivery estimate shown on the PDP.
// Total lead time = product prep time (leadTimeHours) + zone-specific
// delivery transit time (extraLeadHours from the pincode check).

export interface SameDayEstimate {
  totalHours: number;
  readyAt: Date;
  timeLabel: string; // e.g. "4:30 PM"
  durationLabel: string; // e.g. "1h 30m"
}

export function computeSameDayEstimate(
  leadTimeHours: number,
  extraLeadHours: number,
  now: Date = new Date(),
): SameDayEstimate {
  const totalHours = Math.max(0, leadTimeHours) + Math.max(0, extraLeadHours);
  const readyAt = new Date(now.getTime() + totalHours * 3600_000);
  const timeLabel = readyAt.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });

  const totalMinutes = Math.max(15, Math.round(totalHours * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const durationLabel =
    hours > 0 && minutes > 0
      ? `${hours}h ${minutes}m`
      : hours > 0
        ? `${hours}h`
        : `${minutes}m`;

  return { totalHours, readyAt, timeLabel, durationLabel };
}

export function sameDaySlotLabel(estimate: SameDayEstimate): string {
  return `Same-day · arriving ~${estimate.timeLabel}`;
}
