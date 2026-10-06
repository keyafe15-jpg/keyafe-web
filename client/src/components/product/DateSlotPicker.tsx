import { useRef, useState, type ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/cn";
import { PRODUCT_COPY } from "@/content/product";
import { useShopClosures, closureForDate, closedDayMessage } from "@/hooks/useShopClosures";

const QUICK_DAYS = 5;

function isoOf(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return isoOf(d);
}

export function tomorrowIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return isoOf(d);
}

function dateFromIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function quickDays(allowToday: boolean) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const firstOffset = allowToday ? 0 : 1;
  return Array.from({ length: QUICK_DAYS }, (_, n) => {
    const i = n + firstOffset;
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const top =
      i === 0 ? (
        "Today"
      ) : i === 1 ? (
        <ShortLabel short="Tmrw" full="Tomorrow" />
      ) : (
        d.toLocaleDateString("en-IN", { weekday: "short" })
      );
    return {
      iso: isoOf(d),
      top,
      bottom: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    };
  });
}

export function DateSlotPicker({
  date,
  onDateChange,
  slot,
  onSlotChange,
  allowToday = true,
}: {
  date: string;
  onDateChange: (v: string) => void;
  slot: string;
  onSlotChange: (v: string) => void;
  /** False when today isn't deliverable (no same-day for this product right now). */
  allowToday?: boolean;
}) {
  const { data: closures = [] } = useShopClosures();
  const selectedHit = closureForDate(closures, date);
  const [pickError, setPickError] = useState<string | null>(null);
  const calendarRef = useRef<HTMLInputElement>(null);
  const days = quickDays(allowToday);
  const pickedOutsideQuick = date !== "" && !days.some((d) => d.iso === date);

  const handleDate = (next: string) => {
    if (!next) return;
    if (!allowToday && next < tomorrowIso()) {
      setPickError(PRODUCT_COPY.labels.noSameDay);
      return;
    }
    const hit = closureForDate(closures, next);
    if (hit) {
      setPickError(closedDayMessage(hit));
      return;
    }
    setPickError(null);
    onDateChange(next);
  };

  const openCalendar = () => {
    const input = calendarRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  };

  const dateError = pickError ?? (selectedHit ? closedDayMessage(selectedHit) : null);
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-medium tracking-wide text-ink-500 uppercase">
          {PRODUCT_COPY.labels.date}
        </p>
        <div
          role="group"
          aria-label={PRODUCT_COPY.labels.date}
          className="-mx-4 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 py-0.5 [-ms-overflow-style:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {days.map((d) => {
            const closed = closureForDate(closures, d.iso);
            return (
              <DateTile
                key={d.iso}
                active={d.iso === date}
                disabled={!!closed}
                title={closed ? closedDayMessage(closed) : undefined}
                top={d.top}
                bottom={closed ? "Closed" : d.bottom}
                onClick={() => handleDate(d.iso)}
              />
            );
          })}
          <div className="relative flex min-w-[3.25rem] flex-1 basis-0">
            <input
              ref={calendarRef}
              type="date"
              value={date}
              min={allowToday ? todayIso() : tomorrowIso()}
              onChange={(e) => handleDate(e.target.value)}
              onClick={openCalendar}
              aria-label={PRODUCT_COPY.labels.moreDates}
              className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
            />
            <DateTile
              className="peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/40"
              active={pickedOutsideQuick}
              top={
                pickedOutsideQuick ? (
                  dateFromIso(date).toLocaleDateString("en-IN", { weekday: "short" })
                ) : (
                  <ShortLabel short="More" full={PRODUCT_COPY.labels.moreDates} />
                )
              }
              bottom={
                pickedOutsideQuick ? (
                  dateFromIso(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                ) : (
                  <CalendarDays className="mx-auto h-4 w-4" />
                )
              }
            />
          </div>
        </div>
        {dateError && <p className="mt-1 text-xs text-brand-700">{dateError}</p>}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium tracking-wide text-ink-500 uppercase">
          {PRODUCT_COPY.labels.timeSlot}
        </p>
        <div
          role="group"
          aria-label={PRODUCT_COPY.labels.timeSlot}
          className="grid grid-cols-3 gap-2"
        >
          {PRODUCT_COPY.timeSlots.map((s) => {
            const active = s.key === slot;
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={active}
                aria-label={s.surcharge > 0 ? `${s.label}, +₹${s.surcharge}` : s.label}
                onClick={() => onSlotChange(s.key)}
                className={cn(
                  "relative rounded-lg border px-2 py-1.5 text-center transition",
                  active
                    ? "border-brand-500 bg-brand-500 text-white shadow-sm"
                    : "border-cream-200 bg-white text-ink-700 hover:border-ink-500/40",
                )}
              >
                <span className="block truncate text-[13px] font-medium">{s.name}</span>
                <span
                  className={cn(
                    "block truncate text-[11px]",
                    active ? "text-white/85" : "text-ink-500",
                  )}
                >
                  {s.time}
                </span>
                {s.surcharge > 0 && (
                  <span className="absolute -top-2 right-1.5 rounded-full bg-amber-100 px-1.5 text-[10px] leading-4 font-semibold text-amber-800">
                    +₹{s.surcharge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Narrow phones can't fit the full word in a date tile. */
function ShortLabel({ short, full }: { short: string; full: string }) {
  return (
    <>
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{full}</span>
    </>
  );
}

function DateTile({
  active,
  disabled,
  title,
  top,
  bottom,
  onClick,
  className: extraClass,
}: {
  active: boolean;
  disabled?: boolean;
  title?: string;
  top: ReactNode;
  bottom: ReactNode;
  /** Omit for a purely visual tile (an overlaid input handles the click). */
  onClick?: () => void;
  className?: string;
}) {
  const className = cn(
    extraClass,
    "block min-w-[3.25rem] flex-1 basis-0 rounded-lg border px-1 py-1.5 text-center transition",
    active
      ? "border-brand-500 bg-brand-500 text-white shadow-sm"
      : "border-cream-200 bg-white text-ink-700 hover:border-ink-500/40",
    disabled && "cursor-not-allowed opacity-40 hover:border-cream-200",
  );
  const content = (
    <>
      <span
        className={cn(
          "block truncate text-[11px] tracking-tight",
          active ? "text-white/85" : "text-ink-500",
        )}
      >
        {top}
      </span>
      <span className="block text-[13px] leading-5 font-semibold whitespace-nowrap">{bottom}</span>
    </>
  );
  if (!onClick) {
    return (
      <span aria-hidden className={className}>
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={className}
    >
      {content}
    </button>
  );
}
