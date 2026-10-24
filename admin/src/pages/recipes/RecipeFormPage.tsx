import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Field, inputClass, selectClass, textareaClass } from "@/components/form/Field";
import { useStaffPermission } from "@/lib/permissions";
import { useAdminCategories } from "@/hooks/useAdminCategories";
import { useAdminBuyItems } from "@/hooks/useAdminBooks";
import {
  useAdminRecipe,
  useAdminRecipes,
  useCreateRecipe,
  useUpdateRecipe,
  type RecipeDraft,
  type RecipeWritePayload,
} from "@/hooks/useAdminRecipes";
import {
  RECIPE_UNITS,
  parseRecipeQty,
  type RecipeUnit,
  unitFromQtyText,
  unitLabel,
} from "@/pages/recipes/recipe-ui";
import { SearchCreate } from "@/pages/expenses/SearchCreate";
import { ScanRecipeBlock } from "@/pages/recipes/ScanRecipeBlock";

type DraftLine = {
  key: string;
  name: string;
  qty: string;
  unit: RecipeUnit;
  note: string;
  buyItemId?: string;
  componentRecipeId?: string;
};

type DraftUsage = { key: string; axis1: string; axis2: string; qty: string; unit: RecipeUnit };

function emptyLine(): DraftLine {
  return { key: Math.random().toString(36).slice(2), name: "", qty: "", unit: "G", note: "" };
}
function emptyUsage(): DraftUsage {
  return { key: Math.random().toString(36).slice(2), axis1: "", axis2: "", qty: "", unit: "G" };
}

export function RecipeFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const existing = useAdminRecipe(isNew ? undefined : id);

  if (!isNew && existing.isLoading) {
    return <p className="text-sm text-slate-500">Loading recipe…</p>;
  }
  if (!isNew && existing.isError) {
    return <p className="text-sm text-red-700">Recipe not found.</p>;
  }

  const cur = existing.data?.currentVersion;
  return (
    <RecipeForm
      key={existing.data?.id ?? "new"}
      recipeId={existing.data?.id}
      initial={{
        name: existing.data?.name ?? "",
        categoryId: existing.data?.categoryId ?? "",
        yieldQty: cur?.yieldQty != null ? String(cur.yieldQty) : "",
        yieldUnit: cur?.yieldUnit ?? "KG",
        yieldNote: cur?.yieldNote ?? "",
        lines: cur?.ingredients.length
          ? cur.ingredients.map((l) => ({
              key: l.id ?? Math.random().toString(36).slice(2),
              name: l.name,
              qty: String(l.qty),
              unit: l.unit,
              note: l.note ?? "",
              buyItemId: l.buyItemId ?? undefined,
              componentRecipeId: l.componentRecipeId ?? undefined,
            }))
          : [emptyLine()],
        steps: cur?.steps.map((s) => s.text).join("\n") ?? "",
        usage: cur?.usage.length
          ? cur.usage.map((u) => ({
              key: u.id ?? Math.random().toString(36).slice(2),
              axis1: u.axis1,
              axis2: u.axis2 ?? "",
              qty: String(u.qty),
              unit: u.unit,
            }))
          : [],
      }}
    />
  );
}

function RecipeForm({
  recipeId,
  initial,
}: {
  recipeId?: string;
  initial: {
    name: string;
    categoryId: string;
    yieldQty: string;
    yieldUnit: RecipeUnit;
    yieldNote: string;
    lines: DraftLine[];
    steps: string;
    usage: DraftUsage[];
  };
}) {
  const navigate = useNavigate();
  const canWrite = useStaffPermission("recipes.write");
  const create = useCreateRecipe();
  const update = useUpdateRecipe();
  const categories = useAdminCategories();
  const items = useAdminBuyItems({ pageSize: 80 });
  const recipes = useAdminRecipes({ pageSize: 80 });
  const [name, setName] = useState(initial.name);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [yieldQty, setYieldQty] = useState(initial.yieldQty);
  const [yieldUnit, setYieldUnit] = useState<RecipeUnit>(initial.yieldUnit);
  const [yieldNote, setYieldNote] = useState(initial.yieldNote);
  const [lines, setLines] = useState(initial.lines);
  const [steps, setSteps] = useState(initial.steps);
  const [usage, setUsage] = useState(initial.usage);
  const [lineQueries, setLineQueries] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  const applyDraft = (draft: RecipeDraft) => {
    if (draft.name) setName(draft.name);
    if (draft.categoryId) setCategoryId(draft.categoryId);
    if (draft.yieldQty != null) setYieldQty(String(draft.yieldQty));
    if (draft.yieldUnit) setYieldUnit(draft.yieldUnit);
    if (draft.yieldNote) setYieldNote(draft.yieldNote);
    if (draft.ingredients.length) {
      const next = draft.ingredients.map((l) => ({
        key: Math.random().toString(36).slice(2),
        name: l.name,
        qty: String(l.qty),
        unit: l.unit,
        note: l.note ?? "",
        buyItemId: l.buyItemId ?? undefined,
        componentRecipeId: l.componentRecipeId ?? undefined,
      }));
      setLines(next);
      setLineQueries(Object.fromEntries(next.map((l) => [l.key, l.name])));
    }
    if (draft.usage.length) {
      setUsage(
        draft.usage.map((u) => ({
          key: Math.random().toString(36).slice(2),
          axis1: u.axis1,
          axis2: u.axis2 ?? "",
          qty: String(u.qty),
          unit: u.unit,
        })),
      );
    }
    if (draft.steps.length) setSteps(draft.steps.join("\n"));
    setScanNote(
      draft.uncertain
        ? "Some lines were unclear — check qty and names, then save."
        : "Check the lines, then save.",
    );
  };

  const setLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const buildPayload = (): RecipeWritePayload | null => {
    if (!name.trim()) {
      setError("Name the recipe.");
      return null;
    }
    if (!categoryId) {
      setError("Pick a category.");
      return null;
    }
    const ingredients = lines
      .map((l) => {
        const qty = parseRecipeQty(l.qty);
        return {
          name: l.name.trim() || undefined,
          qty: qty ?? 0,
          unit: unitFromQtyText(l.qty) ?? l.unit,
          note: l.note.trim() || null,
          buyItemId: l.buyItemId,
          componentRecipeId: l.componentRecipeId,
        };
      })
      .filter((l) => l.qty > 0 && (l.componentRecipeId || l.name));
    const namedWithoutQty = lines.filter(
      (l) => (l.name.trim() || l.componentRecipeId) && !parseRecipeQty(l.qty),
    );
    if (ingredients.length === 0) {
      setError("Add at least one ingredient.");
      return null;
    }
    if (namedWithoutQty.length) {
      setError("Check qty — use 1/2 or 0.5, not a blank box.");
      return null;
    }
    const parsedYield = parseRecipeQty(yieldQty);
    return {
      name: name.trim(),
      categoryId,
      version: {
        yieldQty: parsedYield,
        yieldUnit: parsedYield ? (unitFromQtyText(yieldQty) ?? yieldUnit) : null,
        yieldNote: yieldNote.trim() || null,
        ingredients,
        steps: steps
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        usage: usage
          .filter((u) => u.axis1.trim() && parseRecipeQty(u.qty))
          .map((u) => ({
            axis1: u.axis1.trim(),
            axis2: u.axis2.trim() || null,
            qty: parseRecipeQty(u.qty) as number,
            unit: unitFromQtyText(u.qty) ?? u.unit,
          })),
      },
    };
  };

  const pickerOptions = [
    ...(recipes.data?.items ?? [])
      .filter((r) => r.id !== recipeId)
      .map((r) => ({
        id: `recipe:${r.id}`,
        label: r.name,
        hint: "Recipe",
      })),
    ...(items.data?.items ?? []).map((it) => ({
      id: `item:${it.id}`,
      label: it.name,
      hint: unitLabel(it.unit),
    })),
  ];

  return (
    <div>
      <Link
        to={recipeId ? `/recipes/${recipeId}` : "/recipes"}
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-500"
      >
        <ArrowLeft className="h-3 w-3" /> {recipeId ? "Recipe" : "All recipes"}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-slate-900">
        {recipeId ? "Edit recipe" : "New recipe"}
      </h1>
      {scanNote && <p className="mt-1 text-sm text-emerald-700">{scanNote}</p>}

      <form
        className="mt-4 space-y-2.5 rounded-card border border-slate-200 bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const body = buildPayload();
          if (!body) return;
          if (recipeId) {
            update.mutate(
              { id: recipeId, ...body },
              {
                onSuccess: (row) => navigate(`/recipes/${row.id}`),
                onError: (err) => setError(err instanceof Error ? err.message : "Could not save"),
              },
            );
          } else {
            create.mutate(body, {
              onSuccess: (row) => navigate(`/recipes/${row.id}`),
              onError: (err) => setError(err instanceof Error ? err.message : "Could not save"),
            });
          }
        }}
      >
        {!recipeId && canWrite && <ScanRecipeBlock onDraft={applyDraft} />}

        <div className="grid grid-cols-1 gap-2 min-[560px]:grid-cols-2">
          <Field label="Name" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              disabled={!canWrite}
            />
          </Field>
          <Field label="Category" required>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={selectClass}
              disabled={!canWrite}
            >
              <option value="">Pick…</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parentName ? `${c.parentName} / ${c.name}` : c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,6rem)_minmax(0,1fr)] gap-2">
          <Field label="Yield">
            <input
              inputMode="decimal"
              value={yieldQty}
              onChange={(e) => setYieldQty(e.target.value)}
              className={inputClass}
              disabled={!canWrite}
            />
          </Field>
          <Field label="Unit">
            <select
              value={yieldUnit}
              onChange={(e) => setYieldUnit(e.target.value as RecipeUnit)}
              className={selectClass}
              disabled={!canWrite}
            >
              {RECIPE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {unitLabel(u)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Yield note">
            <input
              value={yieldNote}
              onChange={(e) => setYieldNote(e.target.value)}
              placeholder="1 kg batter, 24 cookies…"
              className={inputClass}
              disabled={!canWrite}
            />
          </Field>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Ingredients</p>
          {lines.map((line) => {
            const q = lineQueries[line.key] ?? line.name;
            return (
              <div key={line.key} className="grid grid-cols-[4.5rem_5.5rem_minmax(0,1fr)_auto] gap-1.5">
                <Field label="Qty">
                  <input
                    inputMode="decimal"
                    value={line.qty}
                    onChange={(e) => setLine(line.key, { qty: e.target.value })}
                    placeholder="1/2"
                    className={inputClass}
                    disabled={!canWrite}
                  />
                </Field>
                <Field label="Unit">
                  <select
                    value={line.unit}
                    onChange={(e) => setLine(line.key, { unit: e.target.value as RecipeUnit })}
                    className={selectClass}
                    disabled={!canWrite}
                  >
                    {RECIPE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {unitLabel(u)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Item or recipe">
                  <SearchCreate
                    query={q}
                    onQuery={(next) => {
                      setLineQueries((prev) => ({ ...prev, [line.key]: next }));
                      setLine(line.key, {
                        name: next,
                        buyItemId: undefined,
                        componentRecipeId: undefined,
                      });
                    }}
                    options={pickerOptions.filter((o) =>
                      o.label.toLowerCase().includes(q.trim().toLowerCase()),
                    )}
                    placeholder="Maida, cookie recipe…"
                    createLabel={q.trim() && !line.buyItemId && !line.componentRecipeId ? `Use “${q.trim()}”` : null}
                    onSelect={(raw) => {
                      if (raw.startsWith("recipe:")) {
                        const id = raw.slice(7);
                        const r = recipes.data?.items.find((row) => row.id === id);
                        setLine(line.key, {
                          componentRecipeId: id,
                          buyItemId: undefined,
                          name: r?.name ?? "",
                        });
                        setLineQueries((prev) => ({ ...prev, [line.key]: r?.name ?? "" }));
                        return;
                      }
                      if (raw.startsWith("item:")) {
                        const id = raw.slice(5);
                        const it = items.data?.items.find((row) => row.id === id);
                        setLine(line.key, {
                          buyItemId: id,
                          componentRecipeId: undefined,
                          name: it?.name ?? "",
                        });
                        setLineQueries((prev) => ({ ...prev, [line.key]: it?.name ?? "" }));
                      }
                    }}
                    onCreate={(n) => {
                      setLine(line.key, { name: n, buyItemId: undefined, componentRecipeId: undefined });
                      setLineQueries((prev) => ({ ...prev, [line.key]: n }));
                    }}
                  />
                </Field>
                {lines.length > 1 && canWrite && (
                  <button
                    type="button"
                    className="mt-5 text-slate-400 hover:text-red-700"
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
          {canWrite && (
            <button
              type="button"
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-700"
            >
              <Plus className="h-4 w-4" /> Add ingredient
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Portions <span className="font-normal text-slate-400">(size / crust)</span>
          </p>
          {usage.map((row) => (
            <div key={row.key} className="grid grid-cols-[1fr_1fr_4.5rem_5.5rem_auto] gap-1.5">
              <Field label="Size / pack">
                <input
                  value={row.axis1}
                  onChange={(e) =>
                    setUsage((prev) =>
                      prev.map((u) => (u.key === row.key ? { ...u, axis1: e.target.value } : u)),
                    )
                  }
                  placeholder='6" / 250 ml'
                  className={inputClass}
                  disabled={!canWrite}
                />
              </Field>
              <Field label="Style">
                <input
                  value={row.axis2}
                  onChange={(e) =>
                    setUsage((prev) =>
                      prev.map((u) => (u.key === row.key ? { ...u, axis2: e.target.value } : u)),
                    )
                  }
                  placeholder="thin, thick…"
                  className={inputClass}
                  disabled={!canWrite}
                />
              </Field>
              <Field label="Qty">
                <input
                  inputMode="decimal"
                  value={row.qty}
                  onChange={(e) =>
                    setUsage((prev) =>
                      prev.map((u) => (u.key === row.key ? { ...u, qty: e.target.value } : u)),
                    )
                  }
                  className={inputClass}
                  disabled={!canWrite}
                />
              </Field>
              <Field label="Unit">
                <select
                  value={row.unit}
                  onChange={(e) =>
                    setUsage((prev) =>
                      prev.map((u) =>
                        u.key === row.key ? { ...u, unit: e.target.value as RecipeUnit } : u,
                      ),
                    )
                  }
                  className={selectClass}
                  disabled={!canWrite}
                >
                  {RECIPE_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {unitLabel(u)}
                    </option>
                  ))}
                </select>
              </Field>
              {canWrite && (
                <button
                  type="button"
                  className="mt-5 text-slate-400 hover:text-red-700"
                  onClick={() => setUsage((prev) => prev.filter((u) => u.key !== row.key))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {canWrite && (
            <button
              type="button"
              onClick={() => setUsage((prev) => [...prev, emptyUsage()])}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-700"
            >
              <Plus className="h-4 w-4" /> Add portion
            </button>
          )}
        </div>

        <Field label="Process" hint="One step per line.">
          <textarea
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            rows={4}
            className={textareaClass}
            disabled={!canWrite}
          />
        </Field>

        {error && <p className="text-xs text-red-700">{error}</p>}
        {canWrite && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? "Saving…" : recipeId ? "Save" : "Save recipe"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
