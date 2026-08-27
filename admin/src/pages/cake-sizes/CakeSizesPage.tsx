import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  useAdminCakeSizes,
  useCreateCakeSize,
  useUpdateCakeSize,
  useDeleteCakeSize,
  type CakeSize,
} from "@/hooks/useCakeSizes";
import { cn } from "@/lib/cn";

export function CakeSizesPage() {
  const { data: sizes = [], isLoading } = useAdminCakeSizes();
  const createSize = useCreateCakeSize();
  const [adding, setAdding] = useState(false);
  const [newSize, setNewSize] = useState({
    grams: "",
    label: "",
    servesText: "",
  });
  const [error, setError] = useState<string | null>(null);

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
        sortOrder: (sizes.length + 1) * 10,
      });
      setNewSize({ grams: "", label: "", servesText: "" });
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cake sizes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Size options shown to customers on cake products. Final price ={" "}
            <span className="font-medium">
              (base + flavour extra) × grams / 500
            </span>
            . 500g = 1 pound = 1× base price.
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Add size
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-card border border-slate-200 bg-white">
        {isLoading && (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        )}
        {!isLoading && (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-32 px-4 py-2 font-medium">Grams</th>
                <th className="px-4 py-2 font-medium">Label</th>
                <th className="px-4 py-2 font-medium">Serves</th>
                <th className="w-24 px-4 py-2 text-center font-medium">Sort</th>
                <th className="w-24 px-4 py-2 text-center font-medium">
                  Active
                </th>
                <th className="w-16 px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sizes.map((s) => (
                <SizeRow key={s.id} size={s} />
              ))}
              {adding && (
                <tr className="bg-slate-50/60">
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="1"
                      min={1}
                      value={newSize.grams}
                      onChange={(e) =>
                        setNewSize({ ...newSize, grams: e.target.value })
                      }
                      placeholder="500"
                      className={inputClass}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={newSize.label}
                      onChange={(e) =>
                        setNewSize({ ...newSize, label: e.target.value })
                      }
                      placeholder="1 pound"
                      className={inputClass}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={newSize.servesText}
                      onChange={(e) =>
                        setNewSize({ ...newSize, servesText: e.target.value })
                      }
                      placeholder="Serves 4–6"
                      className={inputClass}
                    />
                  </td>
                  <td className="px-4 py-2" colSpan={2}>
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
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        )}
        {error && (
          <p className="border-t border-slate-100 px-4 py-2 text-xs text-brand-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function SizeRow({ size }: { size: CakeSize }) {
  const update = useUpdateCakeSize();
  const del = useDeleteCakeSize();
  const [label, setLabel] = useState(size.label);
  const [servesText, setServesText] = useState(size.servesText ?? "");
  const [sortOrder, setSortOrder] = useState(size.sortOrder.toString());

  const patch = (
    body: Partial<{
      label: string;
      servesText: string | null;
      sortOrder: number;
      isActive: boolean;
    }>,
  ) => update.mutate({ id: size.id, ...body });

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3 font-medium tabular-nums text-slate-900">
        {size.grams} g
      </td>
      <td className="px-4 py-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label !== size.label && patch({ label })}
          className={inputClass}
        />
      </td>
      <td className="px-4 py-2">
        <input
          value={servesText}
          onChange={(e) => setServesText(e.target.value)}
          onBlur={() =>
            (servesText || "") !== (size.servesText ?? "") &&
            patch({ servesText: servesText || null })
          }
          className={inputClass}
        />
      </td>
      <td className="px-4 py-2 text-center">
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          onBlur={() =>
            Number(sortOrder) !== size.sortOrder &&
            patch({ sortOrder: Number(sortOrder) })
          }
          className={cn(inputClass, "w-16 text-center")}
        />
      </td>
      <td className="px-4 py-3 text-center">
        <input
          type="checkbox"
          checked={size.isActive}
          onChange={(e) => patch({ isActive: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
        />
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => {
            if (confirm(`Delete "${size.label}"?`)) del.mutate(size.id);
          }}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-500"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

const inputClass =
  "w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";
