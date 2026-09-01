import { useEffect, useState } from "react";
import {
  useStoreHours,
  useUpdateStoreHours,
  type WeeklyHours,
} from "@/hooks/useStoreHours";
import {
  Field,
  inputClass,
  submitClass,
  textareaClass,
} from "@/components/form/Field";
import { cn } from "@/lib/cn";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

const DEFAULT_OPEN = "11:00";
const DEFAULT_CLOSE = "23:00";

function sortWeekly(weekly: WeeklyHours[]) {
  const byDay = new Map(weekly.map((d) => [d.dayOfWeek, d]));
  return DAY_ORDER.map(
    (dayOfWeek) =>
      byDay.get(dayOfWeek) ?? {
        dayOfWeek,
        isClosed: false,
        openTime: DEFAULT_OPEN,
        closeTime: DEFAULT_CLOSE,
      },
  );
}

export function StoreHoursPage() {
  const { data, isLoading } = useStoreHours();
  const update = useUpdateStoreHours();

  const [closedNow, setClosedNow] = useState(false);
  const [closedMessage, setClosedMessage] = useState("");
  const [weekly, setWeekly] = useState<WeeklyHours[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setClosedNow(data.isSameDayStoreClosed);
    setClosedMessage(data.sameDayClosedMessage);
    setWeekly(sortWeekly(data.weekly));
  }, [data]);

  const patchDay = (dayOfWeek: number, patch: Partial<WeeklyHours>) => {
    setWeekly((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)),
    );
    setSaved(false);
  };

  const applyDefaultHours = () => {
    setWeekly((prev) =>
      prev.map((d) => ({
        ...d,
        isClosed: false,
        openTime: DEFAULT_OPEN,
        closeTime: DEFAULT_CLOSE,
      })),
    );
    setSaved(false);
  };

  const save = async () => {
    setError(null);
    setSaved(false);
    try {
      await update.mutateAsync({
        isSameDayStoreClosed: closedNow,
        sameDayClosedMessage: closedMessage.trim(),
        weekly,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save hours");
    }
  };

  const status = data?.status;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Store & Hours</h1>
        <p className="mt-1 text-sm text-slate-500">
          Same-day ordering window. Default is 11:00 AM – 11:00 PM every day.
          Times are in {data?.timezone ?? "Asia/Kolkata"}.
        </p>
      </div>

      {status && (
        <div
          className={cn(
            "mb-5 rounded-card border px-4 py-3 text-sm",
            status.isOpen
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-slate-200 bg-slate-50 text-slate-700",
          )}
        >
          <span className="font-semibold">
            {status.isOpen ? "Open now" : "Closed now"}
          </span>
          <span className="mx-2 text-slate-400">·</span>
          {status.message}
        </div>
      )}

      <section className="mb-5 rounded-card border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Kill switch</h2>
        <p className="mt-1 text-xs text-slate-500">
          Turns off same-day ordering immediately, regardless of the weekly
          schedule.
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={closedNow}
            onChange={(e) => {
              setClosedNow(e.target.checked);
              setSaved(false);
            }}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
          />
          <span>
            <span className="block text-sm text-slate-900">
              Close same-day store now
            </span>
            <span className="block text-xs text-slate-500">
              Customers will see the message below until you uncheck this.
            </span>
          </span>
        </label>
        <div className="mt-4">
          <Field label="Closed message">
            <textarea
              rows={2}
              value={closedMessage}
              onChange={(e) => {
                setClosedMessage(e.target.value);
                setSaved(false);
              }}
              className={textareaClass}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-card border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Weekly hours
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Each day can have its own window, or be marked closed.
            </p>
          </div>
          <button
            type="button"
            onClick={applyDefaultHours}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset all to 11 AM – 11 PM
          </button>
        </div>

        {isLoading || weekly.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">Loading…</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-2 font-medium">Day</th>
                <th className="px-4 py-2 font-medium">Open</th>
                <th className="px-4 py-2 font-medium">From</th>
                <th className="px-4 py-2 font-medium">To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {weekly.map((day) => (
                <tr
                  key={day.dayOfWeek}
                  className={cn(day.isClosed && "bg-slate-50/80")}
                >
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {DAY_NAMES[day.dayOfWeek]}
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={!day.isClosed}
                        onChange={(e) =>
                          patchDay(day.dayOfWeek, {
                            isClosed: !e.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                      />
                      {day.isClosed ? "Closed" : "Open"}
                    </label>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="time"
                      value={day.openTime}
                      disabled={day.isClosed}
                      onChange={(e) =>
                        patchDay(day.dayOfWeek, { openTime: e.target.value })
                      }
                      className={cn(inputClass, "w-32 disabled:bg-slate-100")}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="time"
                      value={day.closeTime}
                      disabled={day.isClosed}
                      onChange={(e) =>
                        patchDay(day.dayOfWeek, { closeTime: e.target.value })
                      }
                      className={cn(inputClass, "w-32 disabled:bg-slate-100")}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={update.isPending || weekly.length === 0}
          className={submitClass}
        >
          {update.isPending ? "Saving…" : "Save hours"}
        </button>
        {saved && !update.isPending && (
          <span className="text-xs text-emerald-700">Saved</span>
        )}
        {error && <span className="text-xs text-brand-700">{error}</span>}
      </div>
    </div>
  );
}
