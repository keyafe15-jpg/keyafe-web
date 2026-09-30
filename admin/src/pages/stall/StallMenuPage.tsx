import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  useCreateStall,
  useCreateStallMenuItem,
  useDeleteStall,
  useDeleteStallMenuItem,
  useManageStalls,
  useReorderStallMenu,
  useUpdateStall,
  useUpdateStallMenuItem,
  type Stall,
  type StallMenuItem,
} from "@/hooks/useStalls";
import { cn } from "@/lib/cn";
import { Field, inputClass, submitClass } from "@/components/form/Field";
import {
  ReorderHandle,
  ReorderList,
  type ReorderItemContext,
} from "@/components/reorder/ReorderList";
import { ActiveSwitch } from "@/components/ui/ActiveSwitch";

const NO_STALLS: Stall[] = [];
const NO_ITEMS: StallMenuItem[] = [];

export function StallMenuPage() {
  const { data: stalls = NO_STALLS, isLoading } = useManageStalls();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const stall = stalls.find((s) => s.id === selectedId) ?? stalls[0] ?? null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Stall menu</h1>
        <p className="mt-1 text-sm text-slate-500">
          Items and prices the stall counter shows. Drag rows to set the order of the buttons;
          switch an item off to hide it for the day without deleting it.
        </p>
      </div>

      {isLoading && <div className="p-8 text-center text-sm text-slate-500">Loading…</div>}

      {!isLoading && !stall && <NewStallForm first onCreated={setSelectedId} />}

      {stall && (
        <>
          <StallSettings key={stall.id} stall={stall} stalls={stalls} onSelect={setSelectedId} />
          <NewMenuItemRow stallId={stall.id} />
          <MenuList stall={stall} />
        </>
      )}
    </div>
  );
}

function NewStallForm({ first, onCreated }: { first?: boolean; onCreated: (id: string) => void }) {
  const create = useCreateStall();
  const [name, setName] = useState(first ? "Office stall" : "");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      const { id } = await create.mutateAsync({ name: name.trim() });
      setName("");
      onCreated(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create stall");
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) void submit();
      }}
      className={cn(first && "rounded-card border border-slate-200 bg-white p-4")}
    >
      {first && (
        <p className="mb-3 text-sm text-slate-600">
          Start by naming your stall — you can add more stalls later.
        </p>
      )}
      <div className="flex items-end gap-2">
        <Field label={first ? "Stall name" : "New stall"} className="flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tech Park stall"
            maxLength={80}
            className={inputClass}
          />
        </Field>
        <button
          type="submit"
          disabled={!name.trim() || create.isPending}
          className={cn(submitClass, "inline-flex items-center gap-1")}
        >
          <Plus className="h-4 w-4" /> {first ? "Create" : "Add"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </form>
  );
}

function StallSettings({
  stall,
  stalls,
  onSelect,
}: {
  stall: Stall;
  stalls: Stall[];
  onSelect: (id: string) => void;
}) {
  const update = useUpdateStall();
  const del = useDeleteStall();
  const [name, setName] = useState(stall.name);
  const [addingStall, setAddingStall] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveName = () => {
    const next = name.trim();
    if (!next || next === stall.name) {
      setName(stall.name);
      return;
    }
    update.mutate(
      { id: stall.id, name: next },
      { onError: (err) => setError(err instanceof Error ? err.message : "Could not rename") },
    );
  };

  const onDelete = async () => {
    setError(null);
    if (stall.dayCount > 0) {
      setError("This stall has sales history, so it can't be deleted. Switch it off instead.");
      return;
    }
    if (!confirm(`Delete “${stall.name}” and its menu?`)) return;
    try {
      await del.mutateAsync(stall.id);
      const other = stalls.find((s) => s.id !== stall.id);
      if (other) onSelect(other.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    }
  };

  return (
    <div className="mb-4 rounded-card border border-slate-200 bg-white p-4">
      {stalls.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {stalls.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition",
                s.id === stall.id
                  ? "border-brand-500 bg-brand-100/50 font-medium text-brand-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300",
                !s.isActive && "opacity-60",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-3">
        <Field label="Stall name" className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            maxLength={80}
            className={inputClass}
          />
        </Field>
        <div className="flex shrink-0 items-center gap-1.5 pb-2.5">
          <span className="text-xs text-slate-500">Active</span>
          <ActiveSwitch
            checked={stall.isActive}
            label={`${stall.name} active`}
            title={
              stall.isActive
                ? "Shown on the counter — tap to switch off"
                : "Hidden from the counter — tap to switch on"
            }
            onChange={(isActive) => update.mutate({ id: stall.id, isActive })}
          />
        </div>
        <button
          type="button"
          onClick={() => void onDelete()}
          disabled={del.isPending}
          title={stall.dayCount > 0 ? "Has sales history — switch it off instead" : "Delete stall"}
          className={cn(
            "mb-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition disabled:opacity-50",
            stall.dayCount > 0
              ? "text-slate-300 hover:bg-slate-50 hover:text-slate-500"
              : "text-red-500 hover:bg-red-50 hover:text-red-700",
          )}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <div className="mt-3 border-t border-slate-100 pt-3">
        {addingStall ? (
          <NewStallForm
            onCreated={(id) => {
              setAddingStall(false);
              onSelect(id);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingStall(true)}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            <Plus className="h-4 w-4" /> Add another stall
          </button>
        )}
      </div>
    </div>
  );
}

function NewMenuItemRow({ stallId }: { stallId: string }) {
  const create = useCreateStallMenuItem();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const priceValue = Number(price);
  const canSubmit = name.trim().length > 0 && price !== "" && priceValue >= 0;

  const submit = async () => {
    setError(null);
    try {
      await create.mutateAsync({ stallId, name: name.trim(), price: priceValue });
      setName("");
      setPrice("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add item");
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit && !create.isPending) void submit();
      }}
      className="rounded-card border border-slate-200 bg-white p-4"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
        <Field label="New item">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Masala chai"
            maxLength={80}
            className={inputClass}
          />
        </Field>
        <Field label="Price ₹">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="30"
            className={inputClass}
          />
        </Field>
        <div className="col-span-2 sm:col-span-1 sm:self-end">
          <button
            type="submit"
            disabled={!canSubmit || create.isPending}
            className={cn(submitClass, "inline-flex w-full items-center justify-center gap-1")}
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </form>
  );
}

function MenuList({ stall }: { stall: Stall }) {
  const menu = stall.menu.length > 0 ? stall.menu : NO_ITEMS;
  const reorder = useReorderStallMenu(stall.id);
  const [items, setItems] = useState<StallMenuItem[]>(menu);
  const [reorderError, setReorderError] = useState<string | null>(null);

  useEffect(() => {
    setItems(menu);
  }, [menu]);

  const onReorder = (next: StallMenuItem[]) => {
    const prev = items;
    setItems(next);
    setReorderError(null);
    void reorder.mutateAsync(next.map((m) => m.id)).catch((err) => {
      setItems(prev);
      setReorderError(err instanceof Error ? err.message : "Failed to save order");
    });
  };

  return (
    <>
      {reorderError && (
        <div className="mt-4 rounded-lg border border-brand-500/40 bg-brand-100/50 px-4 py-3 text-sm text-brand-700">
          {reorderError}
        </div>
      )}
      <div className="mt-4 overflow-hidden rounded-card border border-slate-200 bg-white">
        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No items yet — add the first one above.
          </div>
        ) : (
          <ReorderList
            className="divide-y divide-slate-100"
            items={items}
            onReorder={onReorder}
            disabled={reorder.isPending}
          >
            {(item, ctx) => <MenuRow key={item.id} item={item} reorder={ctx} />}
          </ReorderList>
        )}
      </div>
    </>
  );
}

function MenuRow({ item, reorder }: { item: StallMenuItem; reorder: ReorderItemContext }) {
  const update = useUpdateStallMenuItem();
  const del = useDeleteStallMenuItem();
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.price));
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    const nextName = name.trim();
    const nextPrice = Number(price);
    if (!nextName || price === "" || !(nextPrice >= 0)) {
      setName(item.name);
      setPrice(String(item.price));
      return;
    }
    if (nextName === item.name && nextPrice === item.price) return;
    setError(null);
    update.mutate(
      { id: item.id, name: nextName, price: nextPrice },
      { onError: (err) => setError(err instanceof Error ? err.message : "Could not save") },
    );
  };

  const onDelete = () => {
    if (!confirm(`Delete “${item.name}” from the menu? Past sales keep their record.`)) return;
    del.mutate(item.id, {
      onError: (err) => setError(err instanceof Error ? err.message : "Could not delete"),
    });
  };

  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div
      ref={reorder.setNodeRef}
      style={reorder.style}
      className={cn(
        "flex items-center gap-2 py-2 pr-2 pl-1 hover:bg-slate-50",
        reorder.isDragging && "bg-white shadow-md",
        !item.isActive && "bg-slate-50/60",
      )}
    >
      <ReorderHandle {...reorder.handleProps} />
      <div className="min-w-0 flex-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={blurOnEnter}
          aria-label="Item name"
          maxLength={80}
          className={cn(
            "w-full truncate rounded-md border border-transparent bg-transparent px-1 py-1 font-medium outline-none focus:border-slate-200 focus:bg-white",
            item.isActive ? "text-slate-900" : "text-slate-400 line-through",
          )}
        />
        {error && <p className="px-1 text-xs text-red-700">{error}</p>}
      </div>
      <label className="relative shrink-0">
        <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs text-slate-400">
          ₹
        </span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={commit}
          onKeyDown={blurOnEnter}
          aria-label={`${item.name} price`}
          className="w-20 rounded-md border border-slate-200 bg-white py-1 pr-2 pl-5 text-right text-sm tabular-nums outline-none focus:border-brand-500 sm:w-24"
        />
      </label>
      <ActiveSwitch
        checked={item.isActive}
        label={`${item.name} available`}
        title={
          item.isActive ? "On the counter — tap to hide" : "Hidden from the counter — tap to show"
        }
        onChange={(isActive) => update.mutate({ id: item.id, isActive })}
      />
      <button
        type="button"
        onClick={onDelete}
        disabled={del.isPending}
        title={`Delete “${item.name}”`}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
