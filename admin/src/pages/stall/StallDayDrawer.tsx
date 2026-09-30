import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import {
  useAddStallDaySale,
  useDeleteStallSale,
  useSetStallDayStatus,
  useSettleStallDue,
  useStallDay,
  type Stall,
  type StallSale,
  type StallSaleInput,
} from "@/hooks/useStalls";
import { formatDayShort } from "@/lib/dateRange";
import { formatINR } from "@/lib/money";
import {
  CartPanel,
  DayStatusPill,
  ItemPicker,
  ItemsSold,
  LumpOverrideNote,
  LumpSumForm,
  SaleList,
  Segmented,
  TotalsStrip,
  cartToInput,
  saleAmount,
  type Cart,
} from "./stall-ui";

export type DrawerTarget = { stallId: string; date: string };

export function StallDayDrawer({
  target,
  stalls,
  onClose,
}: {
  /** `null` keeps the drawer closed. */
  target: DrawerTarget | null;
  stalls: Stall[];
  onClose: () => void;
}) {
  return (
    <Dialog.Root open={target != null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-xl">
          {target && (
            <DayDetail
              key={`${target.stallId}:${target.date}`}
              target={target}
              stall={stalls.find((s) => s.id === target.stallId)}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DayDetail({ target, stall }: { target: DrawerTarget; stall: Stall | undefined }) {
  const { data: day, isLoading, isError } = useStallDay(target.stallId, target.date);
  const add = useAddStallDaySale();
  const setStatus = useSetStallDayStatus();
  const del = useDeleteStallSale();
  const settle = useSettleStallDue();
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<"items" | "lump">("lump");
  const [cart, setCart] = useState<Cart>({});
  const [error, setError] = useState<string | null>(null);
  const menu = (stall?.menu ?? []).filter((m) => m.isActive);

  const save = async (input: StallSaleInput) => {
    setError(null);
    try {
      await add.mutateAsync({ stallId: target.stallId, date: target.date, input });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save entry");
      throw err;
    }
  };

  const onDelete = (sale: StallSale) => {
    if (!confirm(`Remove this ${formatINR(saleAmount(sale))} entry?`)) return;
    setError(null);
    del.mutate(sale.id, {
      onError: (err) => setError(err instanceof Error ? err.message : "Could not remove entry"),
    });
  };

  const onSettle = (sale: StallSale, via: "CASH" | "UPI") => {
    setError(null);
    settle.mutate(
      { saleId: sale.id, paidVia: via },
      { onError: (err) => setError(err instanceof Error ? err.message : "Could not mark as paid") },
    );
  };

  const toggleStatus = () => {
    if (!day?.id) return;
    setError(null);
    setStatus.mutate(
      { dayId: day.id, action: day.status === "OPEN" ? "close" : "reopen" },
      { onError: (err) => setError(err instanceof Error ? err.message : "Could not update day") },
    );
  };

  return (
    <>
      <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Dialog.Title className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              {formatDayShort(target.date)}
              {day && <DayStatusPill status={day.status} />}
            </Dialog.Title>
            <Dialog.Description className="mt-0.5 truncate text-sm text-slate-500">
              {day?.stall.name ?? stall?.name ?? "Stall"}
              {day?.status === "CLOSED" && day.closedByName && ` · closed by ${day.closedByName}`}
            </Dialog.Description>
          </div>
          <Dialog.Close className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </Dialog.Close>
        </div>
        {day && <TotalsStrip totals={day.totals} className="mt-4" />}
        {day?.lumpOverride && (
          <LumpOverrideNote tappedTotal={day.tappedTotals.total} className="mt-3" />
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
        {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {isError && <p className="text-sm text-red-600">Could not load this day.</p>}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {day && (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAdding((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" /> Add entry
              </button>
              {day.id && (
                <button
                  type="button"
                  onClick={toggleStatus}
                  disabled={setStatus.isPending}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {day.status === "OPEN" ? "Close day" : "Reopen day"}
                </button>
              )}
            </div>

            {adding && (
              <section className="rounded-card border border-slate-200 bg-slate-50/60 p-3">
                {menu.length > 0 && (
                  <Segmented
                    value={mode}
                    onChange={setMode}
                    options={[
                      { key: "lump", label: "Lump sum" },
                      { key: "items", label: "Items" },
                    ]}
                    className="mb-3 bg-white"
                  />
                )}
                {mode === "items" && menu.length > 0 ? (
                  <>
                    <ItemPicker
                      menu={menu}
                      cart={cart}
                      onAdd={(id) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }))}
                      disabled={add.isPending}
                    />
                    <div className="mt-3">
                      <CartPanel
                        menu={menu}
                        cart={cart}
                        setCart={setCart}
                        saving={add.isPending}
                        onPay={(method, dueFrom) =>
                          void save(cartToInput(cart, method, dueFrom))
                            .then(() => setCart({}))
                            .catch(() => {})
                        }
                      />
                    </div>
                  </>
                ) : (
                  <LumpSumForm onSubmit={save} saving={add.isPending} tapped={day.tappedTotals} />
                )}
              </section>
            )}

            {day.itemsSold.length > 0 && (
              <section>
                <h3 className="mb-1 text-sm font-semibold text-slate-900">Items sold</h3>
                <ItemsSold items={day.itemsSold} />
              </section>
            )}

            <section>
              <h3 className="text-sm font-semibold text-slate-900">Entries</h3>
              <SaleList
                sales={day.sales}
                onDelete={onDelete}
                deletingId={del.isPending ? del.variables : null}
                onSettle={onSettle}
                settlingId={settle.isPending ? settle.variables?.saleId : null}
                showAuthor
                lumpOverride={day.lumpOverride}
              />
            </section>
          </>
        )}
      </div>
    </>
  );
}
