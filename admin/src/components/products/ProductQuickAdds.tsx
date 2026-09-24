import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { inputClass, selectClass } from "@/components/form/Field";
import { useCreateFlavour } from "@/hooks/useFlavours";
import { useCreateTag } from "@/hooks/useTags";
import { useCreateTopping, type ToppingKind } from "@/hooks/useToppings";
import { useCreateAddon } from "@/hooks/useAddons";
import { useAdminCategories, useCreateCategory } from "@/hooks/useAdminCategories";
import { useAdminDepartments } from "@/hooks/useAdminDepartments";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const DEFAULT_TAG_COLOR = "#E31C79";

function QuickAddShell({
  label,
  open,
  onOpen,
  onClose,
  children,
}: {
  label: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-50 hover:text-brand-700"
      >
        <Plus className="h-3.5 w-3.5" />
        {label}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-brand-200 bg-brand-50/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-700">{label}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700"
          title="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}

function SubmitRow({
  disabled,
  pending,
  onSubmit,
  error,
}: {
  disabled: boolean;
  pending: boolean;
  onSubmit: () => void;
  error: string | null;
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={onSubmit}
        className={cn(
          "inline-flex items-center gap-1 rounded-md bg-brand-500 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-brand-600 disabled:opacity-50",
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        {pending ? "Saving…" : "Save"}
      </button>
      {error && <p className="max-w-[16rem] text-xs text-brand-700">{error}</p>}
    </div>
  );
}

export function FlavourQuickAdd({ onCreated }: { onCreated: (id: string) => void }) {
  const create = useCreateFlavour();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setOpen(false);
    setName("");
    setError(null);
  };

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) {
      setError("Name needs at least 2 characters");
      return;
    }
    try {
      const created = await create.mutateAsync({ name: name.trim() });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["flavours"] }),
        qc.invalidateQueries({ queryKey: ["admin", "flavours"] }),
      ]);
      onCreated(created.id);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  return (
    <QuickAddShell
      label="Add flavour"
      open={open}
      onOpen={() => setOpen(true)}
      onClose={reset}
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[12rem] flex-1">
          <span className="mb-1 block text-[10px] font-medium tracking-wide text-slate-500 uppercase">
            Name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Chocolate"
            className={cn(inputClass, "py-1.5 text-sm")}
            autoFocus
          />
        </label>
        <SubmitRow
          disabled={name.trim().length < 2}
          pending={create.isPending}
          onSubmit={() => void submit()}
          error={error}
        />
      </div>
    </QuickAddShell>
  );
}

export function TagQuickAdd({ onCreated }: { onCreated: (id: string) => void }) {
  const create = useCreateTag();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [colorHex, setColorHex] = useState(DEFAULT_TAG_COLOR);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setOpen(false);
    setName("");
    setColorHex(DEFAULT_TAG_COLOR);
    setError(null);
  };

  const submit = async () => {
    setError(null);
    if (name.trim().length < 1) {
      setError("Name is required");
      return;
    }
    try {
      const created = await create.mutateAsync({
        name: name.trim(),
        slug: slugify(name),
        colorHex: colorHex || null,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["tags"] }),
        qc.invalidateQueries({ queryKey: ["admin", "tags"] }),
      ]);
      onCreated(created.id);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  return (
    <QuickAddShell label="Add tag" open={open} onOpen={() => setOpen(true)} onClose={reset}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[10rem] flex-1">
          <span className="mb-1 block text-[10px] font-medium tracking-wide text-slate-500 uppercase">
            Name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Best seller"
            className={cn(inputClass, "py-1.5 text-sm")}
            autoFocus
          />
        </label>
        <label>
          <span className="mb-1 block text-[10px] font-medium tracking-wide text-slate-500 uppercase">
            Color
          </span>
          <input
            type="color"
            value={colorHex}
            onChange={(e) => setColorHex(e.target.value)}
            className="h-9 w-10 cursor-pointer rounded border border-slate-200 bg-white"
          />
        </label>
        <SubmitRow
          disabled={!name.trim()}
          pending={create.isPending}
          onSubmit={() => void submit()}
          error={error}
        />
      </div>
    </QuickAddShell>
  );
}

export function ToppingQuickAdd({
  kind,
  onCreated,
}: {
  kind: ToppingKind;
  onCreated: (id: string) => void;
}) {
  const create = useCreateTopping();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [priceDelta, setPriceDelta] = useState("0");
  const [isVeg, setIsVeg] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const noun = kind === "CONDIMENT" ? "condiment" : "topping";

  const reset = () => {
    setOpen(false);
    setName("");
    setPriceDelta("0");
    setIsVeg(true);
    setError(null);
  };

  const submit = async () => {
    setError(null);
    if (name.trim().length < 1) {
      setError("Name is required");
      return;
    }
    try {
      const created = await create.mutateAsync({
        name: name.trim(),
        slug: slugify(name),
        kind,
        priceDelta: Number(priceDelta) || 0,
        isVeg,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["toppings"] }),
        qc.invalidateQueries({ queryKey: ["admin", "toppings"] }),
      ]);
      onCreated(created.id);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  return (
    <QuickAddShell
      label={`Add ${noun}`}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={reset}
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[10rem] flex-1">
          <span className="mb-1 block text-[10px] font-medium tracking-wide text-slate-500 uppercase">
            Name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={kind === "CONDIMENT" ? "Hot honey" : "Mushroom"}
            className={cn(inputClass, "py-1.5 text-sm")}
            autoFocus
          />
        </label>
        <label className="w-24">
          <span className="mb-1 block text-[10px] font-medium tracking-wide text-slate-500 uppercase">
            Price ₹
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={priceDelta}
            onChange={(e) => setPriceDelta(e.target.value)}
            className={cn(inputClass, "py-1.5 text-sm")}
          />
        </label>
        {kind === "TOPPING" && (
          <label className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={isVeg}
              onChange={(e) => setIsVeg(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-brand-500"
            />
            Veg
          </label>
        )}
        <SubmitRow
          disabled={!name.trim()}
          pending={create.isPending}
          onSubmit={() => void submit()}
          error={error}
        />
      </div>
    </QuickAddShell>
  );
}

export function AddonQuickAdd({
  categoryIds,
  existingGroups,
  onCreated,
}: {
  categoryIds: string[];
  existingGroups: string[];
  onCreated: (id: string) => void;
}) {
  const create = useCreateAddon();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [group, setGroup] = useState(existingGroups[0] ?? "Extras");
  const [priceDelta, setPriceDelta] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const groupOptions = [...new Set([...existingGroups, "Candles", "Toppers", "Extras"])].sort(
    (a, b) => a.localeCompare(b),
  );

  const reset = () => {
    setOpen(false);
    setName("");
    setGroup(existingGroups[0] ?? "Extras");
    setPriceDelta("0");
    setError(null);
  };

  const submit = async () => {
    setError(null);
    if (name.trim().length < 1 || group.trim().length < 1) {
      setError("Name and group are required");
      return;
    }
    try {
      const created = await create.mutateAsync({
        name: name.trim(),
        slug: slugify(name),
        group: group.trim(),
        priceDelta: Number(priceDelta) || 0,
        categoryIds: categoryIds.length ? categoryIds : undefined,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["addons"] }),
        qc.invalidateQueries({ queryKey: ["admin", "addons"] }),
      ]);
      onCreated(created.id);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  return (
    <QuickAddShell label="Add add-on" open={open} onOpen={() => setOpen(true)} onClose={reset}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[8rem] flex-1">
          <span className="mb-1 block text-[10px] font-medium tracking-wide text-slate-500 uppercase">
            Name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Number candle 5"
            className={cn(inputClass, "py-1.5 text-sm")}
            autoFocus
          />
        </label>
        <label className="w-36">
          <span className="mb-1 block text-[10px] font-medium tracking-wide text-slate-500 uppercase">
            Group
          </span>
          <input
            list="product-addon-groups"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className={cn(inputClass, "py-1.5 text-sm")}
          />
          <datalist id="product-addon-groups">
            {groupOptions.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>
        <label className="w-24">
          <span className="mb-1 block text-[10px] font-medium tracking-wide text-slate-500 uppercase">
            Price ₹
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={priceDelta}
            onChange={(e) => setPriceDelta(e.target.value)}
            className={cn(inputClass, "py-1.5 text-sm")}
          />
        </label>
        <SubmitRow
          disabled={!name.trim() || !group.trim()}
          pending={create.isPending}
          onSubmit={() => void submit()}
          error={error}
        />
      </div>
      {categoryIds.length > 0 && (
        <p className="mt-2 text-[11px] text-slate-500">
          Will default for the {categoryIds.length} categor
          {categoryIds.length === 1 ? "y" : "ies"} selected on this product.
        </p>
      )}
    </QuickAddShell>
  );
}

export function CategoryQuickAdd({
  onCreated,
}: {
  onCreated: (id: string, meta?: { slug: string; name: string }) => void;
}) {
  const create = useCreateCategory();
  const qc = useQueryClient();
  const { data: allCategories = [] } = useAdminCategories();
  const { data: stores = [] } = useAdminDepartments();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const topLevel = allCategories.filter((c) => !c.parentId && c.isActive);
  const activeStores = stores.filter((s) => s.isActive);

  const reset = () => {
    setOpen(false);
    setName("");
    setParentId("");
    setDepartmentId("");
    setError(null);
  };

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) {
      setError("Name needs at least 2 characters");
      return;
    }
    if (!parentId && !departmentId) {
      setError("Pick a parent category or a store");
      return;
    }
    try {
      const created = await create.mutateAsync({
        name: name.trim(),
        slug: slugify(name),
        parentId: parentId || null,
        departmentId: parentId ? null : departmentId,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["categories"] }),
        qc.invalidateQueries({ queryKey: ["admin", "categories"] }),
      ]);
      onCreated(created.id, { slug: created.slug, name: created.name });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  return (
    <QuickAddShell
      label="Add category"
      open={open}
      onOpen={() => setOpen(true)}
      onClose={reset}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[10rem] flex-1">
            <span className="mb-1 block text-[10px] font-medium tracking-wide text-slate-500 uppercase">
              Name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder="Birthday cakes"
              className={cn(inputClass, "py-1.5 text-sm")}
              autoFocus
            />
          </label>
          <label className="min-w-[10rem] flex-1">
            <span className="mb-1 block text-[10px] font-medium tracking-wide text-slate-500 uppercase">
              Nest under
            </span>
            <select
              value={parentId}
              onChange={(e) => {
                setParentId(e.target.value);
                if (e.target.value) setDepartmentId("");
              }}
              className={cn(selectClass, "py-1.5 text-sm")}
            >
              <option value="">Top-level (pick store)</option>
              {topLevel.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {!parentId && (
            <label className="min-w-[8rem] flex-1">
              <span className="mb-1 block text-[10px] font-medium tracking-wide text-slate-500 uppercase">
                Store
              </span>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className={cn(selectClass, "py-1.5 text-sm")}
              >
                <option value="">Select…</option>
                {activeStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <SubmitRow
            disabled={name.trim().length < 2 || (!parentId && !departmentId)}
            pending={create.isPending}
            onSubmit={() => void submit()}
            error={error}
          />
        </div>
      </div>
    </QuickAddShell>
  );
}
