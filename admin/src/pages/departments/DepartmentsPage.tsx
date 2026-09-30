import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  useAdminDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  useReorderDepartments,
  type AdminDepartment,
} from "@/hooks/useAdminDepartments";
import {
  ReorderHandle,
  ReorderList,
  type ReorderItemContext,
} from "@/components/reorder/ReorderList";
import { ActiveSwitch } from "@/components/ui/ActiveSwitch";
import { Field, inputClass, submitClass } from "@/components/form/Field";
import { cn } from "@/lib/cn";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const DEFAULT_DOOR = {
  accentHex: "#E31C79",
  softHex: "#F8D7E6",
  deepHex: "#B0155F",
};

const NO_STORES: AdminDepartment[] = [];

export function DepartmentsPage() {
  const { data: stores = NO_STORES, isLoading } = useAdminDepartments();
  const reorderStores = useReorderDepartments();
  const [items, setItems] = useState<AdminDepartment[]>([]);
  const [reorderError, setReorderError] = useState<string | null>(null);

  useEffect(() => {
    setItems(stores);
  }, [stores]);

  const onReorder = (next: AdminDepartment[]) => {
    const prev = items;
    setItems(next);
    setReorderError(null);
    void reorderStores.mutateAsync(next.map((s) => s.id)).catch((err) => {
      setItems(prev);
      setReorderError(err instanceof Error ? err.message : "Failed to save order");
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Stores</h1>
        <p className="mt-1 text-sm text-slate-500">
          Groupings such as Dessert and Savoury. Top-level categories pick one; sub-categories
          inherit it. Shopfront colors paint the home store doors. Drag rows to set their order.
        </p>
      </div>

      <NewStoreRow nextSortOrder={Math.max(0, ...stores.map((s) => s.sortOrder)) + 10} />

      {reorderError && (
        <div className="mt-4 rounded-lg border border-brand-500/40 bg-brand-100/50 px-4 py-3 text-sm text-brand-700">
          {reorderError}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-card border border-slate-200 bg-white">
        {isLoading && <div className="p-8 text-center text-sm text-slate-500">Loading…</div>}
        {!isLoading && items.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            No stores yet — add your first one above.
          </div>
        )}
        {!isLoading && items.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="hidden border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase md:table-header-group">
              <tr>
                <th className="w-10 px-2 py-2 font-medium">
                  <span className="sr-only">Reorder</span>
                </th>
                <th className="px-4 py-2 font-medium">Store</th>
                <th className="px-4 py-2 font-medium">Shopfront</th>
                <th className="w-24 px-4 py-2 font-medium">Active</th>
                <th className="w-28 px-4 py-2 text-right font-medium">Categories</th>
                <th className="w-12 px-4 py-2" />
              </tr>
            </thead>
            <ReorderList
              as="tbody"
              className="divide-y divide-slate-100"
              items={items}
              onReorder={onReorder}
              disabled={reorderStores.isPending}
            >
              {(store, ctx) => <StoreRow key={store.id} store={store} reorder={ctx} />}
            </ReorderList>
          </table>
        )}
      </div>
    </div>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
  onCommit,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  onCommit?: () => void;
  compact?: boolean;
}) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
      <input
        type="color"
        value={value}
        title={label}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onCommit?.()}
        className="h-7 w-7 cursor-pointer rounded border border-slate-200 bg-white p-0.5 md:h-8 md:w-8"
      />
      <span className={cn(compact && "hidden md:inline")}>{label}</span>
    </label>
  );
}

function NewStoreRow({ nextSortOrder }: { nextSortOrder: number }) {
  const create = useCreateDepartment();
  const [name, setName] = useState("");
  const [accentHex, setAccentHex] = useState(DEFAULT_DOOR.accentHex);
  const [softHex, setSoftHex] = useState(DEFAULT_DOOR.softHex);
  const [deepHex, setDeepHex] = useState(DEFAULT_DOOR.deepHex);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length >= 2;

  const submit = async () => {
    setError(null);
    try {
      await create.mutateAsync({
        name: name.trim(),
        slug: slugify(name),
        sortOrder: nextSortOrder,
        accentHex,
        softHex,
        deepHex,
      });
      setName("");
      setAccentHex(DEFAULT_DOOR.accentHex);
      setSoftHex(DEFAULT_DOOR.softHex);
      setDeepHex(DEFAULT_DOOR.deepHex);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  return (
    <div className="rounded-card border border-slate-200 bg-white p-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <Field label="New store">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dessert"
            className={inputClass}
          />
        </Field>
        <Field label="Shopfront colors">
          <div className="flex flex-wrap items-center gap-3 py-1">
            <ColorPicker label="Accent" value={accentHex} onChange={setAccentHex} />
            <ColorPicker label="Soft" value={softHex} onChange={setSoftHex} />
            <ColorPicker label="Deep" value={deepHex} onChange={setDeepHex} />
          </div>
        </Field>
        <div className="self-end">
          <button
            type="button"
            disabled={!canSubmit || create.isPending}
            onClick={submit}
            className={cn(submitClass, "inline-flex items-center gap-1")}
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>
      {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

function StoreRow({ store, reorder }: { store: AdminDepartment; reorder: ReorderItemContext }) {
  const update = useUpdateDepartment();
  const del = useDeleteDepartment();
  const [name, setName] = useState(store.name);
  const [accentHex, setAccentHex] = useState(store.accentHex ?? DEFAULT_DOOR.accentHex);
  const [softHex, setSoftHex] = useState(store.softHex ?? DEFAULT_DOOR.softHex);
  const [deepHex, setDeepHex] = useState(store.deepHex ?? DEFAULT_DOOR.deepHex);
  const [nameDirty, setNameDirty] = useState(false);
  const [colorsDirty, setColorsDirty] = useState(false);

  const commitName = async () => {
    const next = name.trim();
    if (next.length < 2 || next === store.name) {
      setName(store.name);
      setNameDirty(false);
      return;
    }
    await update.mutateAsync({ id: store.id, name: next });
    setNameDirty(false);
  };

  const commitColors = async () => {
    if (!colorsDirty) return;
    await update.mutateAsync({
      id: store.id,
      accentHex,
      softHex,
      deepHex,
    });
    setColorsDirty(false);
  };

  return (
    <tr
      ref={reorder.setNodeRef}
      style={reorder.style}
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1 py-2 pr-3 pl-1 hover:bg-slate-50 md:table-row md:p-0",
        reorder.isDragging && "bg-white shadow-md",
      )}
    >
      <td className="row-span-2 md:table-cell md:px-2 md:py-3 md:align-middle">
        <ReorderHandle {...reorder.handleProps} />
      </td>
      <td className="min-w-0 md:table-cell md:px-4 md:py-3">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameDirty(true);
          }}
          onBlur={() => nameDirty && void commitName()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label="Store name"
          className={cn(
            "w-full truncate rounded-md border border-transparent bg-transparent py-0.5 font-medium text-slate-900 outline-none focus:border-slate-200 focus:bg-white focus:px-2 md:py-1",
            !store.isActive && "text-slate-400",
          )}
        />
        <p className="hidden text-xs text-slate-500 md:block">/{store.slug}</p>
      </td>
      <td className="col-span-3 col-start-2 row-start-2 min-w-0 md:table-cell md:px-4 md:py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs text-slate-500 md:hidden">
            /{store.slug} · {store.categoryCount} categor
            {store.categoryCount === 1 ? "y" : "ies"}
          </span>
          <div className="flex shrink-0 items-center gap-1.5 md:flex-wrap md:gap-3">
            <ColorPicker
              label="Accent"
              value={accentHex}
              onChange={(hex) => {
                setAccentHex(hex);
                setColorsDirty(true);
              }}
              onCommit={() => void commitColors()}
              compact
            />
            <ColorPicker
              label="Soft"
              value={softHex}
              onChange={(hex) => {
                setSoftHex(hex);
                setColorsDirty(true);
              }}
              onCommit={() => void commitColors()}
              compact
            />
            <ColorPicker
              label="Deep"
              value={deepHex}
              onChange={(hex) => {
                setDeepHex(hex);
                setColorsDirty(true);
              }}
              onCommit={() => void commitColors()}
              compact
            />
          </div>
        </div>
      </td>
      <td className="col-start-3 row-start-1 md:table-cell md:px-4 md:py-3">
        <ActiveSwitch
          checked={store.isActive}
          label={`${store.name} active`}
          onChange={(isActive) => update.mutate({ id: store.id, isActive })}
        />
      </td>
      <td className="hidden text-slate-600 tabular-nums md:table-cell md:px-4 md:py-3 md:text-right">
        {store.categoryCount}
      </td>
      <td className="col-start-4 row-start-1 md:table-cell md:px-4 md:py-3 md:text-right">
        <div className="flex items-center justify-end">
          <button
            type="button"
            title="Delete"
            onClick={() => {
              if (
                confirm(
                  store.categoryCount > 0
                    ? `"${store.name}" still has ${store.categoryCount} categor${store.categoryCount === 1 ? "y" : "ies"}. Move them first.`
                    : `Delete "${store.name}"?`,
                )
              ) {
                if (store.categoryCount > 0) return;
                del.mutate(store.id, {
                  onError: (err) => alert(err instanceof Error ? err.message : "Delete failed"),
                });
              }
            }}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
