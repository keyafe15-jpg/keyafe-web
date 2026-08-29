import { cn } from "@/lib/cn";
import { Zap, Clock } from "lucide-react";

// Human-readable "when will this be ready" chip.
// - leadTimeHours = 0  → "Ready today"
// - < 24               → "Ready in Xhrs"
// - == 24              → "Ready in a day"
// - > 24               → "Ready in N days"
// If supportsSameDayDelivery is true it's rendered in the "same-day" pill style.
export function LeadTimeChip({
  leadTimeHours,
  supportsSameDay,
  className,
}: {
  leadTimeHours: number;
  supportsSameDay?: boolean;
  className?: string;
}) {
  const label = formatLeadTime(leadTimeHours, supportsSameDay);
  const isSameDay = supportsSameDay && leadTimeHours < 24;
  const Icon = isSameDay ? Zap : Clock;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        isSameDay ? "bg-brand-100 text-brand-700" : "bg-cream-100 text-ink-700",
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

export function formatLeadTime(
  leadTimeHours: number,
  supportsSameDay?: boolean,
): string {
  if (leadTimeHours <= 0) {
    return supportsSameDay ? "Ready today" : "Ready now";
  }
  if (leadTimeHours < 24) {
    return supportsSameDay
      ? `Same-day · order ${leadTimeHours}h ahead`
      : `Ready in ${leadTimeHours}h`;
  }
  const days = Math.round(leadTimeHours / 24);
  return days === 1 ? "Ready in 1 day" : `Ready in ${days} days`;
}
