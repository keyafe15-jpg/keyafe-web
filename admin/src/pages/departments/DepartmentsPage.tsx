import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  useAdminDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  type AdminDepartment,
} from "@/hooks/useAdminDepartments";
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

export function DepartmentsPage() {
  const { data: stores = [], isLoading } = useAdminDepartments();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Stores</h1>
        <p className="mt-1 text-sm text-slate-500">
          Groupings such as Dessert and Savoury. Top-level categories pick one; sub-categories
          inherit it. Shopfront colors paint the home store doors.
        </p>
      </div>

      <NewStoreRow />

      <div className="mt-4 overflow-hidden rounded-card border border-slate-200 bg-white">
        {isLoading && <div className="p-8 text-center text-sm text-slate-500">Loading…</div>}
        {!isLoading && stores.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            No stores yet — add your first one above.
          </div>
        )}
        {!isLoading && stores.length > 0 && (
          // Six columns of editable controls can't fit a phone, so the table
          // scrolls inside the card rather than being clipped by its
          // overflow-hidden corners.
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium">Store</th>
                  <th className="px-4 py-2 font-medium">Shopfront</th>
                  <th className="w-24 px-4 py-2 font-medium">Sort</th>
                  <th className="w-24 px-4 py-2 font-medium">Active</th>
                  <th className="w-28 px-4 py-2 text-right font-medium">Categories</th>
                  <th className="w-12 px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stores.map((store) => (
                  <StoreRow key={store.id} store={store} />
                ))}
              </tbody>
            </table>
          </div>
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
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  onCommit?: () => void;
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
        className="h-8 w-8 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
      />
      <span>{label}</span>
    </label>
  );
}

function NewStoreRow() {
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
        sortOrder: 0,
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

function StoreRow({ store }: { store: AdminDepartment }) {
  const update = useUpdateDepartment();
  const del = useDeleteDepartment();
  const [name, setName] = useState(store.name);
  const [sortOrder, setSortOrder] = useState(String(store.sortOrder));
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

  const commitSort = async () => {
    const n = Number(sortOrder);
    if (!Number.isFinite(n) || n === store.sortOrder) {
      setSortOrder(String(store.sortOrder));
      return;
    }
    await update.mutateAsync({ id: store.id, sortOrder: n });
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
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
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
          className="w-full rounded-md border border-transparent bg-transparent py-1 font-medium text-slate-900 outline-none focus:border-slate-200 focus:bg-white focus:px-2"
        />
        <p className="text-xs text-slate-500">/{store.slug}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <ColorPicker
            label="Accent"
            value={accentHex}
            onChange={(hex) => {
              setAccentHex(hex);
              setColorsDirty(true);
            }}
            onCommit={() => void commitColors()}
          />
          <ColorPicker
            label="Soft"
            value={softHex}
            onChange={(hex) => {
              setSoftHex(hex);
              setColorsDirty(true);
            }}
            onCommit={() => void commitColors()}
          />
          <ColorPicker
            label="Deep"
            value={deepHex}
            onChange={(hex) => {
              setDeepHex(hex);
              setColorsDirty(true);
            }}
            onCommit={() => void commitColors()}
          />
        </div>
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          onBlur={() => void commitSort()}
          className={cn(inputClass, "w-20 py-1.5 text-center text-xs")}
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={store.isActive}
          onChange={(e) => update.mutate({ id: store.id, isActive: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
        />
      </td>
      <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{store.categoryCount}</td>
      <td className="px-4 py-3 text-right">
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
          className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition hover:border-brand-500 hover:text-brand-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
