import { useState } from "react";
import { Plus } from "lucide-react";
import {
  useAdminTags,
  useCreateTag,
  useUpdateTag,
  type AdminTag,
} from "@/hooks/useTags";
import { cn } from "@/lib/cn";
import { Field, inputClass, submitClass } from "@/components/form/Field";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const DEFAULT_COLORS = ["#E31C79", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"];

export function TagsPage() {
  const { data: tags = [], isLoading } = useAdminTags();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Product tags</h1>
        <p className="mt-1 text-sm text-slate-500">
          Labels like &ldquo;New launch&rdquo; and &ldquo;Best seller&rdquo;.
          Assign them on each product; they show as badges on the storefront.
        </p>
      </div>

      <NewTagRow />

      <div className="mt-4 overflow-hidden rounded-card border border-slate-200 bg-white">
        {isLoading && (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        )}
        {!isLoading && tags.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            No tags yet — add your first one above.
          </div>
        )}
        {!isLoading && tags.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Tag</th>
                <th className="w-36 px-4 py-2 font-medium">Color</th>
                <th className="w-28 px-4 py-2 text-right font-medium">
                  Products
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tags.map((tag) => (
                <TagRow key={tag.id} tag={tag} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function NewTagRow() {
  const create = useCreateTag();
  const [name, setName] = useState("");
  const [colorHex, setColorHex] = useState(DEFAULT_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0;

  const submit = async () => {
    setError(null);
    try {
      await create.mutateAsync({
        name: name.trim(),
        slug: slugify(name),
        colorHex: colorHex || null,
      });
      setName("");
      setColorHex(DEFAULT_COLORS[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  return (
    <div className="rounded-card border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
        <Field label="New tag">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Best seller"
            className={inputClass}
          />
        </Field>
        <Field label="Badge color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
              className="h-10 w-12 cursor-pointer rounded border border-slate-200 bg-white"
            />
            <input
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
              placeholder="#E31C79"
              className={cn(inputClass, "font-mono text-xs")}
            />
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
      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function TagRow({ tag }: { tag: AdminTag }) {
  const update = useUpdateTag();
  const [name, setName] = useState(tag.name);
  const [colorHex, setColorHex] = useState(tag.colorHex ?? "#E31C79");
  const [dirty, setDirty] = useState(false);

  const commit = async () => {
    await update.mutateAsync({
      id: tag.id,
      name: name.trim(),
      colorHex: colorHex || null,
    });
    setDirty(false);
  };

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
          onBlur={() => dirty && commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-full rounded-md border border-transparent bg-transparent py-1 font-medium text-slate-900 outline-none focus:border-slate-200 focus:bg-white focus:px-2"
        />
        <p className="text-xs text-slate-500">/{tag.slug}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={colorHex}
            onChange={(e) => {
              setColorHex(e.target.value);
              setDirty(true);
            }}
            onBlur={() => dirty && commit()}
            className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white"
          />
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${colorHex}22`,
              color: colorHex,
            }}
          >
            Preview
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-600">
        {tag.productCount}
      </td>
    </tr>
  );
}
