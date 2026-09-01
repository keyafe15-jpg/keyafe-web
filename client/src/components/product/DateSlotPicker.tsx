import { useState } from "react";
import { cn } from "@/lib/cn";
import { PRODUCT_COPY } from "@/content/product";
import {
  useShopClosures,
  closureForDate,
  closedDayMessage,
} from "@/hooks/useShopClosures";

export function todayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DateSlotPicker({
  date,
  onDateChange,
  slot,
  onSlotChange,
}: {
  date: string;
  onDateChange: (v: string) => void;
  slot: string;
  onSlotChange: (v: string) => void;
}) {
  const { data: closures = [] } = useShopClosures();
  const selectedHit = closureForDate(closures, date);
  const [pickError, setPickError] = useState<string | null>(null);

  const handleDate = (next: string) => {
    const hit = closureForDate(closures, next);
    if (hit) {
      setPickError(closedDayMessage(hit));
      return;
    }
    setPickError(null);
    onDateChange(next);
  };

  const dateError = pickError ?? (selectedHit ? closedDayMessage(selectedHit) : null);
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">
          {PRODUCT_COPY.labels.date}
        </label>
        <input
          type="date"
          value={date}
          min={todayIso()}
          onChange={(e) => handleDate(e.target.value)}
          className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
        {dateError && (
          <p className="mt-1 text-xs text-brand-700">{dateError}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">
          {PRODUCT_COPY.labels.timeSlot}
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PRODUCT_COPY.timeSlots.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => onSlotChange(s.key)}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
                s.key === slot
                  ? "border-brand-500 bg-brand-100 text-brand-700"
                  : "border-cream-200 bg-white text-ink-700 hover:border-brand-300",
              )}
            >
              <span>{s.label}</span>
              {s.surcharge > 0 && (
                <span className="text-xs text-ink-500">+₹{s.surcharge}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
