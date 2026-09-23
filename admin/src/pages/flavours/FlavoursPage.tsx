import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  useAdminFlavours,
  useCreateFlavour,
  useDeleteFlavour,
  useReorderFlavours,
  useUpdateFlavour,
  type AdminFlavour,
} from "@/hooks/useFlavours";
import {
  ReorderHandle,
  ReorderList,
  type ReorderItemContext,
} from "@/components/reorder/ReorderList";
import { cn } from "@/lib/cn";

const inputClass =
  "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

const emptyNew = {
  name: "",
  additionalAmount: "0",
  isEggless: false,
  isSugarFree: false,
  isHealthy: false,
};

export function FlavoursPage() {
  const { data: flavours = [], isLoading } = useAdminFlavours();
  const createFlavour = useCreateFlavour();
  const reorderFlavours = useReorderFlavours();
  const [items, setItems] = useState<AdminFlavour[]>([]);
  const [adding, setAdding] = useState(false);
  const [newFlavour, setNewFlavour] = useState(emptyNew);
  const [formError, setFormError] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);

  useEffect(() => {
    setItems(flavours);
  }, [flavours]);

  const submitNew = async () => {
    setFormError(null);
    const name = newFlavour.name.trim();
    if (name.length < 2) return setFormError("Name is required");
    const additionalAmount = Number(newFlavour.additionalAmount);
    if (Number.isNaN(additionalAmount) || additionalAmount < 0) {
      return setFormError("Additional amount must be 0 or more");
    }
    try {
      await createFlavour.mutateAsync({
        name,
        additionalAmount,
        isEggless: newFlavour.isEggless,
        isSugarFree: newFlavour.isSugarFree,
        isHealthy: newFlavour.isHealthy,
        isActive: true,
      });
      setNewFlavour(emptyNew);
      setAdding(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  const onReorder = (next: AdminFlavour[]) => {
    const prev = items;
    setItems(next);
    setReorderError(null);
    void reorderFlavours.mutateAsync(next.map((f) => f.id)).catch((err) => {
      setItems(prev);
      setReorderError(err instanceof Error ? err.message : "Failed to save order");
    });
  };

  const showTable = !isLoading && (items.length > 0 || adding);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Flavours</h1>
          <p className="mt-1 text-sm text-slate-500">
            Master flavour list. Drag rows to set storefront order. The{" "}
            <span className="font-medium">Additional amount</span> is added on top of the product
            base price (per pound) whenever a customer picks this flavour. Delete only works when no
            products offer the flavour — otherwise deactivate it, or remove it from those products
            first.
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setAdding(true);
            }}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Add flavour
          </button>
        )}
      </div>

      {reorderError && (
        <div className="mb-4 rounded-lg border border-brand-500/40 bg-brand-100/50 px-4 py-3 text-sm text-brand-700">
          {reorderError}
        </div>
      )}

      <div className="overflow-hidden rounded-card border border-slate-200 bg-white">
        {isLoading && <div className="p-8 text-center text-sm text-slate-500">Loading…</div>}
        {!isLoading && items.length === 0 && !adding && (
          <div className="p-8 text-center text-sm text-slate-500">
            No flavours yet.{" "}
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="text-brand-500 hover:underline"
            >
              Add your first flavour
            </button>
            .
          </div>
        )}
        {showTable && (
          <table className="w-full text-left text-sm">
            <thead className="hidden border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase md:table-header-group">
              <tr>
                <th className="w-10 px-2 py-2 font-medium">
                  <span className="sr-only">Reorder</span>
                </th>
                <th className="px-4 py-2 font-medium">Flavour</th>
                <th className="px-4 py-2 font-medium">Tags</th>
                <th className="w-40 px-4 py-2 text-right font-medium">Additional (₹)</th>
                <th className="w-24 px-4 py-2 text-center font-medium">Active</th>
                <th className="w-20 px-4 py-2 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            {items.length > 0 && (
              <ReorderList
                as="tbody"
                className="divide-y divide-slate-100"
                items={items}
                onReorder={onReorder}
                disabled={reorderFlavours.isPending}
              >
                {(flavour, ctx) => <FlavourRow key={flavour.id} flavour={flavour} reorder={ctx} />}
              </ReorderList>
            )}
            {adding && (
              <tbody className="divide-y divide-slate-100 border-t border-slate-100">
                <tr className="block bg-slate-50/70 p-4 md:table-row md:p-0">
                  <td className="hidden md:table-cell md:px-2 md:py-3" />
                  <td className="block md:table-cell md:px-4 md:py-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-500 md:sr-only">
                        Name
                      </span>
                      <input
                        autoFocus
                        value={newFlavour.name}
                        onChange={(e) => setNewFlavour({ ...newFlavour, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void submitNew();
                          }
                        }}
                        placeholder="e.g. Belgian Chocolate"
                        className={inputClass}
                      />
                    </label>
                    {formError && (
                      <p className="mt-1 text-xs text-brand-700 md:hidden">{formError}</p>
                    )}
                  </td>
                  <td className="mt-3 block md:mt-0 md:table-cell md:px-4 md:py-3">
                    <div className="flex flex-wrap gap-3">
                      <FlagCheck
                        label="Eggless"
                        checked={newFlavour.isEggless}
                        onChange={(isEggless) => setNewFlavour({ ...newFlavour, isEggless })}
                      />
                      <FlagCheck
                        label="Sugar-free"
                        checked={newFlavour.isSugarFree}
                        onChange={(isSugarFree) => setNewFlavour({ ...newFlavour, isSugarFree })}
                      />
                      <FlagCheck
                        label="Healthy"
                        checked={newFlavour.isHealthy}
                        onChange={(isHealthy) => setNewFlavour({ ...newFlavour, isHealthy })}
                      />
                    </div>
                  </td>
                  <td className="mt-3 block md:mt-0 md:table-cell md:px-4 md:py-2 md:text-right">
                    <div className="flex items-center justify-between gap-2 md:justify-end">
                      <span className="text-xs font-medium text-slate-500 md:hidden">
                        Additional
                      </span>
                      <div className="relative">
                        <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs text-slate-400">
                          +₹
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={newFlavour.additionalAmount}
                          onChange={(e) =>
                            setNewFlavour({ ...newFlavour, additionalAmount: e.target.value })
                          }
                          className={cn(inputClass, "w-28 pr-2 pl-7 text-right tabular-nums")}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="mt-3 hidden md:table-cell md:px-4 md:py-3 md:text-center">
                    <span className="text-xs text-slate-400">On</span>
                  </td>
                  <td className="mt-3 block md:mt-0 md:table-cell md:px-4 md:py-3 md:text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAdding(false);
                          setNewFlavour(emptyNew);
                          setFormError(null);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-white"
                      >
                        <X className="h-3.5 w-3.5" /> Cancel
                      </button>
                      <button
                        type="button"
                        disabled={createFlavour.isPending}
                        onClick={() => void submitNew()}
                        className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                      >
                        {createFlavour.isPending ? "Saving…" : "Save"}
                      </button>
                    </div>
                    {formError && (
                      <p className="mt-1 hidden text-xs text-brand-700 md:block">{formError}</p>
                    )}
                  </td>
                </tr>
              </tbody>
            )}
          </table>
        )}
      </div>
    </div>
  );
}

function FlagCheck({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
      />
      {label}
    </label>
  );
}

function FlavourRow({
  flavour,
  reorder,
}: {
  flavour: AdminFlavour;
  reorder: ReorderItemContext;
}) {
  const update = useUpdateFlavour();
  const del = useDeleteFlavour();
  const [amount, setAmount] = useState<string>(Number(flavour.additionalAmount).toString());
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inUse = flavour.productCount > 0;

  const commit = async () => {
    const parsed = Number(amount);
    if (Number.isNaN(parsed) || parsed < 0) {
      setError("Enter a non-negative number");
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({ id: flavour.id, additionalAmount: parsed });
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const onDelete = async () => {
    setError(null);
    if (inUse) {
      setError(
        `Used by ${flavour.productCount} product${flavour.productCount === 1 ? "" : "s"}. Remove it from those products first, or turn Active off.`,
      );
      return;
    }
    if (!confirm(`Delete flavour “${flavour.name}”? This cannot be undone.`)) return;
    try {
      await del.mutateAsync(flavour.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <tr
      ref={reorder.setNodeRef}
      style={reorder.style}
      className={cn(
        "block p-4 hover:bg-slate-50 md:table-row md:p-0",
        reorder.isDragging && "bg-white shadow-md",
      )}
    >
      <td className="mb-2 block md:mb-0 md:table-cell md:px-2 md:py-3 md:align-middle">
        <ReorderHandle {...reorder.handleProps} />
      </td>
      <td className="block md:table-cell md:px-4 md:py-3">
        <p className="font-medium text-slate-900">{flavour.name}</p>
        <p className="text-xs text-slate-500">/{flavour.slug}</p>
        {inUse && (
          <p className="mt-0.5 text-[11px] text-slate-400">
            On {flavour.productCount} product{flavour.productCount === 1 ? "" : "s"}
          </p>
        )}
      </td>
      <td className="block md:table-cell md:px-4 md:py-3">
        <div className="mt-2 flex flex-wrap gap-1 empty:hidden md:mt-0">
          {flavour.isEggless && <Tag label="Eggless" tone="green" />}
          {flavour.isSugarFree && <Tag label="Sugar-free" tone="brand" />}
          {flavour.isHealthy && <Tag label="Healthy" tone="emerald" />}
        </div>
      </td>
      <td className="mt-3 block md:mt-0 md:table-cell md:px-4 md:py-2 md:text-right">
        <div className="flex items-center justify-between gap-2 md:justify-end">
          <span className="text-xs font-medium text-slate-500 md:hidden">Additional</span>
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs text-slate-400">
                +₹
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setDirty(true);
                }}
                onBlur={() => dirty && commit()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className={cn(
                  "w-28 rounded-md border border-slate-200 bg-white py-1.5 pr-2 pl-7 text-right text-sm text-slate-900 tabular-nums outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
                  error && "border-brand-500",
                )}
              />
            </div>
            {update.isPending && <span className="text-xs text-slate-400">…</span>}
          </div>
        </div>
        {error && <p className="mt-1 text-xs text-brand-700 md:hidden">{error}</p>}
      </td>
      <td className="mt-3 block md:mt-0 md:table-cell md:px-4 md:py-3 md:text-center">
        <label className="flex cursor-pointer items-center justify-between gap-2 md:justify-center">
          <span className="text-xs font-medium text-slate-500 md:hidden">Active</span>
          <input
            type="checkbox"
            checked={flavour.isActive}
            onChange={(e) => update.mutate({ id: flavour.id, isActive: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
          />
        </label>
      </td>
      <td className="mt-3 block md:mt-0 md:table-cell md:px-4 md:py-3 md:text-right">
        <div className="flex items-center justify-between gap-2 md:justify-end">
          <span className="text-xs font-medium text-slate-500 md:hidden">Delete</span>
          <button
            type="button"
            onClick={() => void onDelete()}
            disabled={del.isPending}
            title={
              inUse
                ? `Used by ${flavour.productCount} product(s) — remove from products or deactivate`
                : `Delete “${flavour.name}”`
            }
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md transition disabled:opacity-50",
              inUse
                ? "text-slate-300 hover:bg-slate-50 hover:text-slate-500"
                : "text-red-500 hover:bg-red-50 hover:text-red-700",
            )}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        {error && <p className="mt-1 hidden text-xs text-brand-700 md:block">{error}</p>}
      </td>
    </tr>
  );
}

function Tag({ label, tone }: { label: string; tone: "green" | "brand" | "emerald" }) {
  const tones: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700",
    brand: "bg-brand-100 text-brand-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        tones[tone],
      )}
    >
      {label}
    </span>
  );
}
