import { useState } from "react";
import { Field, inputClass, selectClass } from "@/components/form/Field";
import { useCreateExpenseCategory, useExpenseCategories } from "@/hooks/useAdminBooks";

export function ExpenseCategoryField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (slug: string) => void;
  disabled?: boolean;
}) {
  const categories = useExpenseCategories();
  const create = useCreateExpenseCategory();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const items = categories.data?.items ?? [];

  return (
    <Field
      label="Category"
      required
      hint="Travel is bike parking, bus, auto. Delivery is sending cakes."
    >
      {!adding ? (
        <div className="flex gap-2">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={selectClass}
            disabled={disabled}
          >
            {items.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          {!disabled && (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                setError(null);
              }}
              className="shrink-0 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              New
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Trade license"
            className={inputClass}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
              if (e.key === "Escape") {
                setAdding(false);
                setName("");
              }
            }}
          />
          <button
            type="button"
            disabled={create.isPending || !name.trim()}
            onClick={() => void submit()}
            className="shrink-0 rounded-lg bg-brand-500 px-2.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {create.isPending ? "…" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setName("");
              setError(null);
            }}
            className="shrink-0 rounded-lg border border-slate-200 px-2.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </Field>
  );

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const created = await create.mutateAsync(trimmed);
      onChange(created.slug);
      setName("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add category");
    }
  }
}
