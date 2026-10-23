import { useEffect, useState } from "react";
import { Field, inputClass } from "@/components/form/Field";
import { cn } from "@/lib/cn";
import { useBooksPayers, useCreateBooksPayer } from "@/hooks/useAdminBooks";

const LAST_PAYER_KEY = "keyafe-books-payer";

export function lastBooksPayerId() {
  try {
    return localStorage.getItem(LAST_PAYER_KEY);
  } catch {
    return null;
  }
}

function rememberPayer(id: string) {
  try {
    localStorage.setItem(LAST_PAYER_KEY, id);
  } catch {
    /* ignore */
  }
}

export function PaidByField({
  label = "Paid by",
  hint,
  value,
  onChange,
  disabled,
  required,
  compact,
  remember = true,
  autofill = false,
}: {
  label?: string;
  hint?: string;
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  required?: boolean;
  compact?: boolean;
  remember?: boolean;
  autofill?: boolean;
}) {
  const payers = useBooksPayers();
  const create = useCreateBooksPayer();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const items = payers.data?.items ?? [];

  useEffect(() => {
    if (value || !autofill || items.length === 0) return;
    const last = lastBooksPayerId();
    const pick = items.find((p) => p.id === last) ?? items[0];
    if (pick) onChange(pick.id);
    // once the list arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, value, remember]);

  const chips = (
    <div className={cn("flex flex-wrap items-center gap-1.5", compact && "justify-end")}>
      {items.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={disabled}
          aria-pressed={value === p.id}
          onClick={() => {
            onChange(p.id);
            if (remember) rememberPayer(p.id);
          }}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition",
            value === p.id
              ? "border-brand-500 bg-brand-500 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:border-brand-300",
            disabled && "opacity-50",
          )}
        >
          {p.name}
        </button>
      ))}
      {!disabled && !adding && (
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setError(null);
          }}
          className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-[11px] text-slate-500 hover:border-brand-400 hover:text-brand-700"
        >
          + Add
        </button>
      )}
      {adding && (
        <span className="flex items-center gap-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            autoFocus
            className={cn(inputClass, "h-7 w-28 px-2 py-0.5 text-xs")}
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
            className="text-[11px] font-medium text-brand-700 disabled:opacity-50"
          >
            {create.isPending ? "…" : "Save"}
          </button>
        </span>
      )}
      {error && <span className="text-[11px] text-red-700">{error}</span>}
    </div>
  );

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const created = await create.mutateAsync(trimmed);
      onChange(created.id);
      if (remember) rememberPayer(created.id);
      setName("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add");
    }
  }

  if (compact) return chips;

  return (
    <Field label={label} required={required} hint={hint}>
      {chips}
    </Field>
  );
}
