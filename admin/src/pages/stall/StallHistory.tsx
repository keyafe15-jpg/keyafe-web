import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, CalendarRange, ChevronRight } from "lucide-react";
import { useManageStalls, useStallDays, type Stall } from "@/hooks/useStalls";
import { customLabel, formatDayShort, monthRange, toInputDate } from "@/lib/dateRange";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/cn";
import { inputClass } from "@/components/form/Field";
import {
  DayStatusPill,
  Segmented,
  Select,
  StallSummaryCard,
  TotalsStrip,
  formatStallDates,
} from "./stall-ui";
import { StallDayDrawer, type DrawerTarget } from "./StallDayDrawer";

type Preset = "this-month" | "last-month" | "custom";

const NO_STALLS: Stall[] = [];

/** Past counter sheets: filter by stall and range, open a day to fix or reopen it. */
export function StallHistory() {
  const [preset, setPreset] = useState<Preset>("this-month");
  const [customFrom, setCustomFrom] = useState(() => monthRange(0).from);
  const [customTo, setCustomTo] = useState(() => toInputDate(new Date()));
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  const [addingDay, setAddingDay] = useState(false);
  const [stallId, setStallId] = useState("");
  const { data: stalls = NO_STALLS } = useManageStalls();
  const filterStall = stalls.find((s) => s.id === stallId) ?? null;

  const range =
    preset === "custom"
      ? { from: customFrom, to: customTo, label: customLabel(customFrom, customTo) }
      : monthRange(preset === "this-month" ? 0 : -1);
  const rangeValid = !!range.from && !!range.to && range.from <= range.to;
  const { data, isLoading, isError } = useStallDays(
    range.from,
    range.to,
    filterStall?.id ?? null,
    rangeValid,
  );
  const multiStall = stalls.length > 1;

  const pickStall = (id: string) => {
    setStallId(id);
    const picked = stalls.find((s) => s.id === id);
    if (picked?.kind === "EXHIBITION" && picked.startDate && picked.endDate) {
      setPreset("custom");
      setCustomFrom(picked.startDate);
      setCustomTo(picked.endDate);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Open a day to see what sold, fix entries, or reopen it.
        </p>
        {stalls.length > 0 && (
          <button
            type="button"
            onClick={() => setAddingDay((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <CalendarPlus className="h-4 w-4" /> Add a missed day
          </button>
        )}
      </div>

      {addingDay && (
        <AddDayForm
          stalls={stalls}
          initialStallId={filterStall?.id}
          onOpen={(target) => {
            setAddingDay(false);
            setDrawer(target);
          }}
        />
      )}

      <div className="mb-4 flex flex-col gap-3 rounded-card border border-slate-200 bg-white p-3 sm:p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {multiStall && (
            <Select
              value={stallId}
              onChange={(e) => pickStall(e.target.value)}
              aria-label="Stall"
              className="w-auto py-1.5"
            >
              <option value="">All stalls</option>
              {stalls.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.kind === "EXHIBITION" && s.startDate
                    ? ` · ${formatStallDates(s.startDate, s.endDate)}`
                    : ""}
                </option>
              ))}
            </Select>
          )}
          <Segmented
            value={preset}
            onChange={setPreset}
            options={[
              { key: "this-month", label: "This month" },
              { key: "last-month", label: "Last month" },
              { key: "custom", label: "Custom" },
            ]}
          />
        </div>
        {preset === "custom" ? (
          <div className="flex items-center gap-2">
            <CalendarRange className="hidden h-4 w-4 text-slate-400 sm:block" />
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              aria-label="From date"
              className={cn(inputClass, "py-1.5")}
            />
            <span className="text-xs text-slate-400 uppercase">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              aria-label="To date"
              className={cn(inputClass, "py-1.5")}
            />
          </div>
        ) : (
          <p className="text-sm font-medium text-slate-800">{range.label}</p>
        )}
      </div>

      {!rangeValid && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Pick a start date on or before the end date.
        </p>
      )}

      {filterStall?.kind === "EXHIBITION" && (
        <StallSummaryCard stallId={filterStall.id} className="mb-4" />
      )}

      {data && (
        <div className="mb-4 rounded-card border border-slate-200 bg-white p-3 sm:p-4">
          <TotalsStrip totals={data.totals} />
          <p className="mt-2 text-center text-xs text-slate-500">
            {data.days.length} day{data.days.length === 1 ? "" : "s"} · {data.totals.count} entr
            {data.totals.count === 1 ? "y" : "ies"}
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-card border border-slate-200 bg-white">
        {isLoading && <div className="p-8 text-center text-sm text-slate-500">Loading…</div>}
        {isError && (
          <div className="p-8 text-center text-sm text-red-600">Could not load stall sales.</div>
        )}
        {data && data.days.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            No stall sales in this period.
            {stalls.length === 0 && (
              <>
                {" "}
                <Link to="/stall/menu" className="font-medium text-brand-600 underline">
                  Set up the stall
                </Link>{" "}
                to get started.
              </>
            )}
          </div>
        )}
        {data && data.days.length > 0 && (
          <ul className="divide-y divide-slate-100">
            <li className="hidden grid-cols-[minmax(0,1fr)_6rem_6rem_6rem_1.5rem] gap-3 bg-slate-50 px-4 py-2 text-xs font-medium tracking-wide text-slate-500 uppercase md:grid">
              <span>Day</span>
              <span className="text-right">Cash</span>
              <span className="text-right">UPI</span>
              <span className="text-right">Total</span>
              <span />
            </li>
            {data.days.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => setDrawer({ stallId: d.stall.id, date: d.date })}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto_1.25rem] items-center gap-x-3 gap-y-0.5 px-4 py-3 text-left transition hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_6rem_6rem_6rem_1.5rem]"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{formatDayShort(d.date)}</span>
                      <DayStatusPill status={d.status} />
                      {d.lumpOverride && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-700 uppercase">
                          Lump sum
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {multiStall && !filterStall && `${d.stall.name} · `}
                      {d.count} entr{d.count === 1 ? "y" : "ies"}
                      <span className="md:hidden">
                        {" "}
                        · Cash {formatINR(d.cash)} · UPI {formatINR(d.upi)}
                      </span>
                    </span>
                  </span>
                  <span className="hidden text-right text-sm text-slate-700 tabular-nums md:block">
                    {formatINR(d.cash)}
                  </span>
                  <span className="hidden text-right text-sm text-slate-700 tabular-nums md:block">
                    {formatINR(d.upi)}
                  </span>
                  <span className="text-right font-semibold text-slate-900 tabular-nums">
                    {formatINR(d.total)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <StallDayDrawer target={drawer} stalls={stalls} onClose={() => setDrawer(null)} />
    </div>
  );
}

function AddDayForm({
  stalls,
  initialStallId,
  onOpen,
}: {
  stalls: Stall[];
  initialStallId?: string;
  onOpen: (target: DrawerTarget) => void;
}) {
  const today = toInputDate(new Date());
  const [stallId, setStallId] = useState(initialStallId ?? stalls[0]?.id ?? "");
  const [date, setDate] = useState(today);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (stallId && date && date <= today) onOpen({ stallId, date });
      }}
      className="mb-4 flex flex-wrap items-end gap-3 rounded-card border border-slate-200 bg-white p-4"
    >
      {stalls.length > 1 && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium tracking-wide text-slate-500 uppercase">
            Stall
          </span>
          <Select
            value={stallId}
            onChange={(e) => setStallId(e.target.value)}
            wrapperClassName="block"
          >
            {stalls.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </label>
      )}
      <label className="block">
        <span className="mb-1 block text-xs font-medium tracking-wide text-slate-500 uppercase">
          Date
        </span>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass}
        />
      </label>
      <button
        type="submit"
        disabled={!stallId || !date || date > today}
        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        Open day
      </button>
    </form>
  );
}
