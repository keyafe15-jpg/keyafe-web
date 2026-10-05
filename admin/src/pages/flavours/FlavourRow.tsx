import { useState } from "react";
import { Trash2, X } from "lucide-react";
import {
  useCreateFlavour,
  useDeleteFlavour,
  useUpdateFlavour,
  type AdminFlavour,
  type FlavourGroup,
} from "@/hooks/useFlavours";
import { ReorderHandle, type ReorderItemContext } from "@/components/reorder/ReorderList";
import { ActiveSwitch } from "@/components/ui/ActiveSwitch";
import { selectClass } from "@/components/form/Field";
import { cn } from "@/lib/cn";

export const flavourInputClass =
  "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

const UNGROUPED = "";

const emptyNew = {
  name: "",
  additionalAmount: "0",
  isEggless: false,
  isSugarFree: false,
  isHealthy: false,
};

export function FlavourRow({
  flavour,
  groups,
  endSortOrder,
  reorder,
}: {
  flavour: AdminFlavour;
  groups: FlavourGroup[];
  /** Sort order that lands a moved flavour at the end of its new card. */
  endSortOrder: number;
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

  const moveTo = async (value: string) => {
    setError(null);
    try {
      await update.mutateAsync({
        id: flavour.id,
        groupId: value === UNGROUPED ? null : value,
        sortOrder: endSortOrder,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move");
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
        "grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-x-2 px-2 py-2 hover:bg-slate-50 md:table-row md:p-0",
        reorder.isDragging && "bg-white shadow-md",
      )}
    >
      <td className="row-span-2 md:table-cell md:px-2 md:py-3 md:align-middle">
        <ReorderHandle {...reorder.handleProps} />
      </td>
      <td className="min-w-0 md:table-cell md:px-4 md:py-3">
        <p
          className={cn(
            "truncate font-medium text-slate-900 md:whitespace-normal",
            !flavour.isActive && "text-slate-400",
          )}
        >
          {flavour.name}
        </p>
        <p className="hidden text-xs text-slate-500 md:block">/{flavour.slug}</p>
        {inUse && (
          <p className="mt-0.5 hidden text-[11px] text-slate-400 md:block">
            On {flavour.productCount} product{flavour.productCount === 1 ? "" : "s"}
          </p>
        )}
      </td>
      <td className="col-span-4 col-start-2 row-start-3 mt-1.5 min-w-0 md:mt-0 md:table-cell md:px-4 md:py-3">
        <label className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-slate-500 md:sr-only">Move to</span>
          <select
            value={flavour.groupId ?? UNGROUPED}
            onChange={(e) => void moveTo(e.target.value)}
            disabled={update.isPending}
            aria-label={`Group for ${flavour.name}`}
            className={cn(selectClass, "rounded-md py-1 text-xs md:py-1.5 md:text-sm")}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
            <option value={UNGROUPED}>Ungrouped</option>
          </select>
        </label>
      </td>
      <td className="col-start-2 row-start-2 min-w-0 md:table-cell md:px-4 md:py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1 md:flex-nowrap">
          <span className="truncate text-[11px] text-slate-400 md:hidden">
            /{flavour.slug}
            {inUse
              ? ` · ${flavour.productCount} product${flavour.productCount === 1 ? "" : "s"}`
              : ""}
          </span>
          {flavour.isEggless && <Tag label="Eggless" tone="green" />}
          {flavour.isSugarFree && <Tag label="Sugar-free" tone="brand" />}
          {flavour.isHealthy && <Tag label="Healthy" tone="emerald" />}
        </div>
      </td>
      <td className="col-start-3 row-span-2 row-start-1 md:table-cell md:px-4 md:py-2 md:text-right">
        <div className="flex items-center justify-end gap-2">
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
              aria-label={`Additional amount for ${flavour.name}`}
              className={cn(
                "w-20 rounded-md border border-slate-200 bg-white py-1.5 pr-2 pl-7 text-right text-sm text-slate-900 tabular-nums outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 md:w-28",
                error && "border-brand-500",
              )}
            />
          </div>
          {update.isPending && <span className="hidden text-xs text-slate-400 md:inline">…</span>}
        </div>
      </td>
      <td className="col-start-4 row-span-2 row-start-1 md:table-cell md:px-4 md:py-3 md:text-center">
        <ActiveSwitch
          checked={flavour.isActive}
          label={`${flavour.name} active`}
          onChange={(isActive) => update.mutate({ id: flavour.id, isActive })}
        />
      </td>
      <td className="col-start-5 row-span-2 row-start-1 md:table-cell md:px-4 md:py-3 md:text-right">
        <div className="flex items-center justify-end">
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
      {error && (
        <td className="col-span-4 col-start-2 text-xs text-brand-700 md:hidden">{error}</td>
      )}
    </tr>
  );
}

export function AddFlavourRow({
  groupId,
  sortOrder,
  onDone,
}: {
  groupId: string | null;
  sortOrder: number;
  onDone: () => void;
}) {
  const createFlavour = useCreateFlavour();
  const [draft, setDraft] = useState(emptyNew);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    setFormError(null);
    const name = draft.name.trim();
    if (name.length < 2) return setFormError("Name is required");
    const additionalAmount = Number(draft.additionalAmount);
    if (Number.isNaN(additionalAmount) || additionalAmount < 0) {
      return setFormError("Additional amount must be 0 or more");
    }
    try {
      await createFlavour.mutateAsync({
        name,
        groupId,
        sortOrder,
        additionalAmount,
        isEggless: draft.isEggless,
        isSugarFree: draft.isSugarFree,
        isHealthy: draft.isHealthy,
        isActive: true,
      });
      onDone();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  return (
    <tbody className="divide-y divide-slate-100 border-t border-slate-100">
      <tr className="block bg-slate-50/70 p-4 md:table-row md:p-0">
        <td className="hidden md:table-cell md:px-2 md:py-3" />
        <td className="block md:table-cell md:px-4 md:py-3" colSpan={2}>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 md:sr-only">Name</span>
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                }
                if (e.key === "Escape") onDone();
              }}
              placeholder="e.g. Belgian Chocolate"
              className={flavourInputClass}
            />
          </label>
          {formError && <p className="mt-1 text-xs text-brand-700 md:hidden">{formError}</p>}
        </td>
        <td className="mt-3 block md:mt-0 md:table-cell md:px-4 md:py-3">
          <div className="flex flex-wrap gap-3">
            <FlagCheck
              label="Eggless"
              checked={draft.isEggless}
              onChange={(isEggless) => setDraft({ ...draft, isEggless })}
            />
            <FlagCheck
              label="Sugar-free"
              checked={draft.isSugarFree}
              onChange={(isSugarFree) => setDraft({ ...draft, isSugarFree })}
            />
            <FlagCheck
              label="Healthy"
              checked={draft.isHealthy}
              onChange={(isHealthy) => setDraft({ ...draft, isHealthy })}
            />
          </div>
        </td>
        <td className="mt-3 block md:mt-0 md:table-cell md:px-4 md:py-2 md:text-right">
          <div className="flex items-center justify-between gap-2 md:justify-end">
            <span className="text-xs font-medium text-slate-500 md:hidden">Additional</span>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs text-slate-400">
                +₹
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft.additionalAmount}
                onChange={(e) => setDraft({ ...draft, additionalAmount: e.target.value })}
                className={cn(flavourInputClass, "w-28 pr-2 pl-7 text-right tabular-nums")}
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
              onClick={onDone}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-white"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button
              type="button"
              disabled={createFlavour.isPending}
              onClick={() => void submit()}
              className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {createFlavour.isPending ? "Saving…" : "Save"}
            </button>
          </div>
          {formError && <p className="mt-1 hidden text-xs text-brand-700 md:block">{formError}</p>}
        </td>
      </tr>
    </tbody>
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
