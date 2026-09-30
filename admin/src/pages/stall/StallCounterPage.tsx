import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, Lock } from "lucide-react";
import {
  useCloseStallToday,
  useDeleteStallSale,
  useRecordStallSale,
  useStallToday,
  useStalls,
  type Stall,
  type StallSale,
  type StallSaleInput,
} from "@/hooks/useStalls";
import { useStaffPermission } from "@/lib/permissions";
import { formatDayShort } from "@/lib/dateRange";
import { formatINR } from "@/lib/money";
import { selectClass } from "@/components/form/Field";
import {
  CartPanel,
  DayStatusPill,
  ItemPicker,
  LumpSumForm,
  SaleList,
  Segmented,
  TotalsStrip,
  cartToInput,
  cartTotal,
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
        <p className="font-medium text-slate-900">No stall set up yet</p>
        <p className="mt-1 text-sm text-slate-500">
          {canManage ? "Create the stall and its menu first." : "Ask an admin to set up the stall."}
        </p>
        {canManage && (
          <Link
            to="/stall/menu"
            className="mt-4 inline-flex rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Set up stall menu
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
  const today = useStallToday(stall.id);
  const record = useRecordStallSale(stall.id);
  const close = useCloseStallToday(stall.id);
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
              <select
                value={stall.id}
                onChange={(e) => onPickStall(e.target.value)}
                aria-label="Stall"
                className={`${selectClass} py-1.5 font-semibold`}
              >
                {stalls.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <h1 className="truncate text-lg font-semibold text-slate-900">{stall.name}</h1>
            )}
            <p className="mt-0.5 text-xs text-slate-500">
              {day ? formatDayShort(day.date) : "Today"}
              {day && day.totals.count > 0 && (
                <>
                  {" "}
                  · {day.totals.count} entr{day.totals.count === 1 ? "y" : "ies"}
                </>
              )}
            </p>
          </div>
          {day && <DayStatusPill status={day.status} />}
        </div>
        {day ? (
          <TotalsStrip totals={day.totals} />
        ) : (
          <p className="py-3 text-center text-sm text-slate-500">
            {today.isError ? "Could not load today’s sales." : "Loading…"}
          </p>
        )}
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {closed ? (
        <div className="mb-4 flex items-start gap-3 rounded-card border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p>
            Day closed
            {day?.closedByName ? ` by ${day.closedByName}` : ""}
            {day?.closedAt
              ? ` at ${new Date(day.closedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`
              : ""}
            . {canManage ? "Reopen it from Stall sales to add more." : "Ask an admin to reopen it."}
          </p>
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
        <h2 className="text-sm font-semibold text-slate-900">Today&rsquo;s entries</h2>
        <SaleList
          sales={day?.sales ?? []}
          onDelete={closed ? undefined : onDelete}
          deletingId={del.isPending ? del.variables : null}
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
              Close today&rsquo;s sales?
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
