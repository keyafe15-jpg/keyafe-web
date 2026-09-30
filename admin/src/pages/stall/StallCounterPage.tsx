import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, CheckCircle2, Lock, MapPin } from "lucide-react";
import {
  useCloseStallDay,
  useDeleteStallSale,
  useRecordStallSale,
  useSetStallDayStatus,
  useStallCounterDay,
  useStalls,
  type Stall,
  type StallSale,
  type StallSaleInput,
} from "@/hooks/useStalls";
import { useStaffPermission } from "@/lib/permissions";
import { formatDayShort, toInputDate } from "@/lib/dateRange";
import { formatINR } from "@/lib/money";
import {
  CartPanel,
  DayStatusPill,
  ItemPicker,
  LumpOverrideNote,
  LumpSumForm,
  SaleList,
  Segmented,
  Select,
  StallStatusBadge,
  TotalsStrip,
  cartToInput,
  cartTotal,
  formatStallDates,
  type Cart,
} from "./stall-ui";

const STALL_KEY = "keyafe.stall.selected";
const NO_STALLS: Stall[] = [];

type Mode = "items" | "lump";

export function StallCounterPage() {
  const { data: stalls = NO_STALLS, isLoading } = useStalls();
  const canManage = useStaffPermission("stall.manage");
  const [pickedId, setPickedId] = useState(() => localStorage.getItem(STALL_KEY));
  const stall = stalls.find((s) => s.id === pickedId) ?? stalls[0] ?? null;

  if (isLoading) return <div className="p-8 text-center text-sm text-slate-500">Loading…</div>;

  if (!stall) {
    return (
      <div className="mx-auto max-w-md rounded-card border border-slate-200 bg-white p-6 text-center">
        <p className="font-medium text-slate-900">No stall running today</p>
        <p className="mt-1 text-sm text-slate-500">
          {canManage
            ? "Set up a stall, or check the exhibition dates and that the stall is switched on."
            : "Ask an admin to set up the stall."}
        </p>
        {canManage && (
          <Link
            to="/stall/menu"
            className="mt-4 inline-flex rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Stalls &amp; menus
          </Link>
        )}
      </div>
    );
  }

  return (
    <StallCounter
      key={stall.id}
      stall={stall}
      stalls={stalls}
      canManage={canManage}
      onPickStall={(id) => {
        localStorage.setItem(STALL_KEY, id);
        setPickedId(id);
      }}
    />
  );
}

function StallCounter({
  stall,
  stalls,
  canManage,
  onPickStall,
}: {
  stall: Stall;
  stalls: Stall[];
  canManage: boolean;
  onPickStall: (id: string) => void;
}) {
  const todayKey = toInputDate(new Date());
  const allowed = stall.counterWindow;
  const defaultDate = allowed?.to ?? todayKey;
  const [date, setDate] = useState(defaultDate);
  const isToday = date === todayKey;
  const today = useStallCounterDay(stall.id, date);
  const record = useRecordStallSale(stall.id, date);
  const close = useCloseStallDay(stall.id, date);
  const reopen = useSetStallDayStatus();
  const del = useDeleteStallSale();
  const [mode, setMode] = useState<Mode>(stall.menu.length > 0 ? "items" : "lump");
  const [cart, setCart] = useState<Cart>({});
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 2500);
    return () => window.clearTimeout(t);
  }, [flash]);

  const day = today.data;
  const closed = day?.status === "CLOSED";

  const save = async (input: StallSaleInput, label: string) => {
    setError(null);
    try {
      await record.mutateAsync(input);
      setFlash(label);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Try again.");
      throw err;
    }
  };

  const pay = (method: "CASH" | "UPI") => {
    const total = cartTotal(cart, stall.menu);
    void save(
      cartToInput(cart, method),
      `${formatINR(total)} · ${method === "CASH" ? "Cash" : "UPI"}`,
    )
      .then(() => setCart({}))
      .catch(() => {});
  };

  const onReopen = () => {
    if (!day?.id) return;
    setError(null);
    reopen.mutate(
      { dayId: day.id, action: "reopen" },
      {
        onError: (err) => setError(err instanceof Error ? err.message : "Could not reopen the day"),
      },
    );
  };

  const onDelete = (sale: StallSale) => {
    if (!confirm(`Remove this ${formatINR(sale.cashAmount + sale.upiAmount)} entry?`)) return;
    setError(null);
    del.mutate(sale.id, {
      onError: (err) => setError(err instanceof Error ? err.message : "Could not remove entry"),
    });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 rounded-card border border-slate-200 bg-white p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            {stalls.length > 1 ? (
              <Select
                value={stall.id}
                onChange={(e) => onPickStall(e.target.value)}
                aria-label="Stall"
                title="Switch stall"
                className="py-1.5 font-semibold"
              >
                {stalls.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            ) : (
              <h1 className="truncate text-lg font-semibold text-slate-900">{stall.name}</h1>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <label
                title="Pick a missed day to enter its sales"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:border-slate-300"
              >
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <input
                  type="date"
                  value={date}
                  min={allowed?.from}
                  max={allowed?.to ?? todayKey}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    setDate(e.target.value);
                    setError(null);
                  }}
                  aria-label="Sales date"
                  className="bg-transparent text-xs text-slate-700 outline-none"
                />
              </label>
              {date !== defaultDate && (
                <button
                  type="button"
                  onClick={() => setDate(defaultDate)}
                  className="font-medium text-brand-600 hover:text-brand-700"
                >
                  {defaultDate === todayKey ? "Back to today" : "Back to last day"}
                </button>
              )}
              {day && day.totals.count > 0 && (
                <span>
                  {day.totals.count} entr{day.totals.count === 1 ? "y" : "ies"}
                </span>
              )}
            </div>
          </div>
          {day && <DayStatusPill status={day.status} />}
        </div>
        {!isToday && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Entering sales for <span className="font-semibold">{formatDayShort(date)}</span>, not
            today.
          </p>
        )}
        {stall.kind === "EXHIBITION" && (
          <div className="-mt-1 mb-3 space-y-0.5 text-xs text-slate-500">
            <p className="flex items-center gap-1.5">
              <StallStatusBadge stall={stall} />
              <span>
                {formatStallDates(stall.startDate, stall.endDate)}
                {stall.days ? ` · ${stall.days} day${stall.days === 1 ? "" : "s"}` : ""}
              </span>
            </p>
            {stall.location && (
              <p className="flex items-start gap-1">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="line-clamp-2 whitespace-pre-line">{stall.location}</span>
              </p>
            )}
          </div>
        )}
        {day ? (
          <>
            <TotalsStrip totals={day.totals} />
            {day.lumpOverride && (
              <LumpOverrideNote tappedTotal={day.tappedTotals.total} className="mt-3" />
            )}
          </>
        ) : (
          <p className="py-3 text-center text-sm text-slate-500">
            {today.isError
              ? today.error instanceof Error
                ? today.error.message
                : "Could not load this day’s sales."
              : "Loading…"}
          </p>
        )}
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {closed ? (
        <div className="mb-4 flex items-start gap-3 rounded-card border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p className="min-w-0 flex-1">
            Day closed
            {day?.closedByName ? ` by ${day.closedByName}` : ""}
            {day?.closedAt
              ? ` at ${new Date(day.closedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`
              : ""}
            . {canManage ? "Reopen it to add or remove entries." : "Ask an admin to reopen it."}
          </p>
          {canManage && day?.id && (
            <button
              type="button"
              disabled={reopen.isPending}
              onClick={onReopen}
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {reopen.isPending ? "Reopening…" : "Reopen day"}
            </button>
          )}
        </div>
      ) : (
        <>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { key: "items", label: "Tap items" },
              { key: "lump", label: "Lump sum" },
            ]}
            className="mb-3"
          />

          {mode === "items" ? (
            stall.menu.length === 0 ? (
              <div className="rounded-card border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                The menu is empty.{" "}
                {canManage ? (
                  <Link to="/stall/menu" className="font-medium text-brand-600 underline">
                    Add items
                  </Link>
                ) : (
                  "Use Lump sum, or ask an admin to add menu items."
                )}
              </div>
            ) : (
              <>
                <ItemPicker
                  menu={stall.menu}
                  cart={cart}
                  onAdd={(id) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }))}
                  disabled={record.isPending}
                />
                <div className="sticky bottom-3 z-10 mt-3">
                  <CartPanel
                    menu={stall.menu}
                    cart={cart}
                    setCart={setCart}
                    onPay={pay}
                    saving={record.isPending}
                  />
                </div>
              </>
            )
          ) : (
            <div className="rounded-card border border-slate-200 bg-white p-4">
              <LumpSumForm
                saving={record.isPending}
                tapped={day?.tappedTotals}
                onSubmit={(input) =>
                  save(
                    input,
                    `${formatINR(input.kind === "CONSOLIDATED" ? input.cashAmount + input.upiAmount : 0)} lump sum`,
                  )
                }
              />
            </div>
          )}
        </>
      )}

      {flash && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-sm items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> Saved {flash}
        </div>
      )}

      <section className="mt-6 rounded-card border border-slate-200 bg-white px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">
          {isToday ? "Today’s entries" : `Entries for ${formatDayShort(date)}`}
        </h2>
        <SaleList
          sales={day?.sales ?? []}
          onDelete={closed ? undefined : onDelete}
          deletingId={del.isPending ? del.variables : null}
          lumpOverride={day?.lumpOverride}
        />
      </section>

      {!closed && day && (
        <button
          type="button"
          onClick={() => setConfirmClose(true)}
          className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Close day
        </button>
      )}

      <Dialog.Root open={confirmClose} onOpenChange={setConfirmClose}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-card bg-white p-5 shadow-xl">
            <Dialog.Title className="text-lg font-semibold text-slate-900">
              {isToday ? "Close today’s sales?" : `Close sales for ${formatDayShort(date)}?`}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-slate-500">
              Check these match the cash in hand and your UPI app. You won&rsquo;t be able to add or
              remove entries after closing.
            </Dialog.Description>
            {day && <TotalsStrip totals={day.totals} className="my-4" />}
            {close.isError && (
              <p className="mb-3 text-sm text-red-600">
                {close.error instanceof Error ? close.error.message : "Could not close the day"}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Dialog.Close className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Cancel
              </Dialog.Close>
              <button
                type="button"
                disabled={close.isPending}
                onClick={() => close.mutate(undefined, { onSuccess: () => setConfirmClose(false) })}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {close.isPending ? "Closing…" : "Close day"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
