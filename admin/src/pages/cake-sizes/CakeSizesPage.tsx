import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  useAdminCakeSizes,
  useCreateCakeSize,
  useUpdateCakeSize,
  useDeleteCakeSize,
  useReorderCakeSizes,
  type CakeSize,
} from "@/hooks/useCakeSizes";
import {
  ReorderHandle,
  ReorderList,
  type ReorderItemContext,
} from "@/components/reorder/ReorderList";
import { ActiveSwitch } from "@/components/ui/ActiveSwitch";
import { cn } from "@/lib/cn";

const NO_SIZES: CakeSize[] = [];

export function CakeSizesPage() {
  const { data: sizes = NO_SIZES, isLoading } = useAdminCakeSizes();
  const createSize = useCreateCakeSize();
  const [adding, setAdding] = useState(false);
  const [newSize, setNewSize] = useState({
    grams: "",
    label: "",
    servesText: "",
  });
  const [error, setError] = useState<string | null>(null);
  const reorderSizes = useReorderCakeSizes();
  const [items, setItems] = useState<CakeSize[]>([]);

  useEffect(() => {
    setItems(sizes);
  }, [sizes]);

  const onReorder = (next: CakeSize[]) => {
    const prev = items;
    setItems(next);
    setError(null);
    void reorderSizes.mutateAsync(next.map((s) => s.id)).catch((err) => {
      setItems(prev);
      setError(err instanceof Error ? err.message : "Failed to save order");
    });
  };

  const submitNew = async () => {
    setError(null);
    const grams = Number(newSize.grams);
    if (!grams || grams <= 0 || !Number.isInteger(grams))
      return setError("Enter grams as a whole number");
    if (!newSize.label.trim()) return setError("Label is required");
    try {
      await createSize.mutateAsync({
        grams,
        label: newSize.label.trim(),
        servesText: newSize.servesText.trim() || null,
        sortOrder: Math.max(0, ...sizes.map((s) => s.sortOrder)) + 10,
      });
      setNewSize({ grams: "", label: "", servesText: "" });
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cake sizes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Size options shown to customers on cake products. Final price ={" "}
            <span className="font-medium">
              (base + flavour) × pounds − ₹50 per half-lb above 1 lb
            </span>
            . 500g = 1 pound. Example: 1.5 lb = 1.5× base − ₹50. Drag rows to set the order
            customers see.
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium whitespace-nowrap text-white transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Add size
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-card border border-slate-200 bg-white">
        {isLoading && <div className="p-8 text-center text-sm text-slate-500">Loading…</div>}
        {!isLoading && (
          <table className="w-full text-left text-sm">
            <thead className="hidden border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase md:table-header-group">
              <tr>
                <th className="w-10 px-2 py-2 font-medium">
                  <span className="sr-only">Reorder</span>
                </th>
                <th className="w-32 px-4 py-2 font-medium">Grams</th>
                <th className="px-4 py-2 font-medium">Label</th>
                <th className="px-4 py-2 font-medium">Serves</th>
                <th className="w-24 px-4 py-2 text-center font-medium">Active</th>
                <th className="w-16 px-4 py-2" />
              </tr>
            </thead>
            {items.length > 0 && (
              <ReorderList
                as="tbody"
                className="divide-y divide-slate-100"
                items={items}
                onReorder={onReorder}
                disabled={reorderSizes.isPending}
              >
                {(s, ctx) => <SizeRow key={s.id} size={s} reorder={ctx} />}
              </ReorderList>
            )}
            {adding && (
              <tbody className="border-t border-slate-100">
                <tr className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 bg-slate-50/60 p-3 md:table-row md:p-0">
                  <td className="hidden md:table-cell" />
                  <td className="md:table-cell md:px-4 md:py-2">
                    <div className="relative">
                      <input
                        type="number"
                        step="1"
                        min={1}
                        value={newSize.grams}
                        onChange={(e) => setNewSize({ ...newSize, grams: e.target.value })}
                        placeholder="500"
                        aria-label="Grams"
                        className={cn(inputClass, "pr-6")}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-slate-400">
                        g
                      </span>
                    </div>
                  </td>
                  <td className="md:table-cell md:px-4 md:py-2">
                    <input
                      value={newSize.label}
                      onChange={(e) => setNewSize({ ...newSize, label: e.target.value })}
                      placeholder="Label, e.g. 1 pound"
                      aria-label="Label"
                      className={inputClass}
                    />
                  </td>
                  <td className="col-span-2 md:table-cell md:px-4 md:py-2">
                    <input
                      value={newSize.servesText}
                      onChange={(e) => setNewSize({ ...newSize, servesText: e.target.value })}
                      placeholder="Serves 4–6"
                      aria-label="Serves"
                      className={inputClass}
                    />
                  </td>
                  <td className="col-span-2 md:table-cell md:px-4 md:py-2" colSpan={2}>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setAdding(false);
                          setError(null);
                        }}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={submitNew}
                        disabled={createSize.isPending}
                        className="rounded-md bg-brand-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                      >
                        {createSize.isPending ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            )}
          </table>
        )}
        {error && (
          <p className="border-t border-slate-100 px-4 py-2 text-xs text-brand-700">{error}</p>
        )}
      </div>
    </div>
  );
}

function SizeRow({ size, reorder }: { size: CakeSize; reorder: ReorderItemContext }) {
  const update = useUpdateCakeSize();
  const del = useDeleteCakeSize();
  const [label, setLabel] = useState(size.label);
  const [servesText, setServesText] = useState(size.servesText ?? "");

  const patch = (
    body: Partial<{
      label: string;
      servesText: string | null;
      isActive: boolean;
    }>,
  ) => update.mutate({ id: size.id, ...body });

  return (
    <tr
      ref={reorder.setNodeRef}
      style={reorder.style}
      className={cn(
        "grid grid-cols-[auto_3.25rem_minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1.5 py-2 pr-3 pl-1 hover:bg-slate-50 md:table-row md:p-0",
        reorder.isDragging && "bg-white shadow-md",
      )}
    >
      <td className="row-span-2 md:table-cell md:px-2 md:py-3 md:align-middle">
        <ReorderHandle {...reorder.handleProps} />
      </td>
      <td
        className={cn(
          "text-sm font-semibold text-slate-900 tabular-nums md:table-cell md:px-4 md:py-3 md:font-medium",
          !size.isActive && "text-slate-400",
        )}
      >
        {size.grams} g
      </td>
      <td className="min-w-0 md:table-cell md:px-4 md:py-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label !== size.label && patch({ label })}
          placeholder="Label"
          aria-label={`Label for ${size.grams} g`}
          className={inputClass}
        />
      </td>
      <td className="col-span-4 col-start-2 row-start-2 min-w-0 md:table-cell md:px-4 md:py-2">
        <input
          value={servesText}
          onChange={(e) => setServesText(e.target.value)}
          onBlur={() =>
            (servesText || "") !== (size.servesText ?? "") &&
            patch({ servesText: servesText || null })
          }
          placeholder="Serves…"
          aria-label={`Serves for ${size.grams} g`}
          className={cn(inputClass, "text-xs md:text-sm")}
        />
      </td>
      <td className="col-start-4 row-start-1 md:table-cell md:px-4 md:py-3 md:text-center">
        <ActiveSwitch
          checked={size.isActive}
          label={`${size.label} active`}
          onChange={(isActive) => patch({ isActive })}
        />
      </td>
      <td className="col-start-5 row-start-1 md:table-cell md:px-4 md:py-3 md:text-right">
        <div className="flex items-center justify-end">
          <button
            onClick={() => {
              if (confirm(`Delete "${size.label}"?`)) del.mutate(size.id);
            }}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-500"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

const inputClass =
  "w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";
